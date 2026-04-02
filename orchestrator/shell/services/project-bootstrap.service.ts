import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  SQUADFOUNDRY_CONFIG_FILE,
  SQUADFOUNDRY_HOSTS_FILE,
  type InstallScope,
  type PreferredIde,
  type SquadFoundryConfig,
  getGlobalConfigDir,
  getRepositoryConfigDir,
} from './config-paths.service.js'

type HostPreferences = {
  preferredHost: string | null
  validation?: {
    timestamp: string
    matchedSignals: string[]
  } | null
  lastValidated: string | null
  hosts: string[]
}

const defaultProjectConfig: SquadFoundryConfig = {
  version: 1,
  cliMode: 'shell',
  installScope: 'repository',
  preferredIde: 'none',
}

const defaultHostPreferences: HostPreferences = {
  preferredHost: null,
  lastValidated: null,
  hosts: [],
}

const IDE_COMMANDS: Record<string, string> = {
  'squad-init.md': [
    '# Squad Foundry Init',
    '',
    'Initialize Squad Foundry in this project:',
    '',
    '```bash',
    'squadfoundry init --force',
    '```',
  ].join('\n'),
  'squad-create.md': [
    '# Squad Foundry Create',
    '',
    'Start guided interview and create squad:',
    '',
    '```bash',
    'squadfoundry create',
    '```',
  ].join('\n'),
  'squad-edit.md': [
    '# Squad Foundry Edit',
    '',
    'Edit existing squad definition:',
    '',
    '```bash',
    'squadfoundry edit software-development',
    '```',
  ].join('\n'),
  'squad-run.md': [
    '# Squad Foundry Run',
    '',
    'Run a squad workflow:',
    '',
    '```bash',
    'squadfoundry run software-development --objective "Implement feature" --input "Details"',
    '```',
  ].join('\n'),
  'squad-status.md': [
    '# Squad Foundry Status',
    '',
    'Check job status and host metadata:',
    '',
    '```bash',
    'squadfoundry status software-development <job-id>',
    '```',
  ].join('\n'),
  'squad-hosts.md': [
    '# Squad Foundry Hosts',
    '',
    'Inspect resolved host/model and persisted preference:',
    '',
    '```bash',
    'squadfoundry hosts',
    '```',
  ].join('\n'),
}

async function writeJsonFile(filePath: string, content: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(content, null, 2)}\n`, 'utf-8')
}

async function scaffoldIdeCommands(workspaceDir: string): Promise<void> {
  const dir = join(workspaceDir, 'commands')
  await mkdir(dir, { recursive: true })
  for (const [fileName, content] of Object.entries(IDE_COMMANDS)) {
    await writeFile(join(dir, fileName), `${content}\n`, 'utf-8')
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

type InitProjectOptions = {
  force?: boolean
  installScope?: InstallScope
  preferredIde?: PreferredIde
}

export async function initProject(workspaceDir: string, options: InitProjectOptions = {}): Promise<void> {
  const installScope = options.installScope ?? 'repository'
  const preferredIde = options.preferredIde ?? 'none'
  const configRoot = installScope === 'global' ? getGlobalConfigDir() : getRepositoryConfigDir(workspaceDir)

  await mkdir(configRoot, { recursive: true })

  const configPath = join(configRoot, SQUADFOUNDRY_CONFIG_FILE)
  const hostsPath = join(configRoot, SQUADFOUNDRY_HOSTS_FILE)
  const force = options.force ?? false

  if (!force) {
    const [hasConfig, hasHosts] = await Promise.all([fileExists(configPath), fileExists(hostsPath)])
    if (hasConfig || hasHosts) {
      throw new Error('Squad Foundry config files already exist. Re-run with --force to overwrite.')
    }
  }

  await Promise.all([
    writeJsonFile(configPath, { ...defaultProjectConfig, installScope, preferredIde }),
    writeJsonFile(hostsPath, defaultHostPreferences),
  ])

  if (preferredIde !== 'none') {
    await scaffoldIdeCommands(join(configRoot, preferredIde))
  }
}
