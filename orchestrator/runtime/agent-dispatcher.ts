/**
 * AgentDispatcher
 *
 * Selects the correct agent for the current workflow step and
 * builds the prompt that will be sent to the host adapter.
 * Does NOT execute the host call — that is done by SquadRuntime.
 */

import type {
  SquadDefinition,
  AgentDefinition,
  JobDefinition,
  WorkflowStep,
} from '../core/types.js'
import { ContextLoader } from '../context/context-loader.js'

export interface DispatchPlan {
  agent: AgentDefinition
  step: WorkflowStep
  prompt: string
}

export class AgentDispatcher {
  /** Find the agent responsible for a given step */
  resolveAgent(squad: SquadDefinition, step: WorkflowStep): AgentDefinition | undefined {
    return squad.agents.find((a) => a.id === step.agentId)
  }

  /** Find the next step to execute based on current step and job state */
  resolveNextStep(
    squad: SquadDefinition,
    currentStepId: string | null,
  ): WorkflowStep | undefined {
    if (!currentStepId) {
      // Return entry step
      return squad.workflow.steps.find((s) => s.id === squad.workflow.entryStepId)
    }

    const currentStep = squad.workflow.steps.find((s) => s.id === currentStepId)
    if (!currentStep?.nextStepId) return undefined

    return squad.workflow.steps.find((s) => s.id === currentStep.nextStepId)
  }

  /** Build the full prompt for a given agent + step + job */
  buildPrompt(
    agent: AgentDefinition,
    step: WorkflowStep,
    job: JobDefinition,
  ): string {
    const ctx = ContextLoader.formatContextForPrompt(job.loadedContext)
    const artifactList = job.artifacts.map((a) => `- ${a.name} (${a.path})`).join('\n') || '(none)'

    return [
      `# Role: ${agent.name}`,
      ``,
      `## Your Objective`,
      agent.objective,
      ``,
      `## Instructions`,
      agent.instructions,
      ``,
      `## Current Job`,
      `- Job ID: ${job.id}`,
      `- Objective: ${job.objective}`,
      `- Status: ${job.status}`,
      `- Current Step: ${step.name}`,
      ``,
      `## Step Description`,
      step.description,
      ``,
      `## Available Artifacts`,
      artifactList,
      ``,
      `## Initial Input`,
      job.initialInput,
      ``,
      ctx,
      ``,
      `## Your Task`,
      `Complete the step "${step.name}". Produce the expected outputs: ${step.producedArtifacts.join(', ') || 'none specified'}.`,
      ``,
      `## Response Format`,
      `Respond in ${agent.responseFormat} format. If you produce artifacts, prefix each with: ARTIFACT:<name>:<format>`,
      agent.constraints.length > 0
        ? `\n## Constraints\n${agent.constraints.map((c) => `- ${c}`).join('\n')}`
        : '',
    ]
      .filter((l) => l !== undefined)
      .join('\n')
  }

  /** Create a full dispatch plan: agent + step + prompt */
  plan(
    squad: SquadDefinition,
    step: WorkflowStep,
    job: JobDefinition,
  ): DispatchPlan | null {
    const agent = this.resolveAgent(squad, step)
    if (!agent) return null

    return {
      agent,
      step,
      prompt: this.buildPrompt(agent, step, job),
    }
  }
}

export function createAgentDispatcher(): AgentDispatcher {
  return new AgentDispatcher()
}
