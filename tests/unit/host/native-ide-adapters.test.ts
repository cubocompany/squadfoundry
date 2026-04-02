import { describe, expect, it } from 'vitest'

import { ClaudeCodeHostAdapter } from '../../../orchestrator/adapters/host/claude-code.adapter.js'
import { OpenCodeHostAdapter } from '../../../orchestrator/adapters/host/opencode.adapter.js'

describe('native IDE adapters', () => {
  it('uses claude-code adapter id and invoker for interview turns', async () => {
    const adapter = new ClaudeCodeHostAdapter({
      invoker: async (prompt: string) => `claude:${prompt}`,
      activeModel: 'claude-sonnet-4-5',
    })

    expect(adapter.id).toBe('claude-code')

    const result = await adapter.runInterviewTurn(
      { prompt: 'question?' },
      { turnCount: 1, history: [] },
    )

    expect(result.content).toContain('claude:question?')
    expect(await adapter.getActiveModel()).toBe('claude-sonnet-4-5')
  })

  it('uses opencode adapter id and invoker for interview turns', async () => {
    const adapter = new OpenCodeHostAdapter({
      invoker: async (prompt: string) => `opencode:${prompt}`,
      activeModel: 'gpt-5.3-codex',
    })

    expect(adapter.id).toBe('opencode')

    const result = await adapter.runInterviewTurn(
      { prompt: 'question?' },
      { turnCount: 1, history: [] },
    )

    expect(result.content).toContain('opencode:question?')
    expect(await adapter.getActiveModel()).toBe('gpt-5.3-codex')
  })
})
