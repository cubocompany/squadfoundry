import { access } from 'node:fs/promises'
import { basename, join } from 'node:path'

export type SignalStrength = 'strong' | 'medium' | 'weak'
export type DetectionConfidence = 'high' | 'medium' | 'low'

export type HostDetectionSignal = {
  hostId: string
  strength: SignalStrength
  key: string
  reason: string
}

export type ActiveHostDetectionInput = {
  cwd: string
  argv?: string[]
  env?: Record<string, string | undefined>
  processHints?: string[]
}

export type ActiveHostDetectionResult = {
  detectedHostId: string | null
  confidence: DetectionConfidence
  reasons: string[]
  scores: Record<string, number>
  signals: HostDetectionSignal[]
}

type HostProfile = {
  id: string
  strongArgvTokens: string[]
  mediumFiles: string[]
  weakEnvVars: string[]
  weakProcessTokens: string[]
}

const SIGNAL_WEIGHTS: Record<SignalStrength, number> = {
  strong: 100,
  medium: 30,
  weak: 10,
}

const HOST_PROFILES: HostProfile[] = [
  {
    id: 'claude-code',
    strongArgvTokens: ['claude', 'claude-code'],
    mediumFiles: ['CLAUDE.md', '.claude/settings.json'],
    weakEnvVars: ['CLAUDECODE', 'CLAUDE_CODE'],
    weakProcessTokens: ['claude'],
  },
  {
    id: 'opencode',
    strongArgvTokens: ['opencode'],
    mediumFiles: ['OPENCODE.md', '.opencode/config.json'],
    weakEnvVars: ['OPENCODE'],
    weakProcessTokens: ['opencode'],
  },
]

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export class ActiveHostDetector {
  async detect(input: ActiveHostDetectionInput): Promise<ActiveHostDetectionResult> {
    const argv = (input.argv ?? process.argv).map((value) => value.toLowerCase())
    const normalizedArgv = new Set<string>()
    for (const value of argv) {
      normalizedArgv.add(value)
      const baseName = basename(value).replace(/\.(exe|cmd|bat)$/i, '')
      normalizedArgv.add(baseName)
    }
    const processHints = (input.processHints ?? []).map((value) => value.toLowerCase())
    const env = input.env ?? process.env
    const scores: Record<string, number> = {}
    const allSignals: HostDetectionSignal[] = []

    for (const profile of HOST_PROFILES) {
      scores[profile.id] = 0

      for (const token of profile.strongArgvTokens) {
        if (normalizedArgv.has(token)) {
          allSignals.push({
            hostId: profile.id,
            strength: 'strong',
            key: `argv:${token}`,
            reason: `${profile.id} strong signal via argv token '${token}'`,
          })
        }
      }

      for (const fileName of profile.mediumFiles) {
        const filePath = join(input.cwd, fileName)
        if (await pathExists(filePath)) {
          allSignals.push({
            hostId: profile.id,
            strength: 'medium',
            key: `file:${fileName}`,
            reason: `${profile.id} medium signal via file '${fileName}'`,
          })
        }
      }

      for (const envVar of profile.weakEnvVars) {
        if (env[envVar]) {
          allSignals.push({
            hostId: profile.id,
            strength: 'weak',
            key: `env:${envVar}`,
            reason: `${profile.id} weak signal via env '${envVar}'`,
          })
        }
      }

      for (const token of profile.weakProcessTokens) {
        const hasHint = processHints.some((hint) => hint.includes(token))
        if (hasHint) {
          allSignals.push({
            hostId: profile.id,
            strength: 'weak',
            key: `process:${token}`,
            reason: `${profile.id} weak signal via process hint '${token}'`,
          })
        }
      }
    }

    for (const signal of allSignals) {
      scores[signal.hostId] = (scores[signal.hostId] ?? 0) + SIGNAL_WEIGHTS[signal.strength]
    }

    const rankedHosts = Object.entries(scores)
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))

    const [winnerHostId, winnerScore] = rankedHosts[0] ?? [null, 0]
    const [, secondScore] = rankedHosts[1] ?? [null, 0]
    const hasTie = winnerScore > 0 && winnerScore === secondScore
    const meaningfulWinner = (winnerScore ?? 0) > 0 ? winnerHostId : null

    const confidence: DetectionConfidence =
      meaningfulWinner === null
        ? 'low'
        : winnerScore >= SIGNAL_WEIGHTS.strong
        ? 'high'
        : winnerScore >= SIGNAL_WEIGHTS.medium
          ? 'medium'
          : 'low'

    const reasons = meaningfulWinner === null
      ? []
      : allSignals
        .filter((signal) => signal.hostId === meaningfulWinner)
        .map((signal) => signal.reason)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

    if (hasTie && meaningfulWinner !== null) {
      reasons.push(`Tie at score ${winnerScore} resolved to '${meaningfulWinner}' by hostId ordering`)
      reasons.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    }

    return {
      detectedHostId: meaningfulWinner,
      confidence,
      reasons,
      scores,
      signals: allSignals
        .slice()
        .sort((a, b) => a.hostId.localeCompare(b.hostId) || a.key.localeCompare(b.key)),
    }
  }
}
