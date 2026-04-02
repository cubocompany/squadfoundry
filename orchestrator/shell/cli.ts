import { Command } from 'commander'

import { registerCreate } from './commands/create.command.js'
import { registerEdit } from './commands/edit.command.js'
import { registerHosts } from './commands/hosts.command.js'
import { registerInit } from './commands/init.command.js'
import { registerList } from './commands/list.command.js'
import { registerRun } from './commands/run.command.js'
import { registerStatus } from './commands/status.command.js'

export function createShellProgram(): Command {
  const program = new Command()

  program
    .name('squadfoundry')
    .description('Host-native CLI shell for Squad Foundry')
    .version('0.1.0')

  registerInit(program)
  registerCreate(program)
  registerEdit(program)
  registerRun(program)
  registerList(program)
  registerStatus(program)
  registerHosts(program)

  return program
}

export async function runShellCli(argv: string[]): Promise<void> {
  await createShellProgram().parseAsync(argv)
}
