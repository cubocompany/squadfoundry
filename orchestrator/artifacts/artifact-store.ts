/**
 * ArtifactStore
 *
 * Filesystem-based artifact persistence for squad jobs.
 * All job state, handoffs, events, outputs, and approvals are stored
 * as human-readable JSON/Markdown files under:
 *
 *   artifacts/<squad_id>/<job_id>/
 *     state.json
 *     handoffs.json
 *     events.json
 *     approvals.json
 *     outputs/
 *     reports/
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

import type {
  JobDefinition,
  HandoffEvent,
  HistoryEntry,
  ApprovalRecord,
  ArtifactRef,
  PendingArtifact,
  JobId,
  SquadId,
  AgentId,
  StepId,
} from '../core/types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────────────────

export class ArtifactStore {
  private baseDir: string

  constructor(baseDir = 'artifacts') {
    this.baseDir = baseDir
  }

  private jobDir(squadId: SquadId, jobId: JobId): string {
    return join(this.baseDir, squadId, jobId)
  }

  private ensureDir(path: string): void {
    mkdirSync(path, { recursive: true })
  }

  private write(path: string, data: unknown): void {
    this.ensureDir(dirname(path))
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
  }

  private read<T>(path: string): T | null {
    if (!existsSync(path)) return null
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as T
    } catch {
      return null
    }
  }

  // ─── Job State ─────────────────────────────────────────────────────────────

  /** Persist the full job state */
  saveJob(job: JobDefinition): void {
    const path = join(this.jobDir(job.squadId, job.id), 'state.json')
    this.write(path, job)
  }

  /** Load a job state from disk */
  loadJob(squadId: SquadId, jobId: JobId): JobDefinition | null {
    return this.read(join(this.jobDir(squadId, jobId), 'state.json'))
  }

  /** List all job IDs for a squad */
  listJobs(squadId: SquadId): JobId[] {
    const squadPath = join(this.baseDir, squadId)
    if (!existsSync(squadPath)) return []
    return readdirSync(squadPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  }

  // ─── Handoffs ──────────────────────────────────────────────────────────────

  appendHandoff(squadId: SquadId, jobId: JobId, handoff: HandoffEvent): void {
    const path = join(this.jobDir(squadId, jobId), 'handoffs.json')
    const existing = this.read<HandoffEvent[]>(path) ?? []
    existing.push(handoff)
    this.write(path, existing)
  }

  loadHandoffs(squadId: SquadId, jobId: JobId): HandoffEvent[] {
    return this.read(join(this.jobDir(squadId, jobId), 'handoffs.json')) ?? []
  }

  // ─── Events / History ──────────────────────────────────────────────────────

  appendEvent(squadId: SquadId, jobId: JobId, event: HistoryEntry): void {
    const path = join(this.jobDir(squadId, jobId), 'events.json')
    const existing = this.read<HistoryEntry[]>(path) ?? []
    existing.push(event)
    this.write(path, existing)
  }

  loadEvents(squadId: SquadId, jobId: JobId): HistoryEntry[] {
    return this.read(join(this.jobDir(squadId, jobId), 'events.json')) ?? []
  }

  // ─── Approvals ─────────────────────────────────────────────────────────────

  saveApprovals(squadId: SquadId, jobId: JobId, approvals: ApprovalRecord[]): void {
    const path = join(this.jobDir(squadId, jobId), 'approvals.json')
    this.write(path, approvals)
  }

  loadApprovals(squadId: SquadId, jobId: JobId): ApprovalRecord[] {
    return this.read(join(this.jobDir(squadId, jobId), 'approvals.json')) ?? []
  }

  // ─── Artifact Outputs ──────────────────────────────────────────────────────

  /**
   * Persist a pending artifact (content produced by an agent) to disk.
   * Returns an ArtifactRef that can be stored in the job.
   */
  persistArtifact(
    squadId: SquadId,
    jobId: JobId,
    artifact: PendingArtifact,
    agentId: AgentId,
    stepId: StepId,
  ): ArtifactRef {
    const ext = artifact.format === 'json' ? 'json' : artifact.format === 'markdown' ? 'md' : 'txt'
    const safeName = artifact.name.replace(/[^a-zA-Z0-9_-]/g, '_')
    const fileName = `${safeName}.${ext}`
    const outputPath = join(this.jobDir(squadId, jobId), 'outputs', fileName)

    this.ensureDir(dirname(outputPath))
    writeFileSync(outputPath, artifact.content, 'utf-8')

    const ref: ArtifactRef = {
      id: `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: artifact.name,
      path: outputPath,
      producedByAgentId: agentId,
      producedAtStepId: stepId,
      format: artifact.format,
      createdAt: new Date().toISOString(),
    }

    return ref
  }

  /** Save a Markdown report to artifacts/<squad_id>/<job_id>/reports/ */
  saveReport(squadId: SquadId, jobId: JobId, name: string, content: string): string {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_')
    const path = join(this.jobDir(squadId, jobId), 'reports', `${safeName}.md`)
    this.ensureDir(dirname(path))
    writeFileSync(path, content, 'utf-8')
    return path
  }

  /** List all artifact refs from the job's outputs directory */
  listArtifacts(squadId: SquadId, jobId: JobId): string[] {
    const outputDir = join(this.jobDir(squadId, jobId), 'outputs')
    if (!existsSync(outputDir)) return []
    return readdirSync(outputDir)
  }
}

export function createArtifactStore(baseDir?: string): ArtifactStore {
  return new ArtifactStore(baseDir)
}
