import type { Command } from 'commander'
import { listSquadIds } from '../services/squad-scaffold.service.js'

type ListOptions = {
  cwd: string
}

export function registerList(program: Command): void {
  program
    .command('list')
    .description('List all available squads')
    .option('--cwd <path>', 'Squad definitions root', process.cwd())
    .action((opts: ListOptions) => {
      const squads = listSquadIds(opts.cwd)

      if (squads.length === 0) {
        console.log('No squads found.')
        return
      }

      for (const squadId of squads) {
        console.log(squadId)
      }
    })
}
