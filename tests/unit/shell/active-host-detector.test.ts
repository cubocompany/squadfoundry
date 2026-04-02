import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { ActiveHostDetector } from '../../../orchestrator/shell/services/active-host-detector.service.js'

describe('active host detector', () => {
  it('returns high confidence for strong host signals', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'squadfoundry-detector-'))

    try {
      const detector = new ActiveHostDetector()
      const result = await detector.detect({ cwd, argv: ['claude'] })

      expect(result.confidence).toBe('high')
      expect(result.detectedHostId).toBe('claude-code')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('detects strong host signal from path-style argv entries', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'squadfoundry-detector-'))

    try {
      const detector = new ActiveHostDetector()
      const result = await detector.detect({
        cwd,
        argv: ['/usr/local/bin/opencode'],
      })

      expect(result.confidence).toBe('high')
      expect(result.detectedHostId).toBe('opencode')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('returns medium confidence for medium-only host signals', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'squadfoundry-detector-'))

    try {
      await writeFile(join(cwd, 'CLAUDE.md'), '# claude marker\n', 'utf-8')

      const detector = new ActiveHostDetector()
      const result = await detector.detect({ cwd, argv: [], env: {} })

      expect(result.confidence).toBe('medium')
      expect(result.detectedHostId).toBe('claude-code')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('resolves score ties deterministically and keeps reasons stable', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'squadfoundry-detector-'))

    try {
      const detector = new ActiveHostDetector()
      const input = {
        cwd,
        env: {
          CLAUDECODE: '1',
          OPENCODE: '1',
        },
      }

      const first = await detector.detect(input)
      const second = await detector.detect(input)

      expect(first.detectedHostId).toBe('claude-code')
      expect(second.detectedHostId).toBe('claude-code')
      expect(first.confidence).toBe('low')
      expect(first.reasons).toEqual(
        [...first.reasons].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
      )
      expect(first.reasons).toEqual(second.reasons)
      expect(first.reasons.some((reason: string) => reason.includes('Tie at score'))).toBe(true)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('returns low confidence when no meaningful signals exist', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'squadfoundry-detector-'))

    try {
      const detector = new ActiveHostDetector()
      const result = await detector.detect({ cwd, argv: [], env: {} })

      expect(result.confidence).toBe('low')
      expect(result.detectedHostId).toBeNull()
      expect(result.reasons).toEqual([])
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
