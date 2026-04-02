import { spawn } from 'node:child_process'

export type CommandInvokerOptions = {
  command: string
  args?: string[]
  timeoutMs?: number
  promptMode?: 'stdin' | 'arg'
}

export function createCommandModelInvoker(options: CommandInvokerOptions) {
  const timeout = options.timeoutMs ?? 120000
  const baseArgs = options.args ?? []
  const promptMode = options.promptMode ?? 'stdin'

  return async (prompt: string): Promise<string> => {
    const args = promptMode === 'arg'
      ? [...baseArgs, '--', prompt]
      : [...baseArgs]

    const child = spawn(options.command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
    }, timeout)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    if (promptMode === 'stdin') {
      child.stdin.write(prompt)
      child.stdin.end()
    }

    const exitCode = await new Promise<number>((resolve, reject) => {
      child.on('error', reject)
      child.on('close', (code) => resolve(code ?? 0))
    })

    clearTimeout(timer)

    if (exitCode !== 0) {
      throw new Error(`Bridge command failed (${options.command} ${args.join(' ')}): ${stderr.trim()}`)
    }

    const text = stdout.trim()
    if (!text) {
      const stderrText = stderr.trim()
      if (stderrText) {
        throw new Error(stderrText)
      }
    }
    return text
  }
}
