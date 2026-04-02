import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const PROJECT_CONFIG_FILE = 'squadfoundry.config.json'
const HOST_PREFERENCES_FILE = 'squadfoundry.hosts.json'

type ProjectConfig = {
  version: number
  cliMode: 'shell'
}

type HostPreferences = {
  preferredHost: string | null
  lastValidated: string | null
  hosts: string[]
}

const defaultProjectConfig: ProjectConfig = {
  version: 1,
  cliMode: 'shell',
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
  const targetDirs = [
    join(workspaceDir, '.opencode', 'commands'),
    join(workspaceDir, '.claude', 'commands'),
  ]

  for (const dir of targetDirs) {
    await mkdir(dir, { recursive: true })
    for (const [fileName, content] of Object.entries(IDE_COMMANDS)) {
      await writeFile(join(dir, fileName), `${content}\n`, 'utf-8')
    }
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
}

export async function initProject(workspaceDir: string, options: InitProjectOptions = {}): Promise<void> {
  await mkdir(workspaceDir, { recursive: true })

  const configPath = join(workspaceDir, PROJECT_CONFIG_FILE)
  const hostsPath = join(workspaceDir, HOST_PREFERENCES_FILE)
  const force = options.force ?? false

  if (!force) {
    const [hasConfig, hasHosts] = await Promise.all([fileExists(configPath), fileExists(hostsPath)])
    if (hasConfig || hasHosts) {
      throw new Error('Squad Foundry config files already exist. Re-run with --force to overwrite.')
    }
  }

  await Promise.all([
    writeJsonFile(configPath, defaultProjectConfig),
    writeJsonFile(hostsPath, defaultHostPreferences),
  ])

  await scaffoldIdeCommands(workspaceDir)
}
