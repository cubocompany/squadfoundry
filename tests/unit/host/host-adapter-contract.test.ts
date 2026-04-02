import { describe, expect, it } from 'vitest'

import type { HostDetectionContext, IHostAdapter } from '../../../orchestrator/adapters/host/IHostAdapter.js'
import { AntigravityHostAdapter } from '../../../orchestrator/adapters/host/antigravity.adapter.js'
import { IDEHostAdapter } from '../../../orchestrator/adapters/host/ide.adapter.js'
import { LocalHostAdapter } from '../../../orchestrator/adapters/host/local.adapter.js'

const detectionContext: HostDetectionContext = {
  cwd: process.cwd(),
  argv: ['node', 'test'],
  env: {},
}

const interviewState = {
  turnCount: 1,
  history: [],
}

function assertContract(adapter: IHostAdapter): void {
  expect(typeof adapter.detect).toBe('function')
  expect(typeof adapter.runInterviewTurn).toBe('function')
  expect(typeof adapter.getActiveModel).toBe('function')
}

describe('host adapter contract', () => {
  it('local adapter exposes new host contract methods', async () => {
    const adapter = new LocalHostAdapter()
    assertContract(adapter)

    const detection = adapter.detect(detectionContext)
    expect(typeof detection.isDetected).toBe('boolean')

    const turn = await adapter.runInterviewTurn({ prompt: 'hello' }, interviewState)
    expect(turn.status).toBe('continue')

    const model = await adapter.getActiveModel()
    expect(typeof model).toBe('string')
  })

  it('antigravity adapter exposes new host contract methods', async () => {
    const adapter = new AntigravityHostAdapter()
    assertContract(adapter)

    const detection = adapter.detect({ ...detectionContext, argv: ['antigravity'] })
    expect(detection.confidence).toMatch(/high|medium|low/)

    const turn = await adapter.runInterviewTurn({ prompt: 'hello' }, interviewState)
    expect(turn.status).toBe('continue')

    const model = await adapter.getActiveModel()
    expect(typeof model).toBe('string')
  })

  it('ide adapter exposes new host contract methods', async () => {
    const adapter = new IDEHostAdapter(async (prompt) => `response:${prompt}`, {
      activeModel: 'gpt-5.3-codex',
    })
    assertContract(adapter)

    const detection = adapter.detect({ ...detectionContext, env: { OPENCODE: '1' } })
    expect(typeof detection.isDetected).toBe('boolean')

    const turn = await adapter.runInterviewTurn({ prompt: 'hello' }, interviewState)
    expect(turn.content).toContain('response:hello')

    const model = await adapter.getActiveModel()
    expect(model).toBe('gpt-5.3-codex')
  })
})
