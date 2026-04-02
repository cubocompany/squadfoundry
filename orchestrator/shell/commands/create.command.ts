import type { Command } from 'commander'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import type { InterviewAnswer } from '../../core/types.js'
import { createSquadBuilder } from '../../builder/squad-builder.js'
import { HostRuntimeService } from '../services/host-runtime.service.js'
import { InterviewHostBridgeService } from '../services/interview-host-bridge.service.js'

type CreateOptions = {
  cwd: string
  out: string
}

export function registerCreate(program: Command): void {
  program
    .command('create')
    .description('Create a new squad through host-native guided flow')
    .option('--cwd <path>', 'Root path for context discovery', process.cwd())
    .option('--out <path>', 'Output directory for generated squad files', process.cwd())
    .action(async (opts: CreateOptions) => {
      const hostRuntime = new HostRuntimeService(opts.cwd)
      const resolved = await hostRuntime.resolveForCommand('create')

      const builder = createSquadBuilder({
        contextRootPath: opts.cwd,
        outputDir: opts.out,
      })
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
