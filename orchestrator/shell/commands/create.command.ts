import type { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import type { InterviewAnswer } from '../../core/types.js'
import { createSquadBuilder } from '../../builder/squad-builder.js'
import { HostRuntimeService } from '../services/host-runtime.service.js'
import { InterviewHostBridgeService } from '../services/interview-host-bridge.service.js'

type CreateOptions = {
  cwd: string
  out: string
  answersFile?: string
}

type AnswersFilePayload = InterviewAnswer[] | Record<string, string>

export function parseInterviewAnswersPayload(payload: AnswersFilePayload): InterviewAnswer[] {
  if (Array.isArray(payload)) {
    return payload
      .filter((item): item is InterviewAnswer => Boolean(item) && typeof item.questionId === 'string')
      .map((item) => ({
        questionId: item.questionId,
        answer: typeof item.answer === 'string' ? item.answer : '',
      }))
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid answers file format. Expected JSON object or InterviewAnswer[] array.')
  }

  return Object.entries(payload)
    .filter(([questionId]) => questionId.startsWith('q_'))
    .map(([questionId, answer]) => ({
      questionId,
      answer: typeof answer === 'string' ? answer : '',
    }))
}

export function registerCreate(program: Command): void {
  program
    .command('create')
    .description('Create a new squad through host-native guided flow')
    .option('--cwd <path>', 'Root path for context discovery', process.cwd())
    .option('--out <path>', 'Output directory for generated squad files', process.cwd())
    .option('--answers-file <path>', 'Path to JSON file with interview answers for non-interactive mode')
    .action(async (opts: CreateOptions) => {
      const builder = createSquadBuilder({
        contextRootPath: opts.cwd,
        outputDir: opts.out,
      })

      if (opts.answersFile) {
        const raw = await readFile(opts.answersFile, 'utf-8')
        const payload = JSON.parse(raw) as AnswersFilePayload
        const answers = parseInterviewAnswersPayload(payload)
        const missing = builder.validateAnswers(answers)
        if (missing.length > 0) {
          throw new Error(`Missing required answers in file: ${missing.join(', ')}`)
        }

        const result = await builder.build(answers)
        console.log(`\n✓ Squad '${result.squadDefinition.id}' created successfully.`)
        return
      }

      const hostRuntime = new HostRuntimeService(opts.cwd)
      const resolved = await hostRuntime.resolveForCommand('create')

      if (!process.stdin.isTTY) {
        throw new Error("The 'create' command requires an interactive terminal, or provide --answers-file.")
      }

      const bridge = new InterviewHostBridgeService()
      const answers: InterviewAnswer[] = []
      const state = { turnCount: 0, history: [] as string[] }

      const rl = createInterface({ input, output })
      try {
        console.log(`\n[Squad Foundry] Host: ${resolved.hostId} | Model: ${resolved.activeModel}\n`)

        for (const question of builder.getQuestions().filter((q) => q.required)) {
          const turn = await bridge.nextTurn(
            resolved.hostAdapter,
            { prompt: question.question },
            state,
          )

          const hint = question.hint ? `\n  (${question.hint})` : ''
          const answer = await rl.question(`${turn.content}${hint}\n> `)

          answers.push({ questionId: question.id, answer: answer.trim() })
          state.turnCount += 1
          state.history.push(answer.trim())
        }
      } finally {
        rl.close()
      }

      const result = await builder.build(answers)
      console.log(`\n✓ Squad '${result.squadDefinition.id}' created successfully.`)
    })
}
