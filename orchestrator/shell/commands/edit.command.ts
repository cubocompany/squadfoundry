import type { Command } from 'commander'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import type { InterviewAnswer } from '../../core/types.js'
import { createSquadBuilder } from '../../builder/squad-builder.js'
import { HostRuntimeService } from '../services/host-runtime.service.js'
import { InterviewHostBridgeService } from '../services/interview-host-bridge.service.js'
import { resolveSquadConfigPath } from '../services/squad-scaffold.service.js'

type EditOptions = {
  cwd: string
  out: string
}

export function registerEdit(program: Command): void {
  program
    .command('edit <squad_id>')
    .description('Edit an existing squad through host-native guided flow')
    .option('--cwd <path>', 'Root path for context discovery', process.cwd())
    .option('--out <path>', 'Output directory for generated squad files', process.cwd())
    .action(async (squadId: string, opts: EditOptions) => {
      const existingConfigPath = resolveSquadConfigPath(opts.cwd, squadId)
      if (!existingConfigPath) {
        throw new Error(`Squad '${squadId}' not found in squads/ or squads/examples/.`)
      }

      const hostRuntime = new HostRuntimeService(opts.cwd)
      const resolved = await hostRuntime.resolveForCommand('edit')

      if (!process.stdin.isTTY) {
        throw new Error("The 'edit' command requires an interactive terminal.")
      }

      const builder = createSquadBuilder({
        contextRootPath: opts.cwd,
        outputDir: opts.out,
      })
      const bridge = new InterviewHostBridgeService()
      const answers: InterviewAnswer[] = []
      const state = { turnCount: 0, history: [] as string[] }

      const rl = createInterface({ input, output })
      try {
        console.log(`\n[Squad Foundry] Editing '${squadId}' with host ${resolved.hostId} (${resolved.activeModel})\n`)

        for (const question of builder.getQuestions().filter((q) => q.required)) {
          const turn = await bridge.nextTurn(
            resolved.hostAdapter,
            { prompt: question.question },
            state,
          )

          const defaultValue = question.id === 'q_squad_name' ? squadId : ''
          const suffix = defaultValue ? ` [${defaultValue}]` : ''
          const hint = question.hint ? `\n  (${question.hint})` : ''
          const rawAnswer = await rl.question(`${turn.content}${hint}${suffix}\n> `)
          const answer = rawAnswer.trim() || defaultValue

          answers.push({ questionId: question.id, answer })
          state.turnCount += 1
          state.history.push(answer)
        }
      } finally {
        rl.close()
      }

      const result = await builder.build(answers)
      console.log(`\n✓ Squad '${result.squadDefinition.id}' updated successfully.`)
    })
}
