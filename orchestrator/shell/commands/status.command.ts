import type { Command } from 'commander'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createArtifactStore } from '../../artifacts/artifact-store.js'

type StatusOptions = {
  artifacts: string
}

export function registerStatus(program: Command): void {
  program
    .command('status <squad_id> <job_id>')
    .description('Show the current status of a job')
    .option('--artifacts <path>', 'Artifacts directory', 'artifacts')
    .action((squadId: string, jobId: string, opts: StatusOptions) => {
      const store = createArtifactStore(opts.artifacts)
      const job = store.loadJob(squadId, jobId)

      if (!job) {
        throw new Error(`Job not found: ${squadId}/${jobId}`)
      }

      console.log(`Job: ${job.id}`)
      console.log(`Squad: ${job.squadId}`)
      console.log(`Status: ${job.status}`)

      const metadataPath = join(opts.artifacts, squadId, job.id, 'reports', 'runtime-metadata.json')
      if (existsSync(metadataPath)) {
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8')) as Record<string, unknown>
        console.log(`resolvedHost: ${String(metadata['resolvedHost'] ?? 'unknown')}`)
        console.log(`confidence: ${String(metadata['confidence'] ?? 'unknown')}`)
        console.log(`reasons: ${JSON.stringify(metadata['reasons'] ?? [])}`)
        console.log(`activeModel: ${String(metadata['activeModel'] ?? 'host-default')}`)
        console.log(`fallbackPath: ${String(metadata['fallbackPath'] ?? 'unknown')}`)
      }
    })
}
