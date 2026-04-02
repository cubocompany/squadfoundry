import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { createShellProgram } from '../../../orchestrator/shell/cli.js'

describe('Host-native shell CLI', () => {
  it('prints help with init/create/edit/run/list/status/hosts', () => {
    const output = createShellProgram().helpInformation()

    expect(output).toContain('init')
    expect(output).toContain('create')
    expect(output).toContain('edit')
    expect(output).toContain('run')
    expect(output).toContain('list')
    expect(output).toContain('status')
    expect(output).toContain('hosts')
  })

  it('fails run command when squad file does not exist', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sf-shell-test-'))
    const program = createShellProgram()

    await expect(
      program.parseAsync(['node', 'squadfoundry', 'run', 'missing-squad', '--cwd', cwd]),
    ).rejects.toThrow(/Squad not found/)
  })

  it('fails run command on invalid squad definition', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sf-shell-test-'))
    const configDir = join(cwd, 'squads', 'bad', 'config')
    await mkdir(configDir, { recursive: true })
    await writeFile(join(configDir, 'squad.json'), JSON.stringify({ id: 1, name: true }), 'utf-8')

    const program = createShellProgram()

    await expect(
      program.parseAsync(['node', 'squadfoundry', 'run', 'bad', '--cwd', cwd]),
    ).rejects.toThrow(/Invalid squad definition/)
  })

  it('prints no-squad message for list command in empty workspace', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sf-shell-test-'))
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
      await createShellProgram().parseAsync(['node', 'squadfoundry', 'list', '--cwd', cwd])
      expect(spy).toHaveBeenCalledWith('No squads found.')
    } finally {
      spy.mockRestore()
    }
  })
})
