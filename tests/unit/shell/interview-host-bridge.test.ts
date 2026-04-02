import { describe, expect, it } from 'vitest'

import type {
  HostCapabilities,
  HostDetectionContext,
  HostDetectionResult,
  IHostAdapter,
  InterviewTurnInput,
  InterviewTurnResult,
  InterviewTurnState,
  PromptOptions,
} from '../../../orchestrator/adapters/host/IHostAdapter.js'
import type { AgentDefinition, AgentResponse, JobDefinition, WorkflowStep } from '../../../orchestrator/core/types.js'
import { InterviewHostBridgeService } from '../../../orchestrator/shell/services/interview-host-bridge.service.js'

class MockInterviewHostAdapter implements IHostAdapter {
  readonly id = 'mock'
  readonly name = 'Mock Host'
  public lastInterviewInput: InterviewTurnInput | null = null

  detect(_context: HostDetectionContext): HostDetectionResult {
    return { isDetected: true, confidence: 'high', reasons: ['mock'] }
  }

  async initialize(): Promise<void> {}

  async runInterviewTurn(input: InterviewTurnInput, _state: InterviewTurnState): Promise<InterviewTurnResult> {
    this.lastInterviewInput = input
    return { content: `asked:${input.prompt}`, status: 'continue' }
  }

  async getActiveModel(): Promise<string | null> {
    return 'mock-model'
  }

  async sendPrompt(
    _prompt: string,
    _agent: AgentDefinition,
    _job: JobDefinition,
    _step: WorkflowStep,
    _options?: PromptOptions,
  ): Promise<AgentResponse> {
    return {
      agentId: 'a',
      stepId: 's',
      jobId: 'j',
      content: '',
      artifacts: [],
      status: 'success',
    }
  }

  getCapabilities(): HostCapabilities {
    return {
      supportsStreaming: false,
      supportsToolUse: false,
      supportsVision: false,
      maxContextTokens: 0,
      supportedModels: [],
    }
  }

  async healthCheck(): Promise<boolean> {
    return true
  }
}

describe('InterviewHostBridgeService', () => {
  it('uses resolved host adapter for interview turns', async () => {
    const bridge = new InterviewHostBridgeService()
    const host = new MockInterviewHostAdapter()

    const result = await bridge.nextTurn(host, { prompt: 'question?' }, { turnCount: 1, history: [] })

    expect(host.lastInterviewInput?.prompt).toBe('question?')
    expect(result.content).toContain('asked:question?')
    expect(result.activeModel).toBe('mock-model')
  })

  it('stores host-default when host does not expose active model', async () => {
    const bridge = new InterviewHostBridgeService()
    const host = new MockInterviewHostAdapter()
    host.getActiveModel = async () => null

    const result = await bridge.nextTurn(host, { prompt: 'question?' }, { turnCount: 1, history: [] })
    expect(result.activeModel).toBe('host-default')
  })
})
