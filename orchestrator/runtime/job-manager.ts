/**
 * JobManager
 *
 * Manages the full lifecycle of a Job: creation, state updates,
 * history recording, and persistence via ArtifactStore.
 */

import { randomUUID } from 'node:crypto'
import type {
  JobDefinition,
  JobStatus,
  SquadId,
  LoadedContext,
  ArtifactRef,
  ApprovalRecord,
  HistoryEntry,
  StepId,
  AgentId,
} from '../core/types.js'
import { ArtifactStore } from '../artifacts/artifact-store.js'

export interface CreateJobOptions {
  squadId: SquadId
  objective: string
  initialInput: string
  loadedContext: LoadedContext
}

export class JobManager {
  constructor(private store: ArtifactStore) {}

  /** Create a new job and persist it immediately */
  create(options: CreateJobOptions): JobDefinition {
    const now = new Date().toISOString()
    const job: JobDefinition = {
      id: `job-${randomUUID()}`,
      squadId: options.squadId,
      status: 'JOB_CREATED',
      objective: options.objective,
      initialInput: options.initialInput,
      loadedContext: options.loadedContext,
      artifacts: [],
      approvals: [],
      currentStepId: null,
      currentAgentId: null,
      history: [],
      startedAt: now,
      updatedAt: now,
    }

    this.recordEvent(job, {
      timestamp: now,
      type: 'info',
      message: `Job created. Objective: ${options.objective}`,
    })

    this.store.saveJob(job)
    return job
  }

  /** Transition job to a new status and record it in history */
  transition(
    job: JobDefinition,
    newStatus: JobStatus,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    const prev = job.status
    job.status = newStatus
    job.updatedAt = new Date().toISOString()

    this.recordEvent(job, {
      timestamp: job.updatedAt,
      type: 'state_transition',
      fromStatus: prev,
      toStatus: newStatus,
      message,
      data,
    })

    this.store.saveJob(job)
  }

  /** Mark the current step and agent */
  setCurrentStep(job: JobDefinition, stepId: StepId, agentId: AgentId): void {
    job.currentStepId = stepId
    job.currentAgentId = agentId
    job.updatedAt = new Date().toISOString()

    this.recordEvent(job, {
      timestamp: job.updatedAt,
      type: 'agent_run',
      stepId,
      agentId,
      message: `Starting step '${stepId}' with agent '${agentId}'`,
    })

    this.store.saveJob(job)
  }

  /** Add an artifact to the job */
  addArtifact(job: JobDefinition, ref: ArtifactRef): void {
    job.artifacts.push(ref)
    job.updatedAt = new Date().toISOString()
    this.store.saveJob(job)
  }

  /** Add or update an approval record */
  upsertApproval(job: JobDefinition, approval: ApprovalRecord): void {
    const idx = job.approvals.findIndex((a) => a.id === approval.id)
    if (idx >= 0) {
      job.approvals[idx] = approval
    } else {
      job.approvals.push(approval)
    }
    job.updatedAt = new Date().toISOString()
    this.store.saveApprovals(job.squadId, job.id, job.approvals)
    this.store.saveJob(job)
  }

  /** Complete a job successfully */
  complete(job: JobDefinition): void {
    const now = new Date().toISOString()
    job.status = 'COMPLETED'
    job.completedAt = now
    job.updatedAt = now

    this.recordEvent(job, {
      timestamp: now,
      type: 'state_transition',
      fromStatus: job.status,
      toStatus: 'COMPLETED',
      message: 'Job completed successfully',
    })

    this.store.saveJob(job)
  }

  /** Fail a job with a reason */
  fail(job: JobDefinition, reason: string): void {
    const now = new Date().toISOString()
    job.status = 'FAILED'
    job.failureReason = reason
    job.completedAt = now
    job.updatedAt = now

    this.recordEvent(job, {
      timestamp: now,
      type: 'error',
      message: `Job failed: ${reason}`,
    })

    this.store.saveJob(job)
  }

  /** Load a job from disk */
  load(squadId: SquadId, jobId: string): JobDefinition | null {
    return this.store.loadJob(squadId, jobId)
  }

  /** List all jobs for a squad */
  list(squadId: SquadId): string[] {
    return this.store.listJobs(squadId)
  }

  private recordEvent(job: JobDefinition, entry: Omit<HistoryEntry, 'timestamp'> & { timestamp: string }): void {
    job.history.push(entry as HistoryEntry)
    this.store.appendEvent(job.squadId, job.id, entry as HistoryEntry)
  }
}

export function createJobManager(store: ArtifactStore): JobManager {
  return new JobManager(store)
}
