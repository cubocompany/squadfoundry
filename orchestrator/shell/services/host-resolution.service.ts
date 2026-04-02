import type { IHostAdapter } from '../../adapters/host/IHostAdapter.js'
import type { ActiveHostDetectionResult } from './active-host-detector.service.js'

export type HostValidationMetadata = {
  timestamp: string
  matchedSignals: string[]
}

export type PersistedHostPreference = {
  preferredHost: string | null
  validation: HostValidationMetadata | null
}

export type HostResolutionPath = 'detected' | 'persisted' | 'assisted-selection'

export type HostResolutionInput = {
  detection: ActiveHostDetectionResult
  commandId: string
}

export type HostResolutionResult = {
  hostId: string
  path: HostResolutionPath
  validation: HostValidationMetadata
}

type AssistedSelectionContext = {
  detection: ActiveHostDetectionResult
  commandId: string
}

type HostResolutionDependencies = {
  loadPersistedPreference: () => Promise<PersistedHostPreference | null>
  persistPreferredHost: (preference: PersistedHostPreference) => Promise<void>
  getHostAdapter: (hostId: string) => IHostAdapter | null
  isCommandSupported: (hostId: string, commandId: string) => Promise<boolean> | boolean
  assistedSelectHost: (context: AssistedSelectionContext) => Promise<string>
  now?: () => Date
}

function collectMediumStrongSignalKeys(detection: ActiveHostDetectionResult, hostId: string): string[] {
  return detection.signals
    .filter((signal) => signal.hostId === hostId && (signal.strength === 'medium' || signal.strength === 'strong'))
    .map((signal) => signal.key)
    .sort((a, b) => a.localeCompare(b))
}

function buildValidationMetadata(
  detection: ActiveHostDetectionResult,
  hostId: string,
  now: () => Date,
): HostValidationMetadata {
  return {
    timestamp: now().toISOString(),
    matchedSignals: collectMediumStrongSignalKeys(detection, hostId),
  }
}

export class HostResolutionService {
  private deps: HostResolutionDependencies

  constructor(dependencies: HostResolutionDependencies) {
    this.deps = dependencies
  }

  async resolve(input: HostResolutionInput): Promise<HostResolutionResult> {
    const now = this.deps.now ?? (() => new Date())
    const { detection } = input

    if (detection.confidence === 'high' && detection.detectedHostId !== null) {
      const isValidDetected = await this.isHostAvailableForCommand(detection.detectedHostId, input.commandId)
      if (isValidDetected) {
        const validation = buildValidationMetadata(detection, detection.detectedHostId, now)
        await this.deps.persistPreferredHost({
          preferredHost: detection.detectedHostId,
          validation,
        })

        return {
          hostId: detection.detectedHostId,
          path: 'detected',
          validation,
        }
      }
    }

    if (detection.confidence === 'medium') {
      const persisted = await this.deps.loadPersistedPreference()
      const validPersistedHost = await this.getValidPersistedHostId(input, persisted)

      if (validPersistedHost !== null) {
        const validation = buildValidationMetadata(detection, validPersistedHost, now)
        await this.deps.persistPreferredHost({
          preferredHost: validPersistedHost,
          validation,
        })

        return {
          hostId: validPersistedHost,
          path: 'persisted',
          validation,
        }
      }
    }

    return this.resolveAssistedSelection(input, now)
  }

  private async getValidPersistedHostId(
    input: HostResolutionInput,
    persisted: PersistedHostPreference | null,
  ): Promise<string | null> {
    const persistedHost = persisted?.preferredHost ?? null
    if (persistedHost === null) return null

    const adapter = this.deps.getHostAdapter(persistedHost)
    if (adapter === null) return null

    const isAvailableForCommand = await this.isHostAvailableForCommand(persistedHost, input.commandId)
    if (!isAvailableForCommand) return null

    const priorMatchedSignals = new Set(persisted?.validation?.matchedSignals ?? [])
    if (priorMatchedSignals.size === 0) return null

    const currentSignalKeys = collectMediumStrongSignalKeys(input.detection, persistedHost)
    const hasSignalMatch = currentSignalKeys.some((key) => priorMatchedSignals.has(key))
    if (!hasSignalMatch) return null

    return persistedHost
  }

  private async isHostAvailableForCommand(hostId: string, commandId: string): Promise<boolean> {
    const adapter = this.deps.getHostAdapter(hostId)
    if (adapter === null) return false

    try {
      await adapter.initialize()
    } catch {
      return false
    }

    try {
      const supportsCommand = await this.deps.isCommandSupported(hostId, commandId)
      return supportsCommand
    } catch {
      return false
    }
  }

  private async resolveAssistedSelection(
    input: HostResolutionInput,
    now: () => Date,
  ): Promise<HostResolutionResult> {
    const selectedHostId = await this.deps.assistedSelectHost({
      detection: input.detection,
      commandId: input.commandId,
    })
    const validation = buildValidationMetadata(input.detection, selectedHostId, now)

    await this.deps.persistPreferredHost({
      preferredHost: selectedHostId,
      validation,
    })

    return {
      hostId: selectedHostId,
      path: 'assisted-selection',
      validation,
    }
  }
}
