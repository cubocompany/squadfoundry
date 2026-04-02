import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { initProject } from '../../../orchestrator/shell/services/project-bootstrap.service.js'

describe('project bootstrap service', () => {
  it('writes squadfoundry.config.json and squadfoundry.hosts.json on init', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'squadfoundry-bootstrap-'))

    try {
      await initProject(workspaceDir)

      const configPath = join(workspaceDir, 'squadfoundry.config.json')
      const hostsPath = join(workspaceDir, 'squadfoundry.hosts.json')

      expect(existsSync(configPath)).toBe(true)
      expect(existsSync(hostsPath)).toBe(true)

      const configContent = JSON.parse(await readFile(configPath, 'utf-8'))
      const hostsContent = JSON.parse(await readFile(hostsPath, 'utf-8'))

      expect(configContent).toEqual({ version: 1, cliMode: 'shell' })
      expect(hostsContent).toEqual({ preferredHost: null, lastValidated: null, hosts: [] })

      const opencodeRunPath = join(workspaceDir, '.opencode', 'commands', 'squad-run.md')
      const claudeRunPath = join(workspaceDir, '.claude', 'commands', 'squad-run.md')
      expect(existsSync(opencodeRunPath)).toBe(true)
      expect(existsSync(claudeRunPath)).toBe(true)

      const opencodeRun = await readFile(opencodeRunPath, 'utf-8')
      const claudeRun = await readFile(claudeRunPath, 'utf-8')
      expect(opencodeRun).toContain('squadfoundry run')
      expect(claudeRun).toContain('squadfoundry run')
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
    const configPath = join(workspaceDir, 'squadfoundry.config.json')

    try {
      await initProject(workspaceDir)
      await writeFile(configPath, JSON.stringify({ version: 999, cliMode: 'shell' }), 'utf-8')

      await initProject(workspaceDir, { force: true })

      const configContent = JSON.parse(await readFile(configPath, 'utf-8'))
      expect(configContent).toEqual({ version: 1, cliMode: 'shell' })
    } finally {
      await rm(workspaceDir, { recursive: true, force: true })
    }
  })
})
