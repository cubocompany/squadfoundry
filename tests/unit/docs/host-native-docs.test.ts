import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('host-native documentation', () => {
  it('documents init command and host-native resolution in README', () => {
    const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf-8')
    expect(readme).toContain('squadfoundry init')
    expect(readme.toLowerCase()).toContain('host-native')
  })

  it('documents detection and resolution reference doc', () => {
    const doc = readFileSync(
      join(process.cwd(), 'docs', 'development', 'host-detection-and-resolution.md'),
      'utf-8',
    )
    expect(doc).toContain('ActiveHostDetector')
    expect(doc).toContain('HostResolutionService')
    expect(doc).toContain('runtime-metadata.json')
    expect(doc).toContain('SQUAD_FOUNDRY_ADAPTER')
  })
})
