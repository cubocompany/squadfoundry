/**
 * LocalHostAdapter — Stub
 *
 * Adapter for running agents via a locally hosted LLM (Ollama, LM Studio,
 * llama.cpp OpenAI-compatible endpoint, etc.).
 *
 * STATUS: STUB — sends a mock response.
 * To activate: configure LOCAL_LLM_BASE_URL and implement the HTTP call.
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

export class LocalHostAdapter implements IHostAdapter {
  readonly id = 'local'
  readonly name = 'Local LLM (Ollama / llama.cpp compatible)'

  private baseUrl: string
  private defaultModel: string

  constructor(baseUrl?: string, defaultModel?: string) {
    this.baseUrl = baseUrl ?? process.env['LOCAL_LLM_BASE_URL'] ?? 'http://localhost:11434'
    this.defaultModel = defaultModel ?? process.env['LOCAL_LLM_MODEL'] ?? 'llama3.2'
  }

  detect(context: HostDetectionContext): HostDetectionResult {
    const env = context.env ?? process.env
    const hasLocalSignal = Boolean(env['LOCAL_LLM_BASE_URL'] || env['LOCAL_LLM_MODEL'])
    return {
      isDetected: hasLocalSignal,
      confidence: hasLocalSignal ? 'medium' : 'low',
      reasons: hasLocalSignal ? ['Detected LOCAL_LLM_* environment variables'] : [],
    }
  }

  async initialize(): Promise<void> {
    console.log(`[LocalHostAdapter] Connecting to local LLM at ${this.baseUrl}`)
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
    // STUB: Replace with real HTTP call to local LLM
    // Example (Ollama):
    // const res = await fetch(`${this.baseUrl}/api/generate`, {
    //   method: 'POST',
    //   body: JSON.stringify({ model: options?.model ?? this.defaultModel, prompt })
    // })
    const model = options?.model ?? this.defaultModel
    console.log(`[LocalHostAdapter][STUB] sendPrompt — agent=${agent.id}, model=${model}, step=${step.id}, prompt_len=${prompt.length}`)

    return {
      agentId: agent.id,
      stepId: step.id,
      jobId: job.id,
      content: `[STUB] Local LLM response for agent '${agent.name}' at step '${step.name}'. Configure LOCAL_LLM_BASE_URL and replace stub.`,
      artifacts: [],
      status: 'success',
      metadata: { stub: true, model, baseUrl: this.baseUrl },
    }
  }

  getCapabilities(): HostCapabilities {
    return {
      supportsStreaming: true,
      supportsToolUse: false,
      supportsVision: false,
      maxContextTokens: 32768,
      supportedModels: [this.defaultModel],
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // STUB: Replace with real connectivity check
      // const res = await fetch(`${this.baseUrl}/api/tags`)
      // return res.ok
      console.log(`[LocalHostAdapter] Would check connectivity to ${this.baseUrl}`)
      return true
    } catch {
      return false
    }
  }
}
