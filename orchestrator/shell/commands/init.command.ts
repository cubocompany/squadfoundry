import type { Command } from 'commander'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import { initProject } from '../services/project-bootstrap.service.js'
import type { InstallScope, PreferredIde } from '../services/config-paths.service.js'

type InitOptions = {
  cwd: string
  force?: boolean
  scope?: InstallScope
  ide?: PreferredIde
  yes?: boolean
}

const IDE_OPTIONS: PreferredIde[] = ['claude-code', 'opencode', 'cursor', 'codex', 'windsurf', 'zed', 'none']

async function promptForInitOptions(): Promise<{ scope: InstallScope; ide: PreferredIde }> {
  const rl = createInterface({ input, output })
  try {
    output.write('\nWhere do you want to install Squad Foundry?\n')
    output.write('  1. repository (this project only)\n')
    output.write('  2. global (user profile)\n')
    const scopeAnswer = (await rl.question('Scope [1]: ')).trim()
    const scope: InstallScope = scopeAnswer === '2' || scopeAnswer.toLowerCase() === 'global'
      ? 'global'
      : 'repository'

    output.write('\nWhich IDE should be pre-configured?\n')
    IDE_OPTIONS.forEach((ide, idx) => {
      output.write(`  ${idx + 1}. ${ide}\n`)
    })
    const ideAnswer = (await rl.question('IDE [1]: ')).trim()
    const ideIndex = Number(ideAnswer)
    if (!Number.isNaN(ideIndex) && ideIndex >= 1 && ideIndex <= IDE_OPTIONS.length) {
      return { scope, ide: IDE_OPTIONS[ideIndex - 1] as PreferredIde }
    }

    const normalizedIde = ideAnswer.toLowerCase() as PreferredIde
    if (IDE_OPTIONS.includes(normalizedIde)) {
      return { scope, ide: normalizedIde }
    }

    return { scope, ide: 'claude-code' }
  } finally {
    rl.close()
  }
}

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Initialize Squad Foundry host-native config in current project')
    .option('--cwd <path>', 'Project path to initialize', process.cwd())
    .option('--force', 'Overwrite existing Squad Foundry config files', false)
    .option('--scope <scope>', 'Install scope: repository or global')
    .option('--ide <ide>', 'Preferred IDE: claude-code, opencode, cursor, codex, windsurf, zed, none')
    .option('--yes', 'Use defaults without interactive prompts', false)
    .action(async (opts: InitOptions) => {
      let scope = opts.scope
      let ide = opts.ide

      if (!opts.yes && !scope && !ide && process.stdin.isTTY) {
        const selected = await promptForInitOptions()
        scope = selected.scope
        ide = selected.ide
      }

      await initProject(opts.cwd, {
        force: opts.force,
        installScope: scope,
        preferredIde: ide,
      })
      console.log(`Initialized host-native shell config (${scope ?? 'repository'} scope, IDE: ${ide ?? 'none'}).`)
    })
}
