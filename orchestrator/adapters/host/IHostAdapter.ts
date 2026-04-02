/**
 * IHostAdapter — Host Runtime Adapter Interface
 *
 * Abstracts the execution environment (Claude Code, OpenCode, Cursor, Codex, etc.).
 * The core orchestrator never imports a concrete host implementation directly.
 *
 * STATUS: Interface defined. Concrete adapters: anthropic (stub), openai (stub), local (stub)
 */

import type { AgentDefinition, AgentResponse, JobDefinition, WorkflowStep } from '../../core/types.js'

export interface PromptOptions {
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  model?: string
  stream?: boolean
  metadata?: Record<string, unknown>
}

export interface HostCapabilities {
  supportsStreaming: boolean
  supportsToolUse: boolean
  supportsVision: boolean
  maxContextTokens: number
  supportedModels: string[]
}

export interface HostDetectionContext {
  cwd: string
  argv?: string[]
  env?: Record<string, string | undefined>
}

export interface HostDetectionResult {
  isDetected: boolean
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
}

export interface InterviewTurnInput {
  prompt: string
  metadata?: Record<string, unknown>
}

export interface InterviewTurnState {
  turnCount: number
  history: string[]
  metadata?: Record<string, unknown>
}

export interface InterviewTurnResult {
  content: string
  status: 'continue' | 'complete'
  metadata?: Record<string, unknown>
}

/**
 * The primary interface every host adapter must implement.
 *
 * A "host" is the execution environment that actually runs the LLM.
 * It could be an IDE extension, a direct API call, a local LLM, etc.
 */
export interface IHostAdapter {
  /** Unique identifier for this host adapter */
  readonly id: string
  /** Human-readable name */
  readonly name: string

  /** Detect whether current execution context belongs to this host. */
  detect(context: HostDetectionContext): HostDetectionResult

  /**
   * Initialize the adapter (load credentials, check connection, etc.)
   * Called once before any prompts are sent.
   */
  initialize(): Promise<void>

  /** Execute one interview turn for builder/edit conversational flow. */
  runInterviewTurn(input: InterviewTurnInput, state: InterviewTurnState): Promise<InterviewTurnResult>

  /** Return active model if host can expose it; null otherwise. */
  getActiveModel(): Promise<string | null>

  /**
   * Send a complete prompt to the host and await a full response.
   */
  sendPrompt(
    prompt: string,
    agent: AgentDefinition,
    job: JobDefinition,
    step: WorkflowStep,
    options?: PromptOptions,
  ): Promise<AgentResponse>

  /**
   * Stream a prompt response (yields chunks as they arrive).
   * Not all hosts support streaming — check capabilities first.
   */
  streamPrompt?(
    prompt: string,
    agent: AgentDefinition,
    job: JobDefinition,
    step: WorkflowStep,
    options?: PromptOptions,
  ): AsyncGenerator<string>

  /**
   * Report the capabilities of this host.
   */
  getCapabilities(): HostCapabilities

  /**
   * Check whether the host is available and configured.
   */
  healthCheck(): Promise<boolean>
}
