import type { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { HostRuntimeService } from '../services/host-runtime.service.js'
import { SQUADFOUNDRY_HOSTS_FILE, resolveConfigDir } from '../services/config-paths.service.js'

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

      const { configDir, scope } = resolveConfigDir(opts.cwd)
      const filePath = join(configDir, SQUADFOUNDRY_HOSTS_FILE)
      try {
        const raw = readFileSync(filePath, 'utf-8')
        console.log(`configScope: ${scope}`)
        console.log(`configPath: ${filePath}`)
        console.log(`preferences: ${raw.trim()}`)
      } catch {
        console.log('preferences: <not found>')
      }
    })
}
