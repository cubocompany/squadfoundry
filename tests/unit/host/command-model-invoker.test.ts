import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'

import { createCommandModelInvoker, type SpawnLike } from '../../../orchestrator/adapters/host/command-model-invoker.js'

type SpawnPlan = {
  exitCode: number
  stdout?: string
  stderr?: string
}

class FakeStream extends EventEmitter {
  emitData(text: string): void {
    this.emit('data', Buffer.from(text))
  }
}

class FakeStdin {
  writes: string[] = []

  write(text: string): void {
    this.writes.push(text)
  }

  end(): void {
    // no-op
  }
}

function createSpawn(plans: SpawnPlan[], calls: Array<{ command: string; args: string[] }>): SpawnLike {
  let index = 0
  return ((command: string, args?: readonly string[]) => {
    calls.push({ command, args: [...(args ?? [])] })
    const plan = plans[index++] ?? { exitCode: 0 }

    const child = new EventEmitter() as unknown as {
      stdout: FakeStream
      stderr: FakeStream
      stdin: FakeStdin
      kill: (signal?: NodeJS.Signals) => void
      emit: (event: string, ...args: unknown[]) => boolean
      on: (event: string, listener: (...args: unknown[]) => void) => typeof child
    }

    child.stdout = new FakeStream()
    child.stderr = new FakeStream()
    child.stdin = new FakeStdin()
    child.kill = () => {
      // no-op for tests
    }

    queueMicrotask(() => {
      if (plan.stdout) child.stdout.emitData(plan.stdout)
      if (plan.stderr) child.stderr.emitData(plan.stderr)
      child.emit('close', plan.exitCode)
    })

    return child
  }) as unknown as SpawnLike
}

describe('command model invoker', () => {
  it('retries Claude bridge with dangerously-skip-permissions after initial failure', async () => {
    const calls: Array<{ command: string; args: string[] }> = []
    const spawnImpl = createSpawn(
      [
        { exitCode: 1, stderr: 'nested session' },
        { exitCode: 0, stdout: 'ok from retry' },
      ],
      calls,
    )

    const invoker = createCommandModelInvoker({
      command: 'claude',
      args: ['--print'],
      spawnImpl,
    })

    const result = await invoker('hello')

    expect(result).toBe('ok from retry')
    expect(calls).toHaveLength(2)
    expect(calls[0]?.args).toEqual(['--print'])
    expect(calls[1]?.args).toContain('--dangerously-skip-permissions')
  })

  it('does not retry non-Claude commands', async () => {
    const calls: Array<{ command: string; args: string[] }> = []
    const spawnImpl = createSpawn([{ exitCode: 1, stderr: 'boom' }], calls)

    const invoker = createCommandModelInvoker({
      command: 'some-other-cli',
      spawnImpl,
    })

    await expect(invoker('hello')).rejects.toThrow(/Bridge command failed/)
    expect(calls).toHaveLength(1)
  })
})
