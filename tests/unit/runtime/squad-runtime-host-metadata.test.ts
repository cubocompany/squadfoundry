import { describe, expect, it } from 'vitest'
import { rmSync } from 'node:fs'

import type {
  AgentDefinition,
  AgentResponse,
  JobDefinition,
  PromptOptions,
  SquadDefinition,
  WorkflowStep,
} from '../../../orchestrator/index.js'
import { createSquadRuntime } from '../../../orchestrator/runtime/squad-runtime.js'
import type {
  HostCapabilities,
  HostDetectionContext,
  HostDetectionResult,
  InterviewTurnInput,
  InterviewTurnResult,
  InterviewTurnState,
  IHostAdapter,
} from '../../../orchestrator/adapters/host/IHostAdapter.js'

const TEST_DIR = '/tmp/sf-runtime-host-metadata'

class CapturingHostAdapter implements IHostAdapter {
  readonly id = 'capture'
  readonly name = 'Capture Adapter'
  public lastOptions: PromptOptions | undefined

  detect(_context: HostDetectionContext): HostDetectionResult {
    return { isDetected: true, confidence: 'high', reasons: ['test'] }
  }

  async initialize(): Promise<void> {
    // no-op
  }

  async runInterviewTurn(_input: InterviewTurnInput, _state: InterviewTurnState): Promise<InterviewTurnResult> {
    return { content: 'ok', status: 'continue' }
  }

  async getActiveModel(): Promise<string | null> {
    return 'test-model'
  }

  async sendPrompt(
    _prompt: string,
    agent: AgentDefinition,
    job: JobDefinition,
    step: WorkflowStep,
    options?: PromptOptions,
  ): Promise<AgentResponse> {
    this.lastOptions = options
    return {
      agentId: agent.id,
      stepId: step.id,
      jobId: job.id,
      content: 'ok',
      artifacts: [],
      status: 'success',
    }
  }

  getCapabilities(): HostCapabilities {
    return {
      supportsStreaming: false,
      supportsToolUse: false,
      supportsVision: false,
      maxContextTokens: 1024,
      supportedModels: ['test-model'],
    }
  }

  async healthCheck(): Promise<boolean> {
    return true
  }
}

const SQUAD: SquadDefinition = {
  id: 'meta-test',
  name: 'Metadata Test Squad',
  domain: 'software-development',
  objective: 'Verify runtime metadata passthrough',
  description: '',
  context: '',
  agents: [
    {
      id: 'agent-a',
      name: 'Agent A',
      role: 'Role A',
      domain: 'software-development',
      objective: 'Do work',
      instructions: 'respond',
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
    id: 'wf-meta-test',
    name: 'Workflow',
    description: '',
    entryStepId: 'step-a',
    steps: [
      {
        id: 'step-a',
        name: 'Step A',
        agentId: 'agent-a',
        description: '',
        dependsOn: [],
        guardrails: [],
        requiresApprovalBefore: false,
        requiresApprovalAfter: false,
        requiredArtifacts: [],
        producedArtifacts: [],
      },
    ],
  },
  policy: {
    id: 'policy',
    name: 'policy',
    description: '',
    guardrails: [],
    prohibitedActions: [],
    requiredApprovals: [],
  },
  expectedArtifacts: [],
  allowedIntegrations: [],
  templates: [],
  successCriteria: [],
  failureCriteria: [],
  metadata: {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    hostCompatibility: ['any'],
  },
}

describe('SquadRuntime host metadata', () => {
  it('passes allowedAgentIds metadata to host adapter', async () => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    const hostAdapter = new CapturingHostAdapter()
    const runtime = createSquadRuntime({
      artifactsDir: TEST_DIR,
      hostAdapter,
      contextRootPath: TEST_DIR,
    })

    const job = await runtime.startJob(SQUAD, 'meta objective', 'meta input')
    await runtime.runAll(SQUAD, job)

    const allowedAgentIds = hostAdapter.lastOptions?.metadata?.['allowedAgentIds'] as string[]
    expect(allowedAgentIds).toEqual(['agent-a'])
  })
})
