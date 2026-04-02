/**
 * OpenAIHostAdapter — Stub
 *
 * Adapter for running agents via the OpenAI Chat Completions API.
 * Supports GPT-4o, GPT-4o-mini, o1, o3 models.
 *
 * STATUS: STUB — interface is complete, but sendPrompt returns a mock response.
 * To activate: set OPENAI_API_KEY and implement the API call below.
 */

import type {
  IHostAdapter,
  PromptOptions,
  HostCapabilities,
  HostDetectionContext,
  HostDetectionResult,
  InterviewTurnInput,
  InterviewTurnState,
  InterviewTurnResult,
} from './IHostAdapter.js'
import type { AgentDefinition, AgentResponse, JobDefinition, WorkflowStep } from '../../core/types.js'

export class OpenAIHostAdapter implements IHostAdapter {
  readonly id = 'openai'
  readonly name = 'OpenAI (API)'

  private apiKey: string | undefined
  private defaultModel: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env['OPENAI_API_KEY']
    this.defaultModel = process.env['OPENAI_MODEL'] ?? 'gpt-4o'
  }

  detect(context: HostDetectionContext): HostDetectionResult {
    const env = context.env ?? process.env
    const hasApiKey = Boolean(env['OPENAI_API_KEY'])
    return {
      isDetected: hasApiKey,
      confidence: hasApiKey ? 'medium' : 'low',
      reasons: hasApiKey ? ['Detected OPENAI_API_KEY in environment'] : [],
    }
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      console.warn('[OpenAIHostAdapter] OPENAI_API_KEY not set — running in stub mode')
    }
  }

  async runInterviewTurn(input: InterviewTurnInput, _state: InterviewTurnState): Promise<InterviewTurnResult> {
    return {
      content: input.prompt,
      status: 'continue',
      metadata: { host: this.id, model: this.defaultModel, stub: true },
    }
  }

  async getActiveModel(): Promise<string | null> {
    return this.defaultModel
  }

  async sendPrompt(
    prompt: string,
    agent: AgentDefinition,
    job: JobDefinition,
    step: WorkflowStep,
    options?: PromptOptions,
  ): Promise<AgentResponse> {
    // STUB: Replace with real OpenAI SDK call
    // Example real implementation:
    // const client = new OpenAI({ apiKey: this.apiKey })
    // const completion = await client.chat.completions.create({ model: options?.model ?? 'gpt-4o', ... })
    console.log(`[OpenAIHostAdapter][STUB] sendPrompt — agent=${agent.id}, step=${step.id}`)
    console.log(`[OpenAIHostAdapter][STUB] Prompt: ${prompt.slice(0, 100)}...`)

    return {
      agentId: agent.id,
      stepId: step.id,
      jobId: job.id,
      content: `[STUB] OpenAI response for agent '${agent.name}' at step '${step.name}'. Configure OPENAI_API_KEY and replace stub.`,
      artifacts: [],
      status: 'success',
      metadata: { stub: true, model: options?.model ?? 'gpt-4o' },
    }
  }

  getCapabilities(): HostCapabilities {
    return {
      supportsStreaming: true,
      supportsToolUse: true,
      supportsVision: true,
      maxContextTokens: 128000,
      supportedModels: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('[OpenAIHostAdapter] Health check failed — no API key')
      return false
    }
    return true
  }
}
