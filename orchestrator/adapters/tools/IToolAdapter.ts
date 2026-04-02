/**
 * IToolAdapter — Tool/Integration Adapter Interface
 *
 * Abstracts external tool invocations (web search, code execution,
 * file operations, API calls, MCP tools, etc.).
 *
 * STATUS: Interface defined. Concrete adapters are domain-specific stubs.
 */

export interface ToolInput {
  name: string
  arguments: Record<string, unknown>
}

export interface ToolOutput {
  name: string
  result: unknown
  error?: string
  metadata?: Record<string, unknown>
}

export interface AvailableTool {
  id: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
  category: ToolCategory
}

export type ToolCategory =
  | 'filesystem'
  | 'web'
  | 'code'
  | 'git'
  | 'api'
  | 'media'
  | 'database'
  | 'mcp'
  | 'custom'

/**
 * Generic tool adapter interface.
 * Each integration (filesystem, GitHub, web search, etc.) implements this.
 */
export interface IToolAdapter {
  readonly id: string
  readonly name: string
  readonly category: ToolCategory

  /**
   * List tools provided by this adapter.
   */
  listTools(): AvailableTool[]

  /**
   * Execute a tool call.
   */
  invoke(input: ToolInput): Promise<ToolOutput>

  /**
   * Check if a specific tool is supported.
   */
  supports(toolName: string): boolean

  /**
   * Health check — verify the integration is operational.
   */
  healthCheck(): Promise<boolean>
}
