import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { getGlobalConfigDir, getRepositoryConfigDir, resolveConfigDir } from '../../../orchestrator/shell/services/config-paths.service.js'

describe('config paths service', () => {
  it('uses repository scope when .squadfoundry exists in cwd', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'squadfoundry-config-'))
    const repoDir = getRepositoryConfigDir(cwd)

    try {
      await mkdir(repoDir, { recursive: true })

      const resolved = resolveConfigDir(cwd)
      expect(resolved.scope).toBe('repository')
      expect(resolved.configDir).toBe(repoDir)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('falls back to global scope when repository config is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'squadfoundry-config-'))

    try {
      const resolved = resolveConfigDir(cwd)
      expect(resolved.scope).toBe('global')
      expect(resolved.configDir).toBe(getGlobalConfigDir())
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
