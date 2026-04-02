/**
 * HandoffManager
 *
 * Records and validates agent-to-agent handoffs.
 * A handoff is a structured event where one agent passes work
 * (artifacts + context) to the next agent.
 */

import { randomUUID } from 'node:crypto'
import type {
  HandoffEvent,
  AgentResponse,
  JobDefinition,
  WorkflowStep,
  ArtifactRef,
} from '../core/types.js'
import { ArtifactStore } from '../artifacts/artifact-store.js'

export class HandoffManager {
  constructor(private store: ArtifactStore) {}

  /**
   * Record a handoff based on an agent response that contains a handoff signal.
   * Returns the HandoffEvent if a signal was present, null otherwise.
   */
  recordFromResponse(
    response: AgentResponse,
    fromStep: WorkflowStep,
    toStepId: string,
    job: JobDefinition,
    artifacts: ArtifactRef[],
  ): HandoffEvent | null {
    if (!response.handoffSignal) return null

    const handoff: HandoffEvent = {
      id: `handoff-${randomUUID()}`,
      jobId: job.id,
      fromAgentId: response.agentId,
      toAgentId: response.handoffSignal.targetAgentId,
      fromStepId: fromStep.id,
      toStepId,
      condition: response.handoffSignal.condition,
      payload: {
        ...response.handoffSignal.payload,
        artifacts,
      },
      timestamp: new Date().toISOString(),
      requiresApproval: response.approvalNeeded ?? false,
      approved: response.approvalNeeded ? undefined : true,
    }

    this.store.appendHandoff(job.squadId, job.id, handoff)
    return handoff
  }

  /**
   * Create an explicit handoff when step completes without a signal
   * (e.g., sequential workflow with no explicit handoff signal).
   */
  recordAutoHandoff(
    fromAgentId: string,
    toAgentId: string,
    fromStepId: string,
    toStepId: string,
    job: JobDefinition,
    artifacts: ArtifactRef[],
  ): HandoffEvent {
    const handoff: HandoffEvent = {
      id: `handoff-${randomUUID()}`,
      jobId: job.id,
      fromAgentId,
      toAgentId,
      fromStepId,
      toStepId,
      condition: 'step_completed',
      payload: {
        summary: `Step '${fromStepId}' completed — passing to '${toStepId}'`,
        artifacts,
      },
      timestamp: new Date().toISOString(),
      requiresApproval: false,
      approved: true,
    }

    this.store.appendHandoff(job.squadId, job.id, handoff)
    return handoff
  }

  /** Approve a pending handoff */
  approve(handoff: HandoffEvent, approvedBy?: string): HandoffEvent {
    handoff.approved = true
    if (approvedBy) {
      handoff.payload.notes = `Approved by: ${approvedBy}`
    }
    return handoff
  }

  /** Load all handoffs for a job */
  loadForJob(job: JobDefinition): HandoffEvent[] {
    return this.store.loadHandoffs(job.squadId, job.id)
  }
}

export function createHandoffManager(store: ArtifactStore): HandoffManager {
  return new HandoffManager(store)
}
