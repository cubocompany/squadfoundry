import { describe, expect, it } from 'vitest'

import { isSquadDefinition } from '../../../orchestrator/shell/commands/run.command.js'

describe('run command squad validator', () => {
  it('accepts workflow steps without legacy type field', () => {
    const valid = isSquadDefinition({
      id: 'uqbar-ti',
      name: 'Uqbar TI',
      agents: [
        {
          id: 'developer',
          name: 'Developer',
          instructions: 'Do work',
          allowedStates: ['READY_FOR_EXECUTION'],
        },
      ],
      workflow: {
        steps: [
          {
            id: 'step-dev',
            agentId: 'developer',
            name: 'Develop',
          },
        ],
      },
    })

    expect(valid).toBe(true)
  })

  it('rejects workflow step with non-string type when present', () => {
    const valid = isSquadDefinition({
      id: 'uqbar-ti',
      name: 'Uqbar TI',
      agents: [
        {
          id: 'developer',
          name: 'Developer',
          instructions: 'Do work',
          allowedStates: ['READY_FOR_EXECUTION'],
        },
      ],
      workflow: {
        steps: [
          {
            id: 'step-dev',
            agentId: 'developer',
            name: 'Develop',
            type: 42,
          },
        ],
      },
    })

    expect(valid).toBe(false)
  })
})
