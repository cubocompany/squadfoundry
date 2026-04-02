import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { ArtifactStore } from '../../orchestrator/artifacts/artifact-store.js'
import type { JobDefinition, HandoffEvent, HistoryEntry } from '../../orchestrator/core/types.js'

const TEST_DIR = '/tmp/squadfoundry-test-artifacts'

function makeJob(): JobDefinition {
  return {
    id: 'job-test-001',
    squadId: 'squad-test',
    status: 'RUNNING_STEP',
    objective: 'Test job',
    initialInput: 'test',
    loadedContext: { docs: [], specs: [], playbooks: [], policies: [], templates: [], custom: [] },
    artifacts: [],
    approvals: [],
    currentStepId: 'step-1',
    currentAgentId: 'agent-1',
    history: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('ArtifactStore', () => {
  let store: ArtifactStore

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
    store = new ArtifactStore(TEST_DIR)
  })

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  it('saves and loads a job', () => {
    const job = makeJob()
    store.saveJob(job)
    const loaded = store.loadJob('squad-test', 'job-test-001')
    expect(loaded).not.toBeNull()
    expect(loaded?.id).toBe('job-test-001')
    expect(loaded?.status).toBe('RUNNING_STEP')
  })

  it('returns null for missing jobs', () => {
    const loaded = store.loadJob('nonexistent', 'job-x')
    expect(loaded).toBeNull()
  })

  it('lists jobs for a squad', () => {
    const job = makeJob()
    store.saveJob(job)
    const list = store.listJobs('squad-test')
    expect(list).toContain('job-test-001')
  })

  it('returns empty list for squad with no jobs', () => {
    const list = store.listJobs('empty-squad')
    expect(list).toHaveLength(0)
  })

  it('appends and loads handoffs', () => {
    const job = makeJob()
    store.saveJob(job)

    const handoff: HandoffEvent = {
      id: 'handoff-1',
      jobId: job.id,
      fromAgentId: 'agent-a',
      toAgentId: 'agent-b',
      fromStepId: 'step-1',
      toStepId: 'step-2',
      condition: 'complete',
      payload: { summary: 'done', artifacts: [] },
      timestamp: new Date().toISOString(),
      requiresApproval: false,
      approved: true,
    }

    store.appendHandoff('squad-test', 'job-test-001', handoff)
    const loaded = store.loadHandoffs('squad-test', 'job-test-001')
    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.id).toBe('handoff-1')
  })

  it('appends multiple events', () => {
    const job = makeJob()
    store.saveJob(job)

    const event1: HistoryEntry = {
      timestamp: new Date().toISOString(),
      type: 'info',
      message: 'Event 1',
    }
    const event2: HistoryEntry = {
      timestamp: new Date().toISOString(),
      type: 'state_transition',
      message: 'Event 2',
      fromStatus: 'RUNNING_STEP',
      toStatus: 'COMPLETED',
    }

    store.appendEvent('squad-test', 'job-test-001', event1)
    store.appendEvent('squad-test', 'job-test-001', event2)

    const events = store.loadEvents('squad-test', 'job-test-001')
    expect(events).toHaveLength(2)
  })

  it('saves and loads approvals', () => {
    const job = makeJob()
    store.saveJob(job)

    store.saveApprovals('squad-test', 'job-test-001', [
      {
        id: 'approval-1',
        stepId: 'step-deploy',
        requiredFor: 'deploy',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      },
    ])

    const approvals = store.loadApprovals('squad-test', 'job-test-001')
    expect(approvals).toHaveLength(1)
    expect(approvals[0]?.status).toBe('pending')
  })

  it('persists an artifact and returns a ref', () => {
    const job = makeJob()
    store.saveJob(job)

    const ref = store.persistArtifact(
      'squad-test',
      'job-test-001',
      { name: 'prd', content: '# PRD Content', format: 'markdown' },
      'product-agent',
      'step-product',
    )

    expect(ref.name).toBe('prd')
    expect(ref.path).toContain('prd')
    expect(ref.producedByAgentId).toBe('product-agent')
    expect(existsSync(ref.path)).toBe(true)
  })

  it('lists artifacts in the outputs directory', () => {
    const job = makeJob()
    store.saveJob(job)

    store.persistArtifact('squad-test', 'job-test-001', { name: 'doc1', content: 'c1', format: 'text' }, 'a', 's')
    store.persistArtifact('squad-test', 'job-test-001', { name: 'doc2', content: 'c2', format: 'text' }, 'a', 's')

    const list = store.listArtifacts('squad-test', 'job-test-001')
    expect(list.length).toBe(2)
  })

  it('saves a report to the reports directory', () => {
    const job = makeJob()
    store.saveJob(job)

    const path = store.saveReport('squad-test', 'job-test-001', 'final-report', '# Final Report\nAll done.')
    expect(existsSync(path)).toBe(true)
    expect(path).toContain('final-report.md')
  })
})
