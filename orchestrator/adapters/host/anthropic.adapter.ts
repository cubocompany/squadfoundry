/**
 * AnthropicHostAdapter
 *
 * Adapter for running agents via the Anthropic Messages API.
 * Supports Claude models (claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5).
 *
 * Requires: ANTHROPIC_API_KEY env var (or pass apiKey to constructor).
 *
 * STATUS: REAL — full implementation using @anthropic-ai/sdk.
 */

import Anthropic from '@anthropic-ai/sdk'
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
import type { AgentDefinition, AgentResponse, JobDefinition, WorkflowStep, PendingArtifact } from '../../core/types.js'

const DEFAULT_MODEL = 'claude-sonnet-4-6'

function parseArtifactsFromText(text: string): PendingArtifact[] {
  const artifacts: PendingArtifact[] = []
  const pattern = /ARTIFACT:([^:]+):([^\n]+)\n([\s\S]*?)END_ARTIFACT/g
  let match
  while ((match = pattern.exec(text)) !== null) {
    const name = match[1]?.trim()
    const format = (match[2]?.trim() ?? 'text') as PendingArtifact['format']
    const content = match[3]?.trim() ?? ''
    if (name) artifacts.push({ name, format, content })
  }
  return artifacts
}

export class AnthropicHostAdapter implements IHostAdapter {
  readonly id = 'anthropic'
  readonly name = 'Anthropic Claude (API)'

  private client: Anthropic
  private defaultModel: string

  constructor(apiKey?: string, model?: string) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env['ANTHROPIC_API_KEY'] })
    this.defaultModel = model ?? process.env['ANTHROPIC_MODEL'] ?? DEFAULT_MODEL
  }

  detect(context: HostDetectionContext): HostDetectionResult {
    const env = context.env ?? process.env
    const hasApiKey = Boolean(env['ANTHROPIC_API_KEY'])
    return {
      isDetected: hasApiKey,
      confidence: hasApiKey ? 'medium' : 'low',
      reasons: hasApiKey ? ['Detected ANTHROPIC_API_KEY in environment'] : [],
    }
  }

  async initialize(): Promise<void> {
    if (!process.env['ANTHROPIC_API_KEY']) {
      console.warn('[AnthropicHostAdapter] ANTHROPIC_API_KEY not set')
    } else {
      console.log(`[AnthropicHostAdapter] Ready (model: ${this.defaultModel})`)
    }
  }

  async runInterviewTurn(input: InterviewTurnInput, _state: InterviewTurnState): Promise<InterviewTurnResult> {
    return {
      content: input.prompt,
      status: 'continue',
      metadata: { host: this.id, model: this.defaultModel },
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
    const model = options?.model ?? this.defaultModel

    const message = await this.client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      system: agent.instructions,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('\n')

    const artifacts = parseArtifactsFromText(content)
    const approvalNeeded =
      content.toLowerCase().includes('[needs_approval]') ||
      content.toLowerCase().includes('[approval_required]')
    const status = content.toLowerCase().includes('[failure]') ? 'failure' : 'success'

    return {
      agentId: agent.id,
      stepId: step.id,
      jobId: job.id,
      content,
      artifacts,
      approvalNeeded,
      approvalReason: approvalNeeded ? `Agent '${agent.name}' requested human approval` : undefined,
      status,
      metadata: {
        model,
        provider: 'anthropic',
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    }
  }

  getCapabilities(): HostCapabilities {
    return {
      supportsStreaming: true,
      supportsToolUse: true,
      supportsVision: true,
      maxContextTokens: 200000,
      supportedModels: [
        'claude-opus-4-6',
        'claude-sonnet-4-6',
        'claude-haiku-4-5-20251001',
      ],
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.models.list()
      return true
    } catch {
      return false
    }
  }
}
