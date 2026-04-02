import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { HostRuntimeService } from '../../../orchestrator/shell/services/host-runtime.service.js'

const ORIGINAL_ADAPTER = process.env['SQUAD_FOUNDRY_ADAPTER']

afterEach(() => {
  if (ORIGINAL_ADAPTER === undefined) {
    delete process.env['SQUAD_FOUNDRY_ADAPTER']
    return
  }
  process.env['SQUAD_FOUNDRY_ADAPTER'] = ORIGINAL_ADAPTER
})

describe('host runtime service', () => {
  it('resolves explicit adapter from environment variable', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'squadfoundry-runtime-'))

    try {
      process.env['SQUAD_FOUNDRY_ADAPTER'] = 'claude-code'
      const service = new HostRuntimeService(cwd)
      const result = await service.resolveForCommand('hosts')

      expect(result.hostId).toBe('claude-code')
      expect(result.path).toBe('detected')
      expect(result.confidence).toBe('high')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('accepts claude alias in explicit adapter environment variable', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'squadfoundry-runtime-'))

    try {
      process.env['SQUAD_FOUNDRY_ADAPTER'] = 'claude'
      const service = new HostRuntimeService(cwd)
      const result = await service.resolveForCommand('hosts')

      expect(result.hostId).toBe('claude-code')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('throws clear error for unsupported explicit adapter', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'squadfoundry-runtime-'))

    try {
      process.env['SQUAD_FOUNDRY_ADAPTER'] = 'unknown-host'
      const service = new HostRuntimeService(cwd)
      await expect(service.resolveForCommand('hosts')).rejects.toThrow(/Unsupported adapter 'unknown-host'/)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
