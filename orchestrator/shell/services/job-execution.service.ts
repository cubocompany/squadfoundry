import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { SquadDefinition } from '../../core/types.js'
import { createSquadRuntime } from '../../runtime/squad-runtime.js'
import { HostRuntimeService } from './host-runtime.service.js'

export type RunSquadOptions = {
  cwd: string
  artifactsDir: string
  squad: SquadDefinition
  objective: string
  input: string
}

export type RunSquadResult = {
  squad: SquadDefinition
  jobId: string
  status: string
  resolvedHost: string
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
  activeModel: string
  fallbackPath: 'detected' | 'persisted' | 'assisted-selection'
}

export class JobExecutionService {
  async runSquad(options: RunSquadOptions): Promise<RunSquadResult> {
    const hostRuntime = new HostRuntimeService(options.cwd)
    const resolved = await hostRuntime.resolveForCommand('run')

    const runtime = createSquadRuntime({
      artifactsDir: options.artifactsDir,
      hostAdapter: resolved.hostAdapter,
      contextRootPath: options.cwd,
    })

    const job = await runtime.startJob(options.squad, options.objective, options.input)
    await runtime.runAll(options.squad, job)

    const metadata = {
      resolvedHost: resolved.hostId,
      confidence: resolved.confidence,
      reasons: resolved.reasons,
      activeModel: resolved.activeModel,
      fallbackPath: resolved.path,
      timestamp: new Date().toISOString(),
    }

    const metadataPath = join(
      options.artifactsDir,
      options.squad.id,
      job.id,
      'reports',
      'runtime-metadata.json',
    )
    await mkdir(dirname(metadataPath), { recursive: true })
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf-8')

    return {
      squad: options.squad,
      jobId: job.id,
      status: job.status,
      resolvedHost: resolved.hostId,
      confidence: resolved.confidence,
      reasons: resolved.reasons,
      activeModel: resolved.activeModel,
      fallbackPath: resolved.path,
    }
  }
}
