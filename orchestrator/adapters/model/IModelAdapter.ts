/**
 * IModelAdapter — Model/Provider Adapter Interface
 *
 * Abstracts the AI model provider (Anthropic, OpenAI, Gemini, Ollama, etc.).
 * Separates model routing from host runtime — you can run Anthropic models
 * from a local host, or OpenAI models from Claude Code.
 *
 * STATUS: Interface defined. Concrete adapters: per-provider stubs.
 */

import type { ModelPreference } from '../../core/types.js'

export interface ModelRequest {
  systemPrompt: string
  userMessage: string
  history?: MessageTurn[]
  temperature?: number
  maxTokens?: number
  tools?: ToolDefinition[]
}

export interface MessageTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ModelResponse {
  content: string
  tokensUsed?: { input: number; output: number }
  stopReason?: 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence'
  model: string
  provider: string
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  maxContextTokens: number
  supportsTools: boolean
  supportsVision: boolean
  costPer1kInputTokens?: number
  costPer1kOutputTokens?: number
}

/**
 * Interface for model/provider adapters.
 * Implement this to add support for a new AI provider.
 */
export interface IModelAdapter {
  readonly provider: string
  readonly defaultModel: string

  /**
   * Send a request to the model and get a response.
   */
  complete(request: ModelRequest, preference?: ModelPreference): Promise<ModelResponse>

  /**
   * List available models from this provider.
   */
  listModels(): Promise<ModelInfo[]>

  /**
   * Check that credentials and connectivity are valid.
   */
  healthCheck(): Promise<boolean>
}
