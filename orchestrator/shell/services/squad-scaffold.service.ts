import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const RESERVED_SQUAD_DIRS = new Set(['templates', 'examples'])

export function resolveSquadConfigPath(cwd: string, squadId: string): string | null {
  const primary = join(cwd, 'squads', squadId, 'config', 'squad.json')
  if (existsSync(primary)) return primary

  const example = join(cwd, 'squads', 'examples', squadId, 'config', 'squad.json')
  if (existsSync(example)) return example

  return null
}

export function listSquadIds(cwd: string): string[] {
  const squadsDir = join(cwd, 'squads')
  if (!existsSync(squadsDir)) return []

  const rootSquads = readdirSync(squadsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !RESERVED_SQUAD_DIRS.has(entry.name))
    .map((entry) => entry.name)

  const exampleDir = join(squadsDir, 'examples')
  const exampleSquads = existsSync(exampleDir)
    ? readdirSync(exampleDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
    : []

  return [...new Set([...rootSquads, ...exampleSquads])]
    .filter((squadId) => resolveSquadConfigPath(cwd, squadId) !== null)
    .sort((a, b) => a.localeCompare(b))
}
