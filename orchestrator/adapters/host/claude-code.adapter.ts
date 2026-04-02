import { createCommandModelInvoker } from './command-model-invoker.js'
import { IDEHostAdapter, type IDEHostAdapterOptions, type ModelInvoker } from './ide.adapter.js'

export type ClaudeCodeHostAdapterOptions = IDEHostAdapterOptions & {
  invoker?: ModelInvoker
  command?: string
  args?: string[]
  promptMode?: 'stdin' | 'arg'
}

function resolveArgs(args?: string[]): string[] {
  if (args && args.length > 0) return args
  const envArgs = process.env['CLAUDE_CODE_BRIDGE_ARGS']
  if (envArgs && envArgs.trim().length > 0) {
    return envArgs.split(' ').filter((part) => part.trim().length > 0)
  }
  return ['--print']
}

export class ClaudeCodeHostAdapter extends IDEHostAdapter {
  readonly id = 'claude-code'
  readonly name = 'Claude Code (native CLI bridge)'

  constructor(options: ClaudeCodeHostAdapterOptions = {}) {
    const command = options.command ?? process.env['CLAUDE_CODE_BRIDGE_CMD'] ?? 'claude'
    const args = resolveArgs(options.args)
    const promptMode = options.promptMode ?? (process.env['CLAUDE_CODE_BRIDGE_PROMPT_MODE'] as 'stdin' | 'arg' | undefined) ?? 'stdin'
    const invoker = options.invoker ?? createCommandModelInvoker({ command, args, promptMode })

    super(invoker, {
      ...options,
      hostName: 'Claude Code',
      activeModel: options.activeModel ?? process.env['CLAUDE_CODE_ACTIVE_MODEL'] ?? 'host-native',
    })
  }
}
