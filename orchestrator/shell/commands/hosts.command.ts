import type { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { HostRuntimeService } from '../services/host-runtime.service.js'

type HostsOptions = {
  cwd: string
}

export function registerHosts(program: Command): void {
  program
    .command('hosts')
    .description('Show host-native configuration and preferences')
    .option('--cwd <path>', 'Project path', process.cwd())
    .action(async (opts: HostsOptions) => {
      const service = new HostRuntimeService(opts.cwd)
      const resolved = await service.resolveForCommand('hosts')

      console.log(`resolvedHost: ${resolved.hostId}`)
      console.log(`confidence: ${resolved.confidence}`)
      console.log(`reasons: ${JSON.stringify(resolved.reasons)}`)
      console.log(`activeModel: ${resolved.activeModel}`)
      console.log(`fallbackPath: ${resolved.path}`)

      const filePath = join(opts.cwd, 'squadfoundry.hosts.json')
      try {
        const raw = readFileSync(filePath, 'utf-8')
        console.log(`preferences: ${raw.trim()}`)
      } catch {
        console.log('preferences: <not found>')
      }
    })
}
