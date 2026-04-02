/**
 * IDEHostAdapter
 *
 * The correct adapter for Claude Code, OpenCode, Codex, Cursor, Zed, Antigravity,
 * and any other AI-native IDE or agent host.
 *
 * These environments ARE the model — they don't need an API key because
 * they are already running inside an LLM session. The IDE/tool handles
 * model execution natively. This adapter simply formats the prompt and
 * delegates execution back to whatever callback the host environment provides.
 *
 * Usage pattern:
 *
 *   // Inside Claude Code, OpenCode, etc.:
 *   import { IDEHostAdapter } from 'squadfoundry'
 *
 *   const adapter = new IDEHostAdapter(async (prompt) => {
 *     // The IDE calls its own model here.
 *     // In Claude Code this is handled automatically.
 *     // In OpenCode you'd use their SDK.
 *     // In a script context you'd call your preferred provider.
 *     return yourModel.complete(prompt)
 *   })
 *
 * The callback receives the fully-built prompt (system + context + step instructions)
 * and returns the raw text response. The adapter parses artifacts and handoff signals
 * from the response text.
 *
 * STATUS: REAL — fully functional when a callback is provided.
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

/** The function your host environment provides to run a prompt through the model. */
export type ModelInvoker = (
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
) => Promise<string>

export interface IDEHostAdapterOptions {
  /** Optional human-readable name of the IDE/tool (for logging) */
  hostName?: string
  /** Parse artifacts from response text (default: true) */
  parseArtifacts?: boolean
  /** Optional active model reported by host environment */
  activeModel?: string | null
}

/**
 * Parse artifacts from agent response text.
 *
 * Agents can include artifacts in their response using this convention:
 *
 *   ARTIFACT:<name>:<format>
 *   <content>
 *   END_ARTIFACT
 *
 * This is a lightweight protocol that works in plain text without any
 * tool-use features — compatible with every LLM and every host.
 */
function parseArtifactsFromText(text: string): PendingArtifact[] {
  const artifacts: PendingArtifact[] = []
  const pattern = /ARTIFACT:([^:]+):([^\n]+)\n([\s\S]*?)END_ARTIFACT/g

  let match
  while ((match = pattern.exec(text)) !== null) {
    const name = match[1]?.trim()
    const format = (match[2]?.trim() ?? 'text') as PendingArtifact['format']
    const content = match[3]?.trim() ?? ''

    if (name) {
      artifacts.push({ name, format, content })
    }
  }

  return artifacts
}

/**
 * Parse a handoff signal from response text.
 *
 * Convention:
 *   HANDOFF:<target_agent_id>:<condition>
 */
function parseHandoffSignal(text: string, agents?: string[]) {
  const pattern = /HANDOFF:([^\s:]+):(.+)/
  const match = pattern.exec(text)
  if (!match) return undefined

  const targetAgentId = match[1]?.trim() ?? ''
  const condition = match[2]?.trim() ?? 'step_completed'

  if (agents && agents.length > 0 && !agents.includes(targetAgentId)) return undefined

  return {
    targetAgentId,
    condition,
    payload: { summary: `Agent signalled handoff to ${targetAgentId}` },
  }
}

export class IDEHostAdapter implements IHostAdapter {
  readonly id: string = 'ide'
  readonly name: string

  private invoker: ModelInvoker
  private parseArtifactsFromResponse: boolean
  private activeModel: string | null

  constructor(invoker: ModelInvoker, options: IDEHostAdapterOptions = {}) {
    this.invoker = invoker
    this.name = options.hostName ?? 'IDE Host (Claude Code / OpenCode / Cursor / etc.)'
    this.parseArtifactsFromResponse = options.parseArtifacts ?? true
    this.activeModel = options.activeModel ?? 'host-native'
  }

  detect(context: HostDetectionContext): HostDetectionResult {
    const argv = (context.argv ?? process.argv).map((item) => item.toLowerCase())
    const env = context.env ?? process.env
    const hasIdeSignal = argv.some((item) => item.includes('claude') || item.includes('opencode') || item.includes('codex'))
      || Boolean(env['CLAUDE_CODE'] || env['OPENCODE'] || env['CODEX'])

    return {
      isDetected: hasIdeSignal,
      confidence: hasIdeSignal ? 'medium' : 'low',
      reasons: hasIdeSignal ? ['Detected IDE host signal from argv/env'] : [],
    }
  }

  async initialize(): Promise<void> {
    // No initialization needed — the IDE environment is already running
  }

  async runInterviewTurn(input: InterviewTurnInput, _state: InterviewTurnState): Promise<InterviewTurnResult> {
    const rawResponse = await this.invoker(input.prompt)
    return {
      content: rawResponse,
      status: 'continue',
      metadata: { host: this.id, model: this.activeModel ?? 'host-default' },
    }
  }

  async getActiveModel(): Promise<string | null> {
    return this.activeModel
  }

  async sendPrompt(
    prompt: string,
    agent: AgentDefinition,
    job: JobDefinition,
    step: WorkflowStep,
    options?: PromptOptions,
  ): Promise<AgentResponse> {
    // Delegate to the host environment's model
    const rawResponse = await this.invoker(prompt, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    })

    // Parse artifacts from response text
    const artifacts = this.parseArtifactsFromResponse
      ? parseArtifactsFromText(rawResponse)
      : []

    // Parse handoff signal
    const allowedAgentIds = Array.isArray(options?.metadata?.['allowedAgentIds'])
      ? (options?.metadata?.['allowedAgentIds'] as unknown[])
        .filter((item): item is string => typeof item === 'string')
      : undefined
    const handoffSignal = parseHandoffSignal(rawResponse, allowedAgentIds)

    // Detect approval request
    const approvalNeeded =
      rawResponse.toLowerCase().includes('[needs_approval]') ||
      rawResponse.toLowerCase().includes('[approval_required]')

    const approvalReason = approvalNeeded
      ? `Agent '${agent.name}' requested human approval`
      : undefined

    // Detect failure
    const status = rawResponse.toLowerCase().includes('[failure]') ||
      rawResponse.toLowerCase().includes('[failed]')
      ? 'failure'
      : 'success'

    return {
      agentId: agent.id,
      stepId: step.id,
      jobId: job.id,
      content: rawResponse,
      artifacts,
      handoffSignal,
      approvalNeeded,
      approvalReason,
      status,
    }
  }

  getCapabilities(): HostCapabilities {
    return {
      supportsStreaming: false,
      supportsToolUse: true,
      supportsVision: false,
      maxContextTokens: 200000,
      supportedModels: ['host-native'],
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.invoker('ping')
      return typeof result === 'string'
    } catch {
      return false
    }
  }
}
