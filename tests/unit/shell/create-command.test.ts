import { describe, expect, it } from 'vitest'

import { parseInterviewAnswersPayload } from '../../../orchestrator/shell/commands/create.command.js'

describe('create command answer payload parser', () => {
  it('parses object payload into InterviewAnswer[]', () => {
    const parsed = parseInterviewAnswersPayload({
      q_objective: 'Build squads',
      q_squad_name: 'uqbar-ti',
      ignored_key: 'value',
    })

    expect(parsed).toEqual([
      { questionId: 'q_objective', answer: 'Build squads' },
      { questionId: 'q_squad_name', answer: 'uqbar-ti' },
    ])
  })

  it('parses InterviewAnswer[] payload unchanged', () => {
    const payload = [
      { questionId: 'q_objective', answer: 'obj' },
      { questionId: 'q_squad_name', answer: 'name' },
    ]
    const parsed = parseInterviewAnswersPayload(payload)

    expect(parsed).toEqual(payload)
  })
})
