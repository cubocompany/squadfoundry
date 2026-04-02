import { access, mkdtemp, mkdir, writeFile } from 'node:fs/promises'
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

  it('fails create command with clear message in non-interactive mode', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sf-shell-test-'))
    const previous = process.env['SQUAD_FOUNDRY_ADAPTER']
    process.env['SQUAD_FOUNDRY_ADAPTER'] = 'claude-code'

    try {
      await expect(
        createShellProgram().parseAsync(['node', 'squadfoundry', 'create', '--cwd', cwd, '--out', cwd]),
      ).rejects.toThrow(/requires an interactive terminal/)
    } finally {
      if (previous === undefined) {
        delete process.env['SQUAD_FOUNDRY_ADAPTER']
      } else {
        process.env['SQUAD_FOUNDRY_ADAPTER'] = previous
      }
    }
  })

  it('fails edit command with clear message in non-interactive mode', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sf-shell-test-'))
    const configDir = join(cwd, 'squads', 'software-development', 'config')
    await mkdir(configDir, { recursive: true })
    await writeFile(
      join(configDir, 'squad.json'),
      JSON.stringify({ id: 'software-development', name: 'Software Development', agents: [], workflow: { steps: [] } }),
      'utf-8',
    )

    const previous = process.env['SQUAD_FOUNDRY_ADAPTER']
    process.env['SQUAD_FOUNDRY_ADAPTER'] = 'claude-code'

    try {
      await expect(
        createShellProgram().parseAsync(['node', 'squadfoundry', 'edit', 'software-development', '--cwd', cwd, '--out', cwd]),
      ).rejects.toThrow(/requires an interactive terminal/)
    } finally {
      if (previous === undefined) {
        delete process.env['SQUAD_FOUNDRY_ADAPTER']
      } else {
        process.env['SQUAD_FOUNDRY_ADAPTER'] = previous
      }
    }
  })

  it('creates squad in non-interactive mode with answers file', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sf-shell-test-'))
    const answersPath = join(cwd, 'answers.json')
    await writeFile(answersPath, JSON.stringify({
      q_objective: 'Handle development requests',
      q_domain: 'Software Development',
      q_description: 'Receives tasks, builds code, reviews and publishes',
      q_inputs: 'Jira ticket',
      q_outputs: 'Pull request opened',
      q_steps: 'Intake, Development, Review, Test, Publish',
      q_approvals: 'publish and deploy',
      q_human_in_loop: 'approval and production deploy',
      q_squad_name: 'uqbar-ti',
    }, null, 2), 'utf-8')

    await createShellProgram().parseAsync([
      'node',
      'squadfoundry',
      'create',
      '--cwd',
      cwd,
      '--out',
      cwd,
      '--answers-file',
      answersPath,
    ])

    await expect(access(join(cwd, 'squads', 'uqbar-ti', 'config', 'squad.json'))).resolves.toBeUndefined()
  })
})
