import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Command } from 'commander'
import type { SquadDefinition } from '../../core/types.js'
import { JobExecutionService } from '../services/job-execution.service.js'
import { resolveSquadConfigPath } from '../services/squad-scaffold.service.js'

type RunOptions = {
  input: string
  objective: string
  cwd: string
  artifacts: string
}

function isSquadDefinition(value: unknown): value is SquadDefinition {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>

  if (typeof obj['id'] !== 'string' || typeof obj['name'] !== 'string') return false

  if (!Array.isArray(obj['agents']) || obj['agents'].length === 0) return false
  const hasValidAgents = obj['agents'].every((agent) => {
    if (!agent || typeof agent !== 'object') return false
    const a = agent as Record<string, unknown>
    return typeof a['id'] === 'string'
      && typeof a['name'] === 'string'
      && typeof a['instructions'] === 'string'
      && Array.isArray(a['allowedStates'])
  })
  if (!hasValidAgents) return false

  if (!obj['workflow'] || typeof obj['workflow'] !== 'object') return false
  const workflow = obj['workflow'] as Record<string, unknown>
  if (!Array.isArray(workflow['steps']) || workflow['steps'].length === 0) return false
  const hasValidSteps = workflow['steps'].every((step) => {
    if (!step || typeof step !== 'object') return false
    const s = step as Record<string, unknown>
    return typeof s['id'] === 'string'
      && typeof s['agentId'] === 'string'
      && typeof s['name'] === 'string'
      && typeof s['type'] === 'string'
  })

  return hasValidSteps
}

export function registerRun(program: Command): void {
  program
    .command('run <squad_id>')
    .description('Execute a job for an existing squad')
    .option('--input <text>', 'Initial input / task description', '')
    .option('--objective <text>', 'Job objective', 'Execute squad workflow')
    .option('--cwd <path>', 'Context root path', process.cwd())
    .option('--artifacts <path>', 'Artifacts directory', 'artifacts')
    .action(async (squadId: string, opts: RunOptions) => {
      const squadConfigPath = resolveSquadConfigPath(opts.cwd, squadId)
      if (!squadConfigPath) {
        throw new Error(`[Error] Squad not found for id '${squadId}' in squads/ or squads/examples/.`)
      }

      const squadConfigUrl = pathToFileURL(resolve(squadConfigPath)).href
      const { default: squadJson } = await import(squadConfigUrl, { with: { type: 'json' } }) as { default: unknown }
      if (!isSquadDefinition(squadJson)) {
        throw new Error(`[Error] Invalid squad definition: ${squadConfigPath}`)
      }
      const squad = squadJson

      const execution = new JobExecutionService()
      const result = await execution.runSquad({
        cwd: opts.cwd,
        artifactsDir: opts.artifacts,
        squad,
        objective: opts.objective,
        input: opts.input,
      })

      console.log(`[Squad Foundry] Job ${result.jobId} finished with status: ${result.status}`)
      console.log(`[Squad Foundry] Host: ${result.resolvedHost} | Model: ${result.activeModel} | Path: ${result.fallbackPath}`)
    })
}
