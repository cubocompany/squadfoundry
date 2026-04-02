/**
 * VercelDeployAdapter — Stub
 *
 * Adapter for deployments via the Vercel API.
 *
 * CRITICAL SAFETY NOTE:
 * Deploy operations ALWAYS require explicit human confirmation.
 * Never call deploy() or rollback() without ApprovalGate confirmation.
 *
 * STATUS: STUB — all methods log and return mock data.
 * To activate: set VERCEL_TOKEN and VERCEL_PROJECT_ID.
 */

import type { IDeployAdapter, DeployRequest, DeployResult, DeploymentInfo, DeployCapabilities, DeployEnvironment } from './IDeployAdapter.js'

export class VercelDeployAdapter implements IDeployAdapter {
  readonly id = 'vercel'
  readonly name = 'Vercel'

  private token: string | undefined
  private projectId: string | undefined

  constructor(opts?: { token?: string; projectId?: string }) {
    this.token = opts?.token ?? process.env['VERCEL_TOKEN']
    this.projectId = opts?.projectId ?? process.env['VERCEL_PROJECT_ID']
  }

  async initialize(): Promise<void> {
    if (!this.token || !this.projectId) {
      console.warn('[VercelDeployAdapter] VERCEL_TOKEN or VERCEL_PROJECT_ID not set — running in stub mode')
    }
  }

  async deploy(request: DeployRequest): Promise<DeployResult> {
    // SAFETY: Must only be called after human approval via ApprovalGate.
    // STUB: POST /v13/deployments
    console.log(`[VercelDeployAdapter][STUB] deploy ref=${request.ref} env=${request.environment}`)
    console.warn('[VercelDeployAdapter][STUB] Real deployment NOT executed — stub mode active')
    return {
      id: `stub-deploy-${Date.now()}`,
      url: `https://stub-deploy.vercel.app`,
      environment: request.environment,
      ref: request.ref,
      status: 'pending',
      startedAt: new Date().toISOString(),
    }
  }

  async getDeployStatus(deployId: string): Promise<DeployResult> {
    // STUB: GET /v13/deployments/{id}
    return {
      id: deployId,
      url: 'https://stub-deploy.vercel.app',
      environment: 'staging',
      ref: 'main',
      status: 'ready',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }
  }

  async listDeployments(_environment?: DeployEnvironment, _limit = 10): Promise<DeploymentInfo[]> {
    return []
  }

  async rollback(deployId: string, environment: DeployEnvironment): Promise<DeployResult> {
    // SAFETY: Must only be called after human approval via ApprovalGate.
    console.log(`[VercelDeployAdapter][STUB] rollback deployId=${deployId} env=${environment}`)
    console.warn('[VercelDeployAdapter][STUB] Real rollback NOT executed — stub mode active')
    return {
      id: `stub-rollback-${Date.now()}`,
      url: 'https://stub-rollback.vercel.app',
      environment,
      ref: deployId,
      status: 'pending',
      startedAt: new Date().toISOString(),
    }
  }

  getCapabilities(): DeployCapabilities {
    return {
      supportedEnvironments: ['production', 'staging', 'preview'],
      supportsRollback: true,
      supportsPreviewURLs: true,
      requiresApprovalForProduction: true,
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.token) return false
    return true
  }
}
