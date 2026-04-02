/**
 * IDeployAdapter — Deployment Adapter Interface
 *
 * Abstracts deployment operations (Vercel, AWS, GCP, Railway, Fly.io, etc.).
 *
 * CRITICAL SAFETY NOTE:
 * Deploy operations ALWAYS require explicit human confirmation.
 * The guardrail `require_human_before_deploy` must be satisfied before
 * any implementation of this interface invokes a real deployment.
 *
 * STATUS: Interface defined. Concrete adapters: vercel (stub)
 */

export type DeployEnvironment = 'production' | 'staging' | 'preview' | 'development'

export interface DeployRequest {
  /** The git branch or commit SHA to deploy */
  ref: string
  /** Target environment */
  environment: DeployEnvironment
  /** Optional environment variables to inject */
  envVars?: Record<string, string>
  /** Human-provided reason/notes for this deployment */
  notes?: string
  /** Job ID that triggered this deploy (for traceability) */
  jobId?: string
}

export interface DeployResult {
  id: string
  url: string
  environment: DeployEnvironment
  ref: string
  status: 'pending' | 'building' | 'deploying' | 'ready' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  errorMessage?: string
  logUrl?: string
}

export interface DeploymentInfo {
  id: string
  url: string
  environment: DeployEnvironment
  ref: string
  status: DeployResult['status']
  createdAt: string
}

export interface DeployCapabilities {
  supportedEnvironments: DeployEnvironment[]
  supportsRollback: boolean
  supportsPreviewURLs: boolean
  requiresApprovalForProduction: boolean
}

/**
 * Interface for deployment adapters.
 * Implement this to add Vercel, AWS, Railway, Fly.io, etc. support.
 *
 * All deploy methods MUST be guarded by human approval at the runtime layer.
 */
export interface IDeployAdapter {
  readonly id: string
  readonly name: string

  initialize(): Promise<void>

  /**
   * Trigger a deployment.
   * SAFETY: Must only be called after human confirmation via ApprovalGate.
   */
  deploy(request: DeployRequest): Promise<DeployResult>

  /** Poll the status of a running deployment */
  getDeployStatus(deployId: string): Promise<DeployResult>

  /** List recent deployments */
  listDeployments(environment?: DeployEnvironment, limit?: number): Promise<DeploymentInfo[]>

  /**
   * Roll back to a previous deployment.
   * SAFETY: Must only be called after human confirmation.
   */
  rollback(deployId: string, environment: DeployEnvironment): Promise<DeployResult>

  getCapabilities(): DeployCapabilities

  healthCheck(): Promise<boolean>
}
