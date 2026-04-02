import type { Command } from 'commander'

import { initProject } from '../services/project-bootstrap.service.js'

type InitOptions = {
  cwd: string
  force?: boolean
}

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Initialize Squad Foundry host-native config in current project')
    .option('--cwd <path>', 'Project path to initialize', process.cwd())
    .option('--force', 'Overwrite existing Squad Foundry config files', false)
    .action(async (opts: InitOptions) => {
      await initProject(opts.cwd, { force: opts.force })
      console.log('Initialized host-native shell config.')
    })
}
