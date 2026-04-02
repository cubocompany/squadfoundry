import { describe, it, expect, beforeEach } from 'vitest'
import { createGuardrailEngine, GuardrailEngine } from '../../orchestrator/core/guardrails.js'
import type { GuardrailEvaluationContext, JobDefinition, WorkflowStep, AgentDefinition } from '../../orchestrator/core/types.js'

function makeCtx(overrides: Partial<GuardrailEvaluationContext> = {}): GuardrailEvaluationContext {
  const job: JobDefinition = {
    id: 'j1',
    squadId: 'sq1',
    status: 'RUNNING_STEP',
    objective: 'test',
    initialInput: '',
    loadedContext: {
      projectMd: undefined,
      tasksMd: undefined,
      docs: [],
      specs: [],
      playbooks: [],
      policies: [],
      templates: [],
      custom: [],
    },
    artifacts: [],
    approvals: [],
    currentStepId: 'step-1',
    currentAgentId: 'agent-1',
    history: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const step: WorkflowStep = {
    id: 'step-1',
    name: 'Test Step',
    agentId: 'agent-1',
    description: '',
    dependsOn: [],
    guardrails: [],
    requiresApprovalBefore: false,
    requiresApprovalAfter: false,
    requiredArtifacts: [],
    producedArtifacts: [],
  }

  const agent: AgentDefinition = {
    id: 'agent-1',
    name: 'Test Agent',
    role: 'tester',
    domain: 'custom',
    objective: 'test',
    instructions: '',
    inputs: [],
    outputs: [],
    allowedTools: [],
    constraints: [],
    successCriteria: [],
    failureCriteria: [],
    allowedStates: ['RUNNING_STEP', 'READY_FOR_EXECUTION'],
    blockingConditions: [],
    handoffRules: [],
    responseFormat: 'markdown',
  }

  return { job, step, agent, ...overrides }
}

describe('GuardrailEngine', () => {
  let engine: GuardrailEngine

  beforeEach(() => {
    engine = createGuardrailEngine()
  })

  describe('require_minimum_context', () => {
    it('passes when projectMd is present', () => {
      const ctx = makeCtx()
      ctx.job.loadedContext.projectMd = '# Project'
      const result = engine.evaluate(
        { id: 'g1', name: 'min-ctx', description: '', severity: 'block', ruleKey: 'require_minimum_context', params: { requiredFields: ['projectMd'] } },
        ctx,
      )
      expect(result.passed).toBe(true)
    })

    it('blocks when projectMd is missing', () => {
      const ctx = makeCtx()
      const result = engine.evaluate(
        { id: 'g1', name: 'min-ctx', description: '', severity: 'block', ruleKey: 'require_minimum_context', params: { requiredFields: ['projectMd'] } },
        ctx,
      )
      expect(result.passed).toBe(false)
      expect(result.blockedTransition).toBe(true)
    })
  })

  describe('require_artifact_before_step', () => {
    it('passes when required artifact is present', () => {
      const ctx = makeCtx()
      ctx.job.artifacts.push({
        id: 'a1',
        name: 'prd',
        path: 'outputs/prd.md',
        producedByAgentId: 'product-agent',
        producedAtStepId: 'step-product',
        format: 'markdown',
        createdAt: new Date().toISOString(),
      })
      const result = engine.evaluate(
        { id: 'g2', name: 'req-artifact', description: '', severity: 'block', ruleKey: 'require_artifact_before_step', params: { artifactNames: ['prd'] } },
        ctx,
      )
      expect(result.passed).toBe(true)
    })

    it('blocks when required artifact is missing', () => {
      const ctx = makeCtx()
      const result = engine.evaluate(
        { id: 'g2', name: 'req-artifact', description: '', severity: 'block', ruleKey: 'require_artifact_before_step', params: { artifactNames: ['prd'] } },
        ctx,
      )
      expect(result.passed).toBe(false)
    })
  })

  describe('require_approval_before_publish', () => {
    it('passes for non-publish steps', () => {
      const ctx = makeCtx()
      const result = engine.evaluate(
        { id: 'g3', name: 'pub', description: '', severity: 'block', ruleKey: 'require_approval_before_publish' },
        ctx,
      )
      expect(result.passed).toBe(true)
    })

    it('blocks publish step without approval', () => {
      const ctx = makeCtx()
      ctx.step.name = 'Publish Post'
      const result = engine.evaluate(
        { id: 'g3', name: 'pub', description: '', severity: 'block', ruleKey: 'require_approval_before_publish' },
        ctx,
      )
      expect(result.passed).toBe(false)
      expect(result.blockedTransition).toBe(true)
    })

    it('passes publish step with approval', () => {
      const ctx = makeCtx()
      ctx.step.name = 'Publish Post'
      ctx.job.approvals.push({
        id: 'ap1',
        stepId: ctx.step.id,
        requiredFor: 'publish',
        status: 'approved',
        requestedAt: new Date().toISOString(),
        resolvedAt: new Date().toISOString(),
      })
      const result = engine.evaluate(
        { id: 'g3', name: 'pub', description: '', severity: 'block', ruleKey: 'require_approval_before_publish' },
        ctx,
      )
      expect(result.passed).toBe(true)
    })
  })

  describe('require_human_before_deploy', () => {
    it('blocks deploy without approval', () => {
      const ctx = makeCtx()
      ctx.step.name = 'Deploy to Production'
      const result = engine.evaluate(
        { id: 'g4', name: 'deploy', description: '', severity: 'block', ruleKey: 'require_human_before_deploy' },
        ctx,
      )
      expect(result.passed).toBe(false)
    })

    it('passes deploy with approval', () => {
      const ctx = makeCtx()
      ctx.step.name = 'Deploy'
      ctx.job.approvals.push({
        id: 'ap2',
        stepId: ctx.step.id,
        requiredFor: 'deploy',
        status: 'approved',
        requestedAt: new Date().toISOString(),
        resolvedAt: new Date().toISOString(),
      })
      const result = engine.evaluate(
        { id: 'g4', name: 'deploy', description: '', severity: 'block', ruleKey: 'require_human_before_deploy' },
        ctx,
      )
      expect(result.passed).toBe(true)
    })
  })

  describe('block_invalid_state_transition', () => {
    it('blocks agent acting in non-allowed state', () => {
      const ctx = makeCtx()
      ctx.job.status = 'BLOCKED'
      const result = engine.evaluate(
        { id: 'g5', name: 'state', description: '', severity: 'block', ruleKey: 'block_invalid_state_transition' },
        ctx,
      )
      expect(result.passed).toBe(false)
    })

    it('passes agent acting in allowed state', () => {
      const ctx = makeCtx()
      ctx.job.status = 'RUNNING_STEP'
      const result = engine.evaluate(
        { id: 'g5', name: 'state', description: '', severity: 'block', ruleKey: 'block_invalid_state_transition' },
        ctx,
      )
      expect(result.passed).toBe(true)
    })
  })

  describe('evaluateAll', () => {
    it('returns blocked=true when any block-severity rule fails', () => {
      const ctx = makeCtx()
      ctx.step.name = 'Deploy'
      const rules = [
        { id: 'g1', name: 'deploy', description: '', severity: 'block' as const, ruleKey: 'require_human_before_deploy' },
      ]
      const { blocked } = engine.evaluateAll(rules, ctx)
      expect(blocked).toBe(true)
    })

    it('returns blocked=false when all rules pass', () => {
      const ctx = makeCtx()
      ctx.job.loadedContext.projectMd = '# Project'
      const rules = [
        { id: 'g1', name: 'ctx', description: '', severity: 'warn' as const, ruleKey: 'require_minimum_context', params: { requiredFields: ['projectMd'] } },
      ]
      const { blocked } = engine.evaluateAll(rules, ctx)
      expect(blocked).toBe(false)
    })
  })

  describe('custom evaluators', () => {
    it('allows registering and using custom guardrail evaluators', () => {
      engine.register('custom_rule', (ctx, _params) => ({
        guardrailId: 'custom',
        passed: ctx.job.objective === 'allowed',
        severity: 'block',
        message: 'Custom check',
      }))

      const ctx = makeCtx()
      ctx.job.objective = 'denied'
      const result = engine.evaluate(
        { id: 'cg1', name: 'custom', description: '', severity: 'block', ruleKey: 'custom_rule' },
        ctx,
      )
      expect(result.passed).toBe(false)

      ctx.job.objective = 'allowed'
      const result2 = engine.evaluate(
        { id: 'cg1', name: 'custom', description: '', severity: 'block', ruleKey: 'custom_rule' },
        ctx,
      )
      expect(result2.passed).toBe(true)
    })
  })
})
