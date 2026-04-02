/**
 * SquadRuntime
 *
 * Main execution engine. Coordinates:
 * - Loading squad definitions
 * - Creating/managing jobs (JobManager)
 * - Running the state machine
 * - Dispatching agents (AgentDispatcher)
 * - Managing handoffs (HandoffManager)
 * - Enforcing guardrails (GuardrailEngine)
 * - Handling approvals (ApprovalGate)
 * - Persisting artifacts (ArtifactStore)
 *
 * SquadRuntime is host-agnostic: it delegates actual LLM calls
 * to an IHostAdapter. Swap the adapter to change the execution environment.
 */

import type { IHostAdapter } from '../adapters/host/IHostAdapter.js'
import type {
  SquadDefinition,
  JobDefinition,
  WorkflowStep,
  GuardrailRule,
} from '../core/types.js'
import { createStateMachine, StateMachine } from '../core/state-machine.js'
import { createGuardrailEngine, GuardrailEngine } from '../core/guardrails.js'
import { ArtifactStore, createArtifactStore } from '../artifacts/artifact-store.js'
import { JobManager, createJobManager } from './job-manager.js'
import { AgentDispatcher, createAgentDispatcher } from './agent-dispatcher.js'
import { HandoffManager, createHandoffManager } from './handoff-manager.js'
import { ApprovalGate, createApprovalGate } from './approval-gate.js'
import { ContextLoader } from '../context/context-loader.js'

export interface RuntimeConfig {
  /** Directory for artifact persistence */
  artifactsDir?: string
  /** Host adapter for LLM calls */
  hostAdapter: IHostAdapter
  /** Root path for context discovery */
  contextRootPath?: string
  /** Whether to skip guardrail blocks (NEVER use in production) */
  skipGuardrails?: boolean
}

export interface StepExecutionResult {
  success: boolean
  nextStepId?: string
  blocked?: boolean
  waitingApproval?: boolean
  message: string
}

export class SquadRuntime {
  private store: ArtifactStore
  private jobManager: JobManager
  private dispatcher: AgentDispatcher
  private handoffManager: HandoffManager
  private approvalGate: ApprovalGate
  private stateMachine: StateMachine
  private guardrailEngine: GuardrailEngine
  private hostAdapter: IHostAdapter
  private contextRootPath: string
  private skipGuardrails: boolean

  constructor(config: RuntimeConfig) {
    this.store = createArtifactStore(config.artifactsDir)
    this.jobManager = createJobManager(this.store)
    this.dispatcher = createAgentDispatcher()
    this.handoffManager = createHandoffManager(this.store)
    this.approvalGate = createApprovalGate(this.store)
    this.stateMachine = createStateMachine()
    this.guardrailEngine = createGuardrailEngine()
    this.hostAdapter = config.hostAdapter
    this.contextRootPath = config.contextRootPath ?? process.cwd()
    this.skipGuardrails = config.skipGuardrails ?? false
  }

  // ─── Job Lifecycle ──────────────────────────────────────────────────────────

  /**
   * Start a new job for a squad.
   * Loads context, creates the job, and returns the job definition.
   */
  async startJob(
    squad: SquadDefinition,
    objective: string,
    initialInput: string,
  ): Promise<JobDefinition> {
    // Load context
    const contextLoader = new ContextLoader({ rootPath: this.contextRootPath })
    const loadedContext = await contextLoader.load()

    // Create job
    const job = this.jobManager.create({
      squadId: squad.id,
      objective,
      initialInput,
      loadedContext,
    })

    // Transition to READY_FOR_EXECUTION
    const result = this.stateMachine.transition(job, 'MARK_READY')
    if (result.success) {
      this.jobManager.transition(job, 'READY_FOR_EXECUTION', 'Job ready for execution')
    }

    return job
  }

  /**
   * Execute one workflow step.
   * Returns a StepExecutionResult indicating what happens next.
   */
  async executeStep(
    squad: SquadDefinition,
    job: JobDefinition,
    step: WorkflowStep,
  ): Promise<StepExecutionResult> {
    const agent = this.dispatcher.resolveAgent(squad, step)
    if (!agent) {
      this.jobManager.fail(job, `No agent found for step '${step.id}'`)
      return { success: false, message: `No agent found for step '${step.id}'` }
    }

    // ── Guardrail check before step ─────────────────────────────────────────
    if (!this.skipGuardrails && step.guardrails.length > 0) {
      const guardrailRules = this.resolveGuardrailRules(squad, step)
      const evalCtx = { job, step, agent }
      const { blocked, warnings, results } = this.guardrailEngine.evaluateAll(guardrailRules, evalCtx)

      for (const w of warnings) {
        this.jobManager.transition(job, job.status, `[WARN] ${w.message}`)
      }

      if (blocked) {
        const blockedResult = results.find((r) => !r.passed && r.severity === 'block')
        const msg = blockedResult?.message ?? 'Guardrail blocked execution'
        this.stateMachine.transition(job, 'GUARDRAIL_BLOCKED')
        this.jobManager.transition(job, 'BLOCKED', msg)
        return { success: false, blocked: true, message: msg }
      }
    }

    // ── Approval check before step ──────────────────────────────────────────
    if (step.requiresApprovalBefore && !this.approvalGate.isApproved(job, step.id)) {
      if (!this.approvalGate.isPending(job, step.id)) {
        this.approvalGate.request(job, {
          stepId: step.id,
          requiredFor: `step: ${step.name}`,
          description: `Human approval required before running step '${step.name}'`,
        })
      }
      this.stateMachine.transition(job, 'STEP_NEEDS_APPROVAL')
      this.jobManager.transition(job, 'WAITING_APPROVAL', `Waiting for approval before step '${step.name}'`)
      return {
        success: false,
        waitingApproval: true,
        message: `Approval required before step '${step.name}'`,
      }
    }

    // ── Execute step ─────────────────────────────────────────────────────────
    this.stateMachine.transition(job, 'START_STEP')
    this.jobManager.transition(job, 'RUNNING_STEP', `Running step '${step.name}'`)
    this.jobManager.setCurrentStep(job, step.id, agent.id)

    const plan = this.dispatcher.plan(squad, step, job)
    if (!plan) {
      this.jobManager.fail(job, `Could not build dispatch plan for step '${step.id}'`)
      return { success: false, message: 'Dispatch plan failed' }
    }

    let response
    try {
      response = await this.hostAdapter.sendPrompt(plan.prompt, agent, job, step, {
        metadata: {
          allowedAgentIds: squad.agents.map((squadAgent) => squadAgent.id),
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.stateMachine.transition(job, 'FAIL')
      this.jobManager.fail(job, `Host adapter error: ${msg}`)
      return { success: false, message: `Host adapter error: ${msg}` }
    }

    // ── Persist artifacts ────────────────────────────────────────────────────
    const persistedArtifacts = []
    for (const pending of response.artifacts) {
      const ref = this.store.persistArtifact(
        job.squadId,
        job.id,
        pending,
        agent.id,
        step.id,
      )
      this.jobManager.addArtifact(job, ref)
      persistedArtifacts.push(ref)
    }

    // ── Approval check after step ────────────────────────────────────────────
    if (step.requiresApprovalAfter || response.approvalNeeded) {
      if (!this.approvalGate.isApproved(job, `${step.id}:after`)) {
        this.approvalGate.request(job, {
          stepId: `${step.id}:after`,
          requiredFor: `output of step: ${step.name}`,
          description: response.approvalReason ?? `Human approval required for output of step '${step.name}'`,
        })
        this.stateMachine.transition(job, 'STEP_NEEDS_APPROVAL')
        this.jobManager.transition(job, 'WAITING_APPROVAL', `Waiting for approval of output from step '${step.name}'`)
        return {
          success: false,
          waitingApproval: true,
          message: `Approval required for step output: '${step.name}'`,
        }
      }
    }

    // ── Handle failure response ──────────────────────────────────────────────
    if (response.status === 'failure') {
      this.stateMachine.transition(job, 'FAIL')
      this.jobManager.fail(job, `Agent '${agent.name}' reported failure at step '${step.name}'`)
      return { success: false, message: response.content }
    }

    // ── Record handoff ───────────────────────────────────────────────────────
    const nextStep = this.dispatcher.resolveNextStep(squad, step.id)
    if (nextStep) {
      const nextAgent = this.dispatcher.resolveAgent(squad, nextStep)
      if (response.handoffSignal) {
        this.handoffManager.recordFromResponse(response, step, nextStep.id, job, persistedArtifacts)
      } else if (nextAgent) {
        this.handoffManager.recordAutoHandoff(
          agent.id,
          nextAgent.id,
          step.id,
          nextStep.id,
          job,
          persistedArtifacts,
        )
      }
    }

    // ── Advance state machine ────────────────────────────────────────────────
    this.stateMachine.transition(job, 'STEP_COMPLETE')
    this.jobManager.transition(job, 'READY_FOR_EXECUTION', `Step '${step.name}' completed`)

    return {
      success: true,
      nextStepId: nextStep?.id,
      message: `Step '${step.name}' completed successfully`,
    }
  }

  /**
   * Run all steps of a squad workflow sequentially.
   * Stops at approvals and blocks — call again to resume.
   */
  async runAll(squad: SquadDefinition, job: JobDefinition): Promise<void> {
    let currentStep = this.dispatcher.resolveNextStep(squad, null)

    while (currentStep) {
      const result = await this.executeStep(squad, job, currentStep)

      if (!result.success) {
        if (result.waitingApproval || result.blocked) {
          console.log(`[SquadRuntime] Paused: ${result.message}`)
          break
        }
        console.error(`[SquadRuntime] Failed: ${result.message}`)
        break
      }

      if (!result.nextStepId) {
        // No more steps — complete the job
        this.stateMachine.transition(job, 'COMPLETE')
        this.jobManager.complete(job)
        break
      }

      const nextStep = squad.workflow.steps.find((s) => s.id === result.nextStepId)
      if (!nextStep) break
      currentStep = nextStep
    }
  }

  // ─── Approval helpers ───────────────────────────────────────────────────────

  grantApproval(job: JobDefinition, approvalId: string, by?: string, notes?: string): boolean {
    const granted = this.approvalGate.grant(job, approvalId, by, notes)
    if (granted) {
      this.stateMachine.transition(job, 'APPROVAL_GRANTED')
      this.jobManager.transition(job, 'READY_FOR_EXECUTION', `Approval ${approvalId} granted`)
    }
    return granted
  }

  rejectApproval(job: JobDefinition, approvalId: string, by?: string, notes?: string): boolean {
    const rejected = this.approvalGate.reject(job, approvalId, by, notes)
    if (rejected) {
      this.stateMachine.transition(job, 'APPROVAL_REJECTED')
      this.jobManager.transition(job, 'BLOCKED', `Approval ${approvalId} rejected`)
    }
    return rejected
  }

  // ─── Job queries ────────────────────────────────────────────────────────────

  loadJob(squadId: string, jobId: string): JobDefinition | null {
    return this.jobManager.load(squadId, jobId)
  }

  listJobs(squadId: string): string[] {
    return this.jobManager.list(squadId)
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  private resolveGuardrailRules(squad: SquadDefinition, step: WorkflowStep): GuardrailRule[] {
    return step.guardrails
      .map((id) => squad.policy.guardrails.find((g) => g.id === id))
      .filter((g): g is GuardrailRule => g !== undefined)
  }
}

export function createSquadRuntime(config: RuntimeConfig): SquadRuntime {
  return new SquadRuntime(config)
}
