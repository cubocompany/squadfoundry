/**
 * Integration test: Instagram Content Squad
 *
 * Proves that the platform is domain-agnostic.
 * Uses a minimal Instagram-style squad config with stub adapters.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { createSquadRuntime } from '../../orchestrator/runtime/squad-runtime.js'
import { ArtifactStore } from '../../orchestrator/artifacts/artifact-store.js'
import { LocalHostAdapter } from '../../orchestrator/adapters/host/local.adapter.js'
import { createSquadBuilder } from '../../orchestrator/builder/squad-builder.js'
import type { SquadDefinition, InterviewAnswer } from '../../orchestrator/core/types.js'

const TEST_DIR = '/tmp/sf-integration-ig'

// Minimal Instagram squad for testing (no publish gate to allow full run)
const INSTAGRAM_SQUAD: SquadDefinition = {
  id: 'test-instagram',
  name: 'Test Instagram Squad',
  domain: 'social-media',
  objective: 'Create and publish Instagram content',
  description: 'Test instagram squad with copywriting and review steps',
  context: '',
  agents: [
    {
      id: 'strategy-agent',
      name: 'Strategy Agent',
      role: 'Strategist',
      domain: 'social-media',
      objective: 'Define strategy',
      instructions: 'Create a content strategy',
      inputs: [],
      outputs: [],
      allowedTools: [],
      constraints: [],
      successCriteria: [],
      failureCriteria: [],
      allowedStates: ['READY_FOR_EXECUTION', 'RUNNING_STEP'],
      blockingConditions: [],
      handoffRules: [{ condition: 'done', targetAgentId: 'copy-agent', description: 'pass', requiresApproval: false }],
      responseFormat: 'markdown',
    },
    {
      id: 'copy-agent',
      name: 'Copy Agent',
      role: 'Copywriter',
      domain: 'social-media',
      objective: 'Write caption',
      instructions: 'Write an Instagram caption',
      inputs: [],
      outputs: [],
      allowedTools: [],
      constraints: ['Max 2200 characters', 'Max 30 hashtags'],
      successCriteria: [],
      failureCriteria: [],
      allowedStates: ['READY_FOR_EXECUTION', 'RUNNING_STEP'],
      blockingConditions: [],
      handoffRules: [],
      responseFormat: 'markdown',
    },
  ],
  workflow: {
    id: 'wf-instagram-test',
    name: 'Instagram Test Workflow',
    description: 'Simplified instagram workflow',
    entryStepId: 'step-strategy',
    steps: [
      {
        id: 'step-strategy',
        name: 'Strategy',
        agentId: 'strategy-agent',
        description: 'Define content strategy',
        dependsOn: [],
        guardrails: [],
        requiresApprovalBefore: false,
        requiresApprovalAfter: false,
        requiredArtifacts: [],
        producedArtifacts: ['strategy_brief'],
        nextStepId: 'step-copy',
      },
      {
        id: 'step-copy',
        name: 'Copywriting',
        agentId: 'copy-agent',
        description: 'Write caption',
        dependsOn: ['step-strategy'],
        guardrails: [],
        requiresApprovalBefore: false,
        requiresApprovalAfter: false,
        requiredArtifacts: [],
        producedArtifacts: ['caption_draft'],
      },
    ],
  },
  policy: {
    id: 'policy-instagram-test',
    name: 'Test Instagram Policy',
    description: '',
    guardrails: [],
    prohibitedActions: ['Auto-publish without human approval'],
    requiredApprovals: [{ action: 'publish', description: 'Human must approve' }],
  },
  expectedArtifacts: [
    { id: 'a1', name: 'Caption', description: 'Instagram caption', path: 'outputs/caption.md', required: true, format: 'markdown' },
  ],
  allowedIntegrations: [
    { id: 'instagram', type: 'social-media', name: 'Instagram', required: false, status: 'stub' },
  ],
  templates: [],
  successCriteria: ['Caption created and approved'],
  failureCriteria: ['Caption creation failed'],
  metadata: {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['social-media', 'instagram', 'test'],
    hostCompatibility: ['any'],
  },
}

describe('Instagram Squad Integration', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  it('runs a two-step content workflow to completion', async () => {
    const hostAdapter = new LocalHostAdapter()
    await hostAdapter.initialize()

    const runtime = createSquadRuntime({
      artifactsDir: TEST_DIR,
      hostAdapter,
      contextRootPath: TEST_DIR,
    })

    const job = await runtime.startJob(INSTAGRAM_SQUAD, 'Create summer campaign post', 'Post about our summer sale')
    await runtime.runAll(INSTAGRAM_SQUAD, job)

    expect(job.status).toBe('COMPLETED')
  })

  it('persists artifacts from both steps', async () => {
    const hostAdapter = new LocalHostAdapter()
    await hostAdapter.initialize()

    const runtime = createSquadRuntime({
      artifactsDir: TEST_DIR,
      hostAdapter,
      contextRootPath: TEST_DIR,
    })

    const job = await runtime.startJob(INSTAGRAM_SQUAD, 'Test campaign', 'New product launch')
    await runtime.runAll(INSTAGRAM_SQUAD, job)

    const store = new ArtifactStore(TEST_DIR)
    const loaded = store.loadJob(INSTAGRAM_SQUAD.id, job.id)

    expect(loaded?.status).toBe('COMPLETED')
  })

  it('squad domain is social-media, not software-development', () => {
    expect(INSTAGRAM_SQUAD.domain).toBe('social-media')
    expect(INSTAGRAM_SQUAD.domain).not.toBe('software-development')
  })

  it('policy prohibits auto-publishing', () => {
    const prohibited = INSTAGRAM_SQUAD.policy.prohibitedActions
    expect(prohibited.some((a) => a.toLowerCase().includes('publish'))).toBe(true)
  })

  it('requires human approval for publishing', () => {
    const required = INSTAGRAM_SQUAD.policy.requiredApprovals
    expect(required.some((r) => r.action === 'publish')).toBe(true)
  })

  it('generates instagram squad from builder interview', () => {
    const builder = createSquadBuilder({ contextRootPath: TEST_DIR, outputDir: TEST_DIR })
    const answers: InterviewAnswer[] = [
      { questionId: 'q_objective', answer: 'Automate Instagram content creation' },
      { questionId: 'q_domain', answer: '3' },
      { questionId: 'q_description', answer: 'Squad for creating, reviewing, and publishing Instagram posts' },
      { questionId: 'q_inputs', answer: 'Campaign brief or topic' },
      { questionId: 'q_outputs', answer: 'Published Instagram post' },
      { questionId: 'q_steps', answer: '1. Strategy, 2. Research, 3. Write, 4. Review, 5. Approve, 6. Publish' },
      { questionId: 'q_approvals', answer: 'Publishing always requires human approval' },
      { questionId: 'q_human_in_loop', answer: 'Never auto-publish' },
      { questionId: 'q_tools', answer: 'Instagram Graph API' },
      { questionId: 'q_squad_name', answer: 'my-instagram-squad' },
    ]

    const result = builder.conductInterview(answers)

    expect(result.squadDefinition.domain).toBe('social-media')
    expect(result.squadDefinition.id).toBe('my-instagram-squad')
    expect(result.squadDefinition.agents.length).toBeGreaterThan(0)

    const hasPublishGuardrail = result.squadDefinition.policy.guardrails.some(
      (g) => g.ruleKey === 'require_approval_before_publish',
    )
    expect(hasPublishGuardrail).toBe(true)
  })
})
