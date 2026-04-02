import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const SQUADFOUNDRY_DIR_NAME = '.squadfoundry'
export const SQUADFOUNDRY_CONFIG_FILE = 'config.json'
export const SQUADFOUNDRY_HOSTS_FILE = 'hosts.json'

export type InstallScope = 'repository' | 'global'
export type PreferredIde =
  | 'claude-code'
  | 'opencode'
  | 'cursor'
  | 'codex'
  | 'windsurf'
  | 'zed'
  | 'none'

export type SquadFoundryConfig = {
  version: number
  cliMode: 'shell'
  installScope: InstallScope
  preferredIde: PreferredIde
}

export function getRepositoryConfigDir(cwd: string): string {
  return join(cwd, SQUADFOUNDRY_DIR_NAME)
}

export function getGlobalConfigDir(): string {
  const home = homedir()
  if (process.platform === 'win32') {
    const appData = process.env['APPDATA']
    if (appData && appData.trim().length > 0) {
      return join(appData, 'squadfoundry')
    }
    return join(home, 'AppData', 'Roaming', 'squadfoundry')
  }

  const xdg = process.env['XDG_CONFIG_HOME']
  if (xdg && xdg.trim().length > 0) {
    return join(xdg, 'squadfoundry')
  }
  return join(home, '.config', 'squadfoundry')
}

export function resolveConfigDir(cwd: string): { configDir: string; scope: InstallScope } {
  const repositoryDir = getRepositoryConfigDir(cwd)
  if (existsSync(repositoryDir)) {
    return { configDir: repositoryDir, scope: 'repository' }
  }

  return { configDir: getGlobalConfigDir(), scope: 'global' }
}
