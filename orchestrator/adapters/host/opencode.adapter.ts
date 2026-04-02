import { createCommandModelInvoker } from './command-model-invoker.js'
import { IDEHostAdapter, type IDEHostAdapterOptions, type ModelInvoker } from './ide.adapter.js'

export type OpenCodeHostAdapterOptions = IDEHostAdapterOptions & {
  invoker?: ModelInvoker
  command?: string
  args?: string[]
  promptMode?: 'stdin' | 'arg'
}

function resolveArgs(args?: string[]): string[] {
  if (args && args.length > 0) return args
  const envArgs = process.env['OPENCODE_BRIDGE_ARGS']
  if (envArgs && envArgs.trim().length > 0) {
    return envArgs.split(' ').filter((part) => part.trim().length > 0)
  }
  return ['complete']
}

export class OpenCodeHostAdapter extends IDEHostAdapter {
  readonly id = 'opencode'
  readonly name = 'OpenCode (native CLI bridge)'

  constructor(options: OpenCodeHostAdapterOptions = {}) {
    const command = options.command ?? process.env['OPENCODE_BRIDGE_CMD'] ?? 'opencode'
    const args = resolveArgs(options.args)
    const promptMode = options.promptMode ?? (process.env['OPENCODE_BRIDGE_PROMPT_MODE'] as 'stdin' | 'arg' | undefined) ?? 'stdin'
    const invoker = options.invoker ?? createCommandModelInvoker({ command, args, promptMode })

    super(invoker, {
      ...options,
      hostName: 'OpenCode',
      activeModel: options.activeModel ?? process.env['OPENCODE_ACTIVE_MODEL'] ?? 'host-native',
    })
  }
}
