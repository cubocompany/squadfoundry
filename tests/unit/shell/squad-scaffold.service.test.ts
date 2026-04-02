import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { listSquadIds, resolveSquadConfigPath } from '../../../orchestrator/shell/services/squad-scaffold.service.js'

describe('squad scaffold service', () => {
  it('resolves squad config from root squads first', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'squadfoundry-scaffold-'))
    const rootConfigDir = join(cwd, 'squads', 'alpha', 'config')
    const exampleConfigDir = join(cwd, 'squads', 'examples', 'alpha', 'config')

    try {
      await mkdir(rootConfigDir, { recursive: true })
      await mkdir(exampleConfigDir, { recursive: true })
      await writeFile(join(rootConfigDir, 'squad.json'), '{}', 'utf-8')
      await writeFile(join(exampleConfigDir, 'squad.json'), '{}', 'utf-8')

      const path = resolveSquadConfigPath(cwd, 'alpha')
      expect(path).toBe(join(rootConfigDir, 'squad.json'))
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('lists root and example squad ids without duplicates', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'squadfoundry-scaffold-'))

    try {
      await mkdir(join(cwd, 'squads', 'alpha', 'config'), { recursive: true })
      await mkdir(join(cwd, 'squads', 'examples', 'beta', 'config'), { recursive: true })
      await mkdir(join(cwd, 'squads', 'examples', 'alpha', 'config'), { recursive: true })
      await writeFile(join(cwd, 'squads', 'alpha', 'config', 'squad.json'), '{}', 'utf-8')
      await writeFile(join(cwd, 'squads', 'examples', 'beta', 'config', 'squad.json'), '{}', 'utf-8')
      await writeFile(join(cwd, 'squads', 'examples', 'alpha', 'config', 'squad.json'), '{}', 'utf-8')

      const ids = listSquadIds(cwd)
      expect(ids).toEqual(['alpha', 'beta'])
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
