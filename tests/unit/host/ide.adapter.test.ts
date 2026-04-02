import { describe, expect, it } from 'vitest'

import { IDEHostAdapter } from '../../../orchestrator/adapters/host/ide.adapter.js'
import type { AgentDefinition, JobDefinition, WorkflowStep } from '../../../orchestrator/core/types.js'

describe('IDEHostAdapter', () => {
  it('parses handoff when allowedAgentIds metadata includes target', async () => {
    const adapter = new IDEHostAdapter(async () => 'HANDOFF:reviewer-agent:step_completed')

    const agent = { id: 'code-agent', name: 'Code Agent' } as unknown as AgentDefinition
    const job = { id: 'job-1', loadedContext: { docs: [] } } as unknown as JobDefinition
    const step = { id: 'step-1', name: 'Step 1' } as unknown as WorkflowStep

    const response = await adapter.sendPrompt('prompt', agent, job, step, {
      metadata: {
        allowedAgentIds: ['reviewer-agent', 'test-agent'],
      },
    })

    expect(response.handoffSignal?.targetAgentId).toBe('reviewer-agent')
  })
})
