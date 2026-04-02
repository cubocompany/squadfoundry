/**
 * Integration test: Software Development Squad
 *
 * Tests the full squad runtime with the software-development squad config.
 * Uses stub host adapter — no real LLM calls.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { createSquadRuntime } from '../../orchestrator/runtime/squad-runtime.js'
import { ArtifactStore } from '../../orchestrator/artifacts/artifact-store.js'
import { LocalHostAdapter } from '../../orchestrator/adapters/host/local.adapter.js'
import type { SquadDefinition } from '../../orchestrator/core/types.js'

const TEST_DIR = '/tmp/sf-integration-sw'

// Minimal software-development squad for testing
const TEST_SQUAD: SquadDefinition = {
  id: 'test-software-dev',
  name: 'Test Software Dev Squad',
  domain: 'software-development',
  objective: 'Integration test squad',
  description: 'Test squad with two sequential steps',
  context: '',
  agents: [
    {
      id: 'agent-a',
      name: 'Agent A',
      role: 'Implementor',
      domain: 'software-development',
      objective: 'Implement',
      instructions: 'Do the implementation',
      inputs: [],
      outputs: [],
      allowedTools: [],
      constraints: [],
      successCriteria: [],
      failureCriteria: [],
      allowedStates: ['READY_FOR_EXECUTION', 'RUNNING_STEP'],
      blockingConditions: [],
      handoffRules: [{ condition: 'done', targetAgentId: 'agent-b', description: 'pass', requiresApproval: false }],
      responseFormat: 'markdown',
    },
    {
      id: 'agent-b',
      name: 'Agent B',
      role: 'Reviewer',
      domain: 'software-development',
      objective: 'Review',
      instructions: 'Review the work',
      inputs: [],
      outputs: [],
      allowedTools: [],
      constraints: [],
      successCriteria: [],
      failureCriteria: [],
      allowedStates: ['READY_FOR_EXECUTION', 'RUNNING_STEP'],
      blockingConditions: [],
      handoffRules: [],
      responseFormat: 'markdown',
    },
  ],
  workflow: {
    id: 'wf-test',
    name: 'Test Workflow',
    description: 'Two steps',
    entryStepId: 'step-a',
    steps: [
      {
        id: 'step-a',
        name: 'Step A',
        agentId: 'agent-a',
        description: 'First step',
        dependsOn: [],
        guardrails: [],
        requiresApprovalBefore: false,
        requiresApprovalAfter: false,
        requiredArtifacts: [],
        producedArtifacts: ['output-a'],
        nextStepId: 'step-b',
      },
      {
        id: 'step-b',
        name: 'Step B',
        agentId: 'agent-b',
        description: 'Second step',
        dependsOn: ['step-a'],
        guardrails: [],
        requiresApprovalBefore: false,
        requiresApprovalAfter: false,
        requiredArtifacts: [],
        producedArtifacts: ['output-b'],
      },
    ],
  },
  policy: {
    id: 'policy-test',
    name: 'Test Policy',
    description: '',
    guardrails: [],
    prohibitedActions: [],
    requiredApprovals: [],
  },
  expectedArtifacts: [],
  allowedIntegrations: [],
  templates: [],
  successCriteria: ['All steps completed'],
  failureCriteria: ['Any step fails'],
  metadata: {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['test'],
    hostCompatibility: ['any'],
  },
}

describe('Software Squad Integration', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  it('creates a job and advances through all steps', async () => {
    const hostAdapter = new LocalHostAdapter()
    await hostAdapter.initialize()

    const runtime = createSquadRuntime({
      artifactsDir: TEST_DIR,
      hostAdapter,
      contextRootPath: TEST_DIR,
    })

    const job = await runtime.startJob(TEST_SQUAD, 'Test objective', 'Implement feature X')

    expect(job.id).toMatch(/^job-/)
    expect(job.status).toBe('READY_FOR_EXECUTION')

    await runtime.runAll(TEST_SQUAD, job)

    // Both steps should have run — job should be COMPLETED
    expect(job.status).toBe('COMPLETED')
  })

  it('persists job state to disk', async () => {
    const hostAdapter = new LocalHostAdapter()
    await hostAdapter.initialize()

    const runtime = createSquadRuntime({
      artifactsDir: TEST_DIR,
      hostAdapter,
      contextRootPath: TEST_DIR,
    })

    const job = await runtime.startJob(TEST_SQUAD, 'Persist test', 'input')
    await runtime.runAll(TEST_SQUAD, job)

    const store = new ArtifactStore(TEST_DIR)
    const loaded = store.loadJob(TEST_SQUAD.id, job.id)

    expect(loaded).not.toBeNull()
    expect(loaded?.id).toBe(job.id)
    expect(loaded?.status).toBe('COMPLETED')
  })

  it('records history events', async () => {
    const hostAdapter = new LocalHostAdapter()
    await hostAdapter.initialize()

    const runtime = createSquadRuntime({
      artifactsDir: TEST_DIR,
      hostAdapter,
      contextRootPath: TEST_DIR,
    })

    const job = await runtime.startJob(TEST_SQUAD, 'History test', 'input')
    await runtime.runAll(TEST_SQUAD, job)

    expect(job.history.length).toBeGreaterThan(0)
    expect(job.history.some((e) => e.type === 'state_transition')).toBe(true)
  })

  it('blocks step requiring approval without it', async () => {
    const squadWithApproval: SquadDefinition = {
      ...TEST_SQUAD,
      id: 'test-approval-squad',
      workflow: {
        ...TEST_SQUAD.workflow,
        steps: [
          {
            ...TEST_SQUAD.workflow.steps[0]!,
            requiresApprovalBefore: true,
          },
          ...TEST_SQUAD.workflow.steps.slice(1),
        ],
      },
    }

    const hostAdapter = new LocalHostAdapter()
    await hostAdapter.initialize()

    const runtime = createSquadRuntime({
      artifactsDir: TEST_DIR,
      hostAdapter,
      contextRootPath: TEST_DIR,
    })

    const job = await runtime.startJob(squadWithApproval, 'Approval test', 'input')
    await runtime.runAll(squadWithApproval, job)

    expect(job.status).toBe('WAITING_APPROVAL')
    expect(job.approvals.some((a) => a.status === 'pending')).toBe(true)
  })

  it('lists jobs after execution', async () => {
    const hostAdapter = new LocalHostAdapter()
    await hostAdapter.initialize()

    const runtime = createSquadRuntime({
      artifactsDir: TEST_DIR,
      hostAdapter,
      contextRootPath: TEST_DIR,
    })

    const job = await runtime.startJob(TEST_SQUAD, 'List test', 'input')
    await runtime.runAll(TEST_SQUAD, job)

    const jobs = runtime.listJobs(TEST_SQUAD.id)
    expect(jobs).toContain(job.id)
  })
})
