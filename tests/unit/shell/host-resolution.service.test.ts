import { describe, expect, it } from 'vitest'

import type { IHostAdapter } from '../../../orchestrator/adapters/host/IHostAdapter.js'
import type { ActiveHostDetectionResult } from '../../../orchestrator/shell/services/active-host-detector.service.js'
import {
  HostResolutionService,
  type PersistedHostPreference,
} from '../../../orchestrator/shell/services/host-resolution.service.js'

function buildDetectionResult(overrides: Partial<ActiveHostDetectionResult> = {}): ActiveHostDetectionResult {
  return {
    detectedHostId: 'opencode',
    confidence: 'medium',
    reasons: ['opencode medium signal via file OPENCODE.md'],
    scores: { opencode: 30, 'claude-code': 0 },
    signals: [
      {
        hostId: 'opencode',
        strength: 'medium',
        key: 'file:OPENCODE.md',
        reason: 'opencode medium signal via file OPENCODE.md',
      },
    ],
    ...overrides,
  }
}

function makeHostAdapter(hostId: string, shouldInitFail = false): IHostAdapter {
  return {
    id: hostId,
    name: hostId,
    async initialize(): Promise<void> {
      if (shouldInitFail) {
        throw new Error('Initialization failed')
      }
    },
    detect() {
      return {
        isDetected: true,
        confidence: 'medium' as const,
        reasons: ['test host mock'],
      }
    },
    async runInterviewTurn() {
      return {
        content: 'mock interview response',
        status: 'continue' as const,
      }
    },
    async getActiveModel() {
      return 'mock-model'
    },
    async sendPrompt() {
      throw new Error('Not implemented in unit test')
    },
    getCapabilities() {
      return {
        supportsStreaming: false,
        supportsToolUse: false,
        supportsVision: false,
        maxContextTokens: 0,
        supportedModels: [],
      }
    },
    async healthCheck() {
      return true
    },
  }
}

describe('host resolution service', () => {
  it('uses detected host directly when confidence is high', async () => {
    const persistedWrites: PersistedHostPreference[] = []
    const service = new HostResolutionService({
      loadPersistedPreference: async () => null,
      persistPreferredHost: async (preference) => {
        persistedWrites.push(preference)
      },
      getHostAdapter: () => makeHostAdapter('opencode'),
      isCommandSupported: async () => true,
      assistedSelectHost: async () => 'claude-code',
      now: () => new Date('2026-04-01T12:00:00.000Z'),
    })

    const result = await service.resolve({
      commandId: 'create',
      detection: buildDetectionResult({
        confidence: 'high',
        detectedHostId: 'opencode',
        scores: { opencode: 100, 'claude-code': 0 },
      }),
    })

    expect(result.path).toBe('detected')
    expect(result.hostId).toBe('opencode')
    expect(persistedWrites).toHaveLength(1)
    expect(persistedWrites[0]?.preferredHost).toBe('opencode')
  })

  it('falls back to assisted selection when high-confidence host is unsupported', async () => {
    const service = new HostResolutionService({
      loadPersistedPreference: async () => null,
      persistPreferredHost: async () => {},
      getHostAdapter: () => makeHostAdapter('opencode'),
      isCommandSupported: async () => false,
      assistedSelectHost: async () => 'claude-code',
      now: () => new Date('2026-04-01T12:00:00.000Z'),
    })

    const result = await service.resolve({
      commandId: 'run',
      detection: buildDetectionResult({
        confidence: 'high',
        detectedHostId: 'opencode',
        scores: { opencode: 100, 'claude-code': 0 },
      }),
    })

    expect(result.path).toBe('assisted-selection')
    expect(result.hostId).toBe('claude-code')
  })

  it('prompts user when confidence is low', async () => {
    const service = new HostResolutionService({
      loadPersistedPreference: async () => ({
        preferredHost: 'opencode',
        validation: {
          timestamp: '2026-03-31T00:00:00.000Z',
          matchedSignals: ['file:OPENCODE.md'],
        },
      }),
      persistPreferredHost: async () => {},
      getHostAdapter: () => makeHostAdapter('opencode'),
      isCommandSupported: async () => true,
      assistedSelectHost: async () => 'claude-code',
      now: () => new Date('2026-04-01T12:00:00.000Z'),
    })

    const result = await service.resolve({
      commandId: 'create',
      detection: buildDetectionResult({
        confidence: 'low',
        detectedHostId: null,
        reasons: [],
        scores: { opencode: 0, 'claude-code': 0 },
        signals: [],
      }),
    })

    expect(result.path).toBe('assisted-selection')
    expect(result.hostId).toBe('claude-code')
  })

  it('rejects persisted host when adapter initialization fails', async () => {
    const service = new HostResolutionService({
      loadPersistedPreference: async () => ({
        preferredHost: 'opencode',
        validation: {
          timestamp: '2026-03-31T00:00:00.000Z',
          matchedSignals: ['file:OPENCODE.md'],
        },
      }),
      persistPreferredHost: async () => {},
      getHostAdapter: () => makeHostAdapter('opencode', true),
      isCommandSupported: async () => true,
      assistedSelectHost: async () => 'claude-code',
      now: () => new Date('2026-04-01T12:00:00.000Z'),
    })

    const result = await service.resolve({
      commandId: 'create',
      detection: buildDetectionResult(),
    })

    expect(result.path).toBe('assisted-selection')
  })

  it('rejects persisted host when capability check fails for command', async () => {
    const service = new HostResolutionService({
      loadPersistedPreference: async () => ({
        preferredHost: 'opencode',
        validation: {
          timestamp: '2026-03-31T00:00:00.000Z',
          matchedSignals: ['file:OPENCODE.md'],
        },
      }),
      persistPreferredHost: async () => {},
      getHostAdapter: () => makeHostAdapter('opencode'),
      isCommandSupported: async () => false,
      assistedSelectHost: async () => 'claude-code',
      now: () => new Date('2026-04-01T12:00:00.000Z'),
    })

    const result = await service.resolve({
      commandId: 'create',
      detection: buildDetectionResult(),
    })

    expect(result.path).toBe('assisted-selection')
  })

  it('falls back to assisted selection when capability check throws', async () => {
    const service = new HostResolutionService({
      loadPersistedPreference: async () => ({
        preferredHost: 'opencode',
        validation: {
          timestamp: '2026-03-31T00:00:00.000Z',
          matchedSignals: ['file:OPENCODE.md'],
        },
      }),
      persistPreferredHost: async () => {},
      getHostAdapter: () => makeHostAdapter('opencode'),
      isCommandSupported: async () => {
        throw new Error('capability check failed')
      },
      assistedSelectHost: async () => 'claude-code',
      now: () => new Date('2026-04-01T12:00:00.000Z'),
    })

    const result = await service.resolve({
      commandId: 'create',
      detection: buildDetectionResult(),
    })

    expect(result.path).toBe('assisted-selection')
    expect(result.hostId).toBe('claude-code')
  })

  it('rejects persisted host without medium/strong signal match', async () => {
    const service = new HostResolutionService({
      loadPersistedPreference: async () => ({
        preferredHost: 'opencode',
        validation: {
          timestamp: '2026-03-31T00:00:00.000Z',
          matchedSignals: ['file:CLAUDE.md'],
        },
      }),
      persistPreferredHost: async () => {},
      getHostAdapter: () => makeHostAdapter('opencode'),
      isCommandSupported: async () => true,
      assistedSelectHost: async () => 'claude-code',
      now: () => new Date('2026-04-01T12:00:00.000Z'),
    })

    const result = await service.resolve({
      commandId: 'create',
      detection: buildDetectionResult(),
    })

    expect(result.path).toBe('assisted-selection')
  })

  it('persists validation metadata for accepted host', async () => {
    const persistedWrites: PersistedHostPreference[] = []
    const service = new HostResolutionService({
      loadPersistedPreference: async () => ({
        preferredHost: 'opencode',
        validation: {
          timestamp: '2026-03-31T00:00:00.000Z',
          matchedSignals: ['file:OPENCODE.md'],
        },
      }),
      persistPreferredHost: async (preference) => {
        persistedWrites.push(preference)
      },
      getHostAdapter: () => makeHostAdapter('opencode'),
      isCommandSupported: async () => true,
      assistedSelectHost: async () => 'claude-code',
      now: () => new Date('2026-04-01T12:00:00.000Z'),
    })

    const result = await service.resolve({
      commandId: 'create',
      detection: buildDetectionResult(),
    })

    expect(result.path).toBe('persisted')
    expect(result.validation.timestamp).toBe('2026-04-01T12:00:00.000Z')
    expect(result.validation.matchedSignals.length).toBeGreaterThan(0)
    expect(persistedWrites).toHaveLength(1)
    expect(persistedWrites[0]?.validation?.matchedSignals.length).toBeGreaterThan(0)
  })
})
