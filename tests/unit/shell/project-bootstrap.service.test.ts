import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { initProject } from '../../../orchestrator/shell/services/project-bootstrap.service.js'
import { getGlobalConfigDir } from '../../../orchestrator/shell/services/config-paths.service.js'

describe('project bootstrap service', () => {
  it('writes config and hosts inside .squadfoundry on repository init', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'squadfoundry-bootstrap-'))

    try {
      await initProject(workspaceDir, { preferredIde: 'claude-code' })

      const configPath = join(workspaceDir, '.squadfoundry', 'config.json')
      const hostsPath = join(workspaceDir, '.squadfoundry', 'hosts.json')

      expect(existsSync(configPath)).toBe(true)
      expect(existsSync(hostsPath)).toBe(true)

      const configContent = JSON.parse(await readFile(configPath, 'utf-8'))
      const hostsContent = JSON.parse(await readFile(hostsPath, 'utf-8'))

      expect(configContent).toEqual({
        version: 1,
        cliMode: 'shell',
        installScope: 'repository',
        preferredIde: 'claude-code',
      })
      expect(hostsContent).toEqual({ preferredHost: null, lastValidated: null, hosts: [] })

      const claudeRunPath = join(workspaceDir, '.squadfoundry', 'claude-code', 'commands', 'squad-run.md')
      const claudeNativeRunPath = join(workspaceDir, '.claude', 'commands', 'squad-run.md')
      expect(existsSync(claudeRunPath)).toBe(true)
      expect(existsSync(claudeNativeRunPath)).toBe(true)

      const claudeRun = await readFile(claudeRunPath, 'utf-8')
      const claudeNativeRun = await readFile(claudeNativeRunPath, 'utf-8')
      expect(claudeRun).toContain('squadfoundry run')
      expect(claudeNativeRun).toContain('squadfoundry run')
    } finally {
      await rm(workspaceDir, { recursive: true, force: true })
    }
  })

  it('fails when config files already exist and force is false', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'squadfoundry-bootstrap-'))

    try {
      await initProject(workspaceDir)

      await expect(initProject(workspaceDir)).rejects.toThrow(/already exist/)
    } finally {
      await rm(workspaceDir, { recursive: true, force: true })
    }
  })

  it('overwrites existing config files when force is true', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'squadfoundry-bootstrap-'))
    const configPath = join(workspaceDir, '.squadfoundry', 'config.json')

    try {
      await initProject(workspaceDir)
      await writeFile(configPath, JSON.stringify({ version: 999, cliMode: 'shell' }), 'utf-8')

      await initProject(workspaceDir, { force: true })

      const configContent = JSON.parse(await readFile(configPath, 'utf-8'))
      expect(configContent).toEqual({
        version: 1,
        cliMode: 'shell',
        installScope: 'repository',
        preferredIde: 'none',
      })
    } finally {
      await rm(workspaceDir, { recursive: true, force: true })
    }
  })

  it('writes global config when scope is global', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'squadfoundry-bootstrap-'))
    const globalDir = getGlobalConfigDir()
    const configPath = join(globalDir, 'config.json')
    const hostsPath = join(globalDir, 'hosts.json')
    const opencodeNativeRunPath = join(workspaceDir, '.opencode', 'commands', 'squad-run.md')

    try {
      await rm(globalDir, { recursive: true, force: true })
      await initProject(workspaceDir, { installScope: 'global', preferredIde: 'opencode' })

      expect(existsSync(configPath)).toBe(true)
      expect(existsSync(hostsPath)).toBe(true)
      expect(existsSync(opencodeNativeRunPath)).toBe(true)

      const configContent = JSON.parse(await readFile(configPath, 'utf-8'))
      expect(configContent.installScope).toBe('global')
    } finally {
      await rm(workspaceDir, { recursive: true, force: true })
      await rm(globalDir, { recursive: true, force: true })
    }
  })
})
