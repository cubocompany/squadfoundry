import { spawn } from 'node:child_process'

export type SpawnLike = typeof spawn

export type CommandInvokerOptions = {
  command: string
  args?: string[]
  timeoutMs?: number
  promptMode?: 'stdin' | 'arg'
  spawnImpl?: SpawnLike
}

type InvokeAttemptResult = {
  ok: boolean
  text: string
  stderr: string
  exitCode: number
  timedOut: boolean
}

function isClaudeCommand(command: string): boolean {
  return command.toLowerCase().includes('claude')
}

async function invokeOnce(
  spawnImpl: SpawnLike,
  command: string,
  args: string[],
  prompt: string,
  promptMode: 'stdin' | 'arg',
  timeout: number,
): Promise<InvokeAttemptResult> {
  const child = spawnImpl(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
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
  const text = stdout.trim()

  if (exitCode !== 0) {
    return { ok: false, text, stderr: stderr.trim(), exitCode, timedOut }
  }

  if (!text && stderr.trim().length > 0) {
    return { ok: false, text, stderr: stderr.trim(), exitCode, timedOut }
  }

  return { ok: true, text, stderr: stderr.trim(), exitCode, timedOut }
}

export function createCommandModelInvoker(options: CommandInvokerOptions) {
  const timeout = options.timeoutMs ?? 120000
  const baseArgs = options.args ?? []
  const promptMode = options.promptMode ?? 'stdin'
  const spawnImpl = options.spawnImpl ?? spawn

  return async (prompt: string): Promise<string> => {
    const args = promptMode === 'arg'
      ? [...baseArgs, '--', prompt]
      : [...baseArgs]

    const firstAttempt = await invokeOnce(spawnImpl, options.command, args, prompt, promptMode, timeout)
    if (firstAttempt.ok) {
      return firstAttempt.text
    }

    if (isClaudeCommand(options.command)) {
      const retryArgsBase = baseArgs.includes('--dangerously-skip-permissions')
        ? [...baseArgs]
        : [...baseArgs, '--dangerously-skip-permissions']

      const retryPromptMode: 'stdin' | 'arg' = firstAttempt.timedOut && promptMode === 'stdin'
        ? 'arg'
        : promptMode

      const retryArgs = retryPromptMode === 'arg'
        ? [...retryArgsBase, '--', prompt]
        : [...retryArgsBase]

      const secondAttempt = await invokeOnce(spawnImpl, options.command, retryArgs, prompt, retryPromptMode, timeout)
      if (secondAttempt.ok) {
        return secondAttempt.text
      }

      throw new Error(
        `Bridge command failed (${options.command} ${retryArgs.join(' ')}): ${secondAttempt.stderr || firstAttempt.stderr}`,
      )
    }

    throw new Error(`Bridge command failed (${options.command} ${args.join(' ')}): ${firstAttempt.stderr}`)
  }
}
