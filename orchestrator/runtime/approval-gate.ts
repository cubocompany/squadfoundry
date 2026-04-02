/**
 * ApprovalGate
 *
 * Human-in-the-loop pause/resume mechanism.
 *
 * When a step requires human approval, the ApprovalGate:
 * 1. Creates a pending ApprovalRecord in the job
 * 2. Persists it to approvals.json
 * 3. Blocks execution until the approval is resolved
 *
 * In a CLI context, approval is simulated via interactive prompt.
 * In a production context, this would integrate with a notification system
 * or a dashboard that lets humans approve/reject.
 */

import { randomUUID } from 'node:crypto'
import type {
  ApprovalRecord,
  JobDefinition,
  WorkflowStep,
} from '../core/types.js'
import { ArtifactStore } from '../artifacts/artifact-store.js'

export interface ApprovalRequest {
  stepId: string
  requiredFor: string
  description?: string
}

export class ApprovalGate {
  constructor(private store: ArtifactStore) {}

  /**
   * Request a human approval for a step.
   * Returns the pending ApprovalRecord.
   */
  request(job: JobDefinition, req: ApprovalRequest): ApprovalRecord {
    const record: ApprovalRecord = {
      id: `approval-${randomUUID()}`,
      stepId: req.stepId,
      requiredFor: req.requiredFor,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      notes: req.description,
    }

    job.approvals.push(record)
    this.store.saveApprovals(job.squadId, job.id, job.approvals)
    return record
  }

  /**
   * Grant approval for a pending record.
   */
  grant(job: JobDefinition, approvalId: string, approvedBy?: string, notes?: string): boolean {
    const record = job.approvals.find((a) => a.id === approvalId)
    if (!record || record.status !== 'pending') return false

    record.status = 'approved'
    record.resolvedAt = new Date().toISOString()
    record.resolvedBy = approvedBy ?? 'human'
    if (notes) record.notes = notes

    this.store.saveApprovals(job.squadId, job.id, job.approvals)
    return true
  }

  /**
   * Reject a pending approval.
   */
  reject(job: JobDefinition, approvalId: string, rejectedBy?: string, notes?: string): boolean {
    const record = job.approvals.find((a) => a.id === approvalId)
    if (!record || record.status !== 'pending') return false

    record.status = 'rejected'
    record.resolvedAt = new Date().toISOString()
    record.resolvedBy = rejectedBy ?? 'human'
    if (notes) record.notes = notes

    this.store.saveApprovals(job.squadId, job.id, job.approvals)
    return true
  }

  /** Check whether a step has a granted approval */
  isApproved(job: JobDefinition, stepId: string): boolean {
    return job.approvals.some(
      (a) => a.stepId === stepId && a.status === 'approved',
    )
  }

  /** Check whether a step has a pending approval */
  isPending(job: JobDefinition, stepId: string): boolean {
    return job.approvals.some(
      (a) => a.stepId === stepId && a.status === 'pending',
    )
  }

  /** Check whether a step was rejected */
  isRejected(job: JobDefinition, stepId: string): boolean {
    return job.approvals.some(
      (a) => a.stepId === stepId && a.status === 'rejected',
    )
  }

  /**
   * Return the first pending approval for a given step, if any.
   */
  getPendingApproval(job: JobDefinition, step: WorkflowStep): ApprovalRecord | undefined {
    return job.approvals.find(
      (a) => a.stepId === step.id && a.status === 'pending',
    )
  }

  /**
   * Auto-approve all pending approvals for a step.
   * USE ONLY IN TESTS or explicitly automated contexts.
   */
  autoApprove(job: JobDefinition, stepId: string): void {
    for (const record of job.approvals) {
      if (record.stepId === stepId && record.status === 'pending') {
        record.status = 'approved'
        record.resolvedAt = new Date().toISOString()
        record.resolvedBy = 'auto-approved'
      }
    }
    this.store.saveApprovals(job.squadId, job.id, job.approvals)
  }
}

export function createApprovalGate(store: ArtifactStore): ApprovalGate {
  return new ApprovalGate(store)
}
