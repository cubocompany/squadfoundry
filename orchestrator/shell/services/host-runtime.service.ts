import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { dirname, join } from 'node:path'

import { AntigravityHostAdapter } from '../../adapters/host/antigravity.adapter.js'
import { AnthropicHostAdapter } from '../../adapters/host/anthropic.adapter.js'
import { ClaudeCodeHostAdapter } from '../../adapters/host/claude-code.adapter.js'
import type { IHostAdapter } from '../../adapters/host/IHostAdapter.js'
import { LocalHostAdapter } from '../../adapters/host/local.adapter.js'
import { OpenAIHostAdapter } from '../../adapters/host/openai.adapter.js'
import { OpenCodeHostAdapter } from '../../adapters/host/opencode.adapter.js'
import { ActiveHostDetector } from './active-host-detector.service.js'
import {
  HostResolutionService,
  type HostResolutionResult,
  type PersistedHostPreference,
} from './host-resolution.service.js'
import { SQUADFOUNDRY_HOSTS_FILE, resolveConfigDir } from './config-paths.service.js'

type StoredHostPreferences = {
  preferredHost: string | null
  validation?: PersistedHostPreference['validation'] | null
  lastValidated?: string | null
  hosts?: string[]
}

export type ResolvedHostRuntime = {
  hostAdapter: IHostAdapter
  hostId: string
  path: HostResolutionResult['path']
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
  activeModel: string
  validation: HostResolutionResult['validation']
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function createAdapter(hostId: string): IHostAdapter | null {
  if (hostId === 'claude-code') {
    return new ClaudeCodeHostAdapter()
  }
  if (hostId === 'opencode') {
    return new OpenCodeHostAdapter()
  }
  switch (hostId) {
    case 'local':
      return new LocalHostAdapter()
    case 'antigravity':
      return new AntigravityHostAdapter()
    case 'anthropic':
      return new AnthropicHostAdapter()
    case 'openai':
      return new OpenAIHostAdapter()
    default:
      return null
  }
}

function getAvailableHostIds(): string[] {
  return ['claude-code', 'opencode', 'local', 'antigravity', 'anthropic', 'openai']
}

export class HostRuntimeService {
  private cwd: string
  private adapterCache = new Map<string, IHostAdapter>()

  constructor(cwd: string) {
    this.cwd = cwd
  }

  private getPreferencesPath(): string {
    const { configDir } = resolveConfigDir(this.cwd)
    return join(configDir, SQUADFOUNDRY_HOSTS_FILE)
  }

  private async loadPersistedPreference(): Promise<PersistedHostPreference | null> {
    const path = this.getPreferencesPath()
    if (!(await fileExists(path))) return null

    let json: StoredHostPreferences
    try {
      const raw = await readFile(path, 'utf-8')
      json = JSON.parse(raw) as StoredHostPreferences
    } catch {
      return null
    }
    if (!json || typeof json !== 'object') return null

    const validation = json.validation
      ?? (json.lastValidated
        ? { timestamp: json.lastValidated, matchedSignals: [] }
        : null)

    return {
      preferredHost: typeof json.preferredHost === 'string' ? json.preferredHost : null,
      validation,
    }
  }

  private async persistPreferredHost(preference: PersistedHostPreference): Promise<void> {
    const path = this.getPreferencesPath()
    await mkdir(dirname(path), { recursive: true })
    const existing = await this.loadPersistedPreference()
    const knownHosts = new Set<string>([
      ...(existing?.preferredHost ? [existing.preferredHost] : []),
      ...getAvailableHostIds(),
      ...(preference.preferredHost ? [preference.preferredHost] : []),
    ])

    const payload: StoredHostPreferences = {
      preferredHost: preference.preferredHost,
      validation: preference.validation,
      lastValidated: preference.validation?.timestamp ?? null,
      hosts: [...knownHosts].sort((a, b) => a.localeCompare(b)),
    }

    await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  }

  private getHostAdapter(hostId: string): IHostAdapter | null {
    const cached = this.adapterCache.get(hostId)
    if (cached) return cached

    const created = createAdapter(hostId)
    if (!created) return null
    this.adapterCache.set(hostId, created)
    return created
  }

  private async assistedSelectHost(): Promise<string> {
    if (!process.stdin.isTTY) {
      throw new Error(
        'Host could not be resolved automatically. Re-run in interactive terminal or set SQUAD_FOUNDRY_ADAPTER explicitly.',
      )
    }

    const available = getAvailableHostIds()
    const rl = createInterface({ input, output })
    try {
      output.write('\nSelect host adapter for this project:\n')
      available.forEach((hostId, idx) => {
        output.write(`  ${idx + 1}. ${hostId}\n`)
      })

      const answer = (await rl.question('Host number: ')).trim()
      const index = Number(answer) - 1
      if (Number.isNaN(index) || index < 0 || index >= available.length) {
        throw new Error('Invalid host selection.')
      }
      return available[index] as string
    } finally {
      rl.close()
    }
  }

  private normalizeExplicitHostId(rawValue: string): string {
    const normalized = rawValue.trim().toLowerCase()
    if (normalized === 'claude') return 'claude-code'
    return normalized
  }

  async resolveForCommand(commandId: string): Promise<ResolvedHostRuntime> {
    const explicitAdapter = process.env['SQUAD_FOUNDRY_ADAPTER']
    if (explicitAdapter && explicitAdapter.trim() !== '' && explicitAdapter !== 'auto') {
      const normalizedHostId = this.normalizeExplicitHostId(explicitAdapter)
      const adapter = this.getHostAdapter(normalizedHostId)
      if (!adapter) {
        const supported = getAvailableHostIds().join(', ')
        throw new Error(
          `Unsupported adapter '${explicitAdapter}'. Supported adapters: ${supported}.`,
        )
      }

      const validation = {
        timestamp: new Date().toISOString(),
        matchedSignals: ['env:SQUAD_FOUNDRY_ADAPTER'],
      }
      await this.persistPreferredHost({
        preferredHost: normalizedHostId,
        validation,
      })

      await adapter.initialize()
      const activeModel = (await adapter.getActiveModel()) ?? 'host-default'

      return {
        hostAdapter: adapter,
        hostId: normalizedHostId,
        path: 'detected',
        confidence: 'high',
        reasons: [`Explicit host override via SQUAD_FOUNDRY_ADAPTER='${explicitAdapter}'`],
        activeModel,
        validation,
      }
    }

    const detector = new ActiveHostDetector()
    const detection = await detector.detect({
      cwd: this.cwd,
      argv: process.argv,
      env: process.env,
      processHints: [process.title],
    })

    const resolver = new HostResolutionService({
      loadPersistedPreference: async () => this.loadPersistedPreference(),
      persistPreferredHost: async (pref) => this.persistPreferredHost(pref),
      getHostAdapter: (hostId) => this.getHostAdapter(hostId),
      isCommandSupported: async (hostId, requestedCommandId) => {
        const adapter = this.getHostAdapter(hostId)
        if (!adapter) return false
        if (requestedCommandId === 'list' || requestedCommandId === 'status' || requestedCommandId === 'hosts') {
          return true
        }
        return true
      },
      assistedSelectHost: async () => this.assistedSelectHost(),
    })

    const result = await resolver.resolve({ detection, commandId })
    const adapter = this.getHostAdapter(result.hostId)
    if (!adapter) {
      throw new Error(`Resolved host '${result.hostId}' is not supported in this runtime.`)
    }

    await adapter.initialize()
    const activeModel = (await adapter.getActiveModel()) ?? 'host-default'

    return {
      hostAdapter: adapter,
      hostId: result.hostId,
      path: result.path,
      confidence: detection.confidence,
      reasons: detection.reasons,
      activeModel,
      validation: result.validation,
    }
  }
}
