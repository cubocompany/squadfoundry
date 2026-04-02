/**
 * AntigravityHostAdapter
 *
 * Adapter para o Google Antigravity IDE.
 *
 * O Antigravity expõe uma API OpenAI-compatible localmente na porta 8045,
 * o que significa que qualquer código rodando no projeto pode chamar o modelo
 * que já está ativo na IDE — sem API key externa, sem custo adicional.
 *
 * Endpoint local: http://localhost:8045/v1/chat/completions
 *
 * O Antigravity suporta múltiplos modelos (Gemini 3 Pro, Claude, OpenAI).
 * O modelo ativo no momento da chamada é usado automaticamente.
 *
 * STATUS: REAL — funciona quando o Antigravity está aberto com o projeto.
 *
 * Uso:
 *   import { AntigravityHostAdapter, createSquadRuntime } from 'squadfoundry'
 *   const runtime = createSquadRuntime({ hostAdapter: new AntigravityHostAdapter() })
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
import type { AgentDefinition, AgentResponse, JobDefinition, WorkflowStep, PendingArtifact } from '../../core/types.js'

const ANTIGRAVITY_BASE_URL = 'http://localhost:8045'
const DEFAULT_MODEL = 'gemini-3-pro' // modelo padrão no Antigravity

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

export interface AntigravityAdapterOptions {
  /**
   * URL base do Antigravity.
   * Padrão: http://localhost:8045
   */
  baseUrl?: string
  /**
   * Modelo a usar. O Antigravity suporta:
   * - 'gemini-3-pro' (padrão)
   * - 'gemini-3-flash'
   * - 'claude-sonnet-4-5'
   * - 'claude-opus-4'
   * - 'gpt-4o'
   */
  model?: string
}

export class AntigravityHostAdapter implements IHostAdapter {
  readonly id = 'antigravity'
  readonly name = 'Google Antigravity IDE (port 8045)'

  private baseUrl: string
  private model: string

  constructor(options: AntigravityAdapterOptions = {}) {
    this.baseUrl = options.baseUrl ?? process.env['ANTIGRAVITY_URL'] ?? ANTIGRAVITY_BASE_URL
    this.model = options.model ?? process.env['ANTIGRAVITY_MODEL'] ?? DEFAULT_MODEL
  }

  detect(context: HostDetectionContext): HostDetectionResult {
    const argv = (context.argv ?? process.argv).map((item) => item.toLowerCase())
    const env = context.env ?? process.env
    const hasArgvSignal = argv.some((item) => item.includes('antigravity'))
    const hasEnvSignal = Boolean(env['ANTIGRAVITY_URL'] || env['ANTIGRAVITY'])
    const isDetected = hasArgvSignal || hasEnvSignal

    return {
      isDetected,
      confidence: hasArgvSignal ? 'high' : isDetected ? 'medium' : 'low',
      reasons: isDetected
        ? [hasArgvSignal ? 'Detected antigravity argv signal' : 'Detected ANTIGRAVITY_* environment signal']
        : [],
    }
  }

  async initialize(): Promise<void> {
    const ok = await this.healthCheck()
    if (!ok) {
      console.warn(
        `[AntigravityHostAdapter] Não foi possível conectar em ${this.baseUrl}\n` +
        `  Verifique se o Antigravity está aberto com o projeto.`,
      )
    } else {
      console.log(`[AntigravityHostAdapter] Conectado ao Antigravity em ${this.baseUrl} (modelo: ${this.model})`)
    }
  }

  async runInterviewTurn(input: InterviewTurnInput, _state: InterviewTurnState): Promise<InterviewTurnResult> {
    return {
      content: input.prompt,
      status: 'continue',
      metadata: { host: this.id, model: this.model },
    }
  }

  async getActiveModel(): Promise<string | null> {
    return this.model
  }

  async sendPrompt(
    prompt: string,
    agent: AgentDefinition,
    job: JobDefinition,
    step: WorkflowStep,
    options?: PromptOptions,
  ): Promise<AgentResponse> {
    const model = options?.model ?? this.model

    // Chama o endpoint OpenAI-compatible do Antigravity
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: agent.instructions,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 4096,
      }),
    })

    if (!response.ok) {
      throw new Error(`Antigravity API error: ${response.status} ${response.statusText}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any
    const content: string = data?.choices?.[0]?.message?.content ?? ''

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
      approvalReason: approvalNeeded ? `Agent '${agent.name}' solicitou aprovação humana` : undefined,
      status,
      metadata: { model, provider: 'antigravity' },
    }
  }

  getCapabilities(): HostCapabilities {
    return {
      supportsStreaming: false,
      supportsToolUse: true,
      supportsVision: false,
      maxContextTokens: 1000000, // Gemini 3 Pro tem contexto de 1M tokens
      supportedModels: [
        'gemini-3-pro',
        'gemini-3-flash',
        'claude-sonnet-4-5',
        'claude-opus-4',
        'gpt-4o',
      ],
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, { signal: AbortSignal.timeout(3000) })
      return res.ok
    } catch {
      return false
    }
  }
}
