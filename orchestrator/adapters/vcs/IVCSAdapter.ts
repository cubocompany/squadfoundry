/**
 * IVCSAdapter — Version Control System Adapter Interface
 *
 * Abstracts VCS operations (git, GitHub, GitLab, Bitbucket, etc.).
 * The core orchestrator only interacts with this interface — never with
 * specific VCS clients or APIs.
 *
 * STATUS: Interface defined. Concrete adapters: github (stub)
 */

export interface BranchOptions {
  baseBranch?: string
  checkout?: boolean
}

export interface CommitOptions {
  message: string
  /** Files to stage. If empty, stages all changes */
  files?: string[]
  allowEmpty?: boolean
}

export interface PullRequestOptions {
  title: string
  body: string
  baseBranch: string
  headBranch: string
  draft?: boolean
  labels?: string[]
  reviewers?: string[]
}

export interface PullRequestInfo {
  id: string
  number: number
  url: string
  title: string
  status: 'open' | 'closed' | 'merged' | 'draft'
  baseBranch: string
  headBranch: string
  createdAt: string
}

export interface CommitInfo {
  sha: string
  message: string
  author: string
  timestamp: string
  url?: string
}

export interface BranchInfo {
  name: string
  sha: string
  isDefault: boolean
  isProtected: boolean
}

export interface VCSCapabilities {
  supportsPullRequests: boolean
  supportsReviews: boolean
  supportsLabels: boolean
  supportsWebhooks: boolean
}

/**
 * Interface for VCS (version control) adapters.
 * Implement this to add GitHub, GitLab, Bitbucket, or bare git support.
 */
export interface IVCSAdapter {
  readonly id: string
  readonly name: string

  initialize(): Promise<void>

  /** Get current branch name */
  getCurrentBranch(): Promise<string>

  /** List all branches */
  listBranches(): Promise<BranchInfo[]>

  /** Create and optionally checkout a new branch */
  createBranch(name: string, options?: BranchOptions): Promise<BranchInfo>

  /** Stage and commit files */
  commit(options: CommitOptions): Promise<CommitInfo>

  /** Push branch to remote */
  push(branch: string, force?: boolean): Promise<void>

  /** Create a pull request / merge request */
  createPullRequest(options: PullRequestOptions): Promise<PullRequestInfo>

  /** Get pull request info by number */
  getPullRequest(number: number): Promise<PullRequestInfo>

  /** List open pull requests */
  listPullRequests(state?: 'open' | 'closed' | 'all'): Promise<PullRequestInfo[]>

  /** Add a comment to a pull request */
  commentOnPullRequest(number: number, body: string): Promise<void>

  /** Get recent commit history */
  getCommitHistory(branch?: string, limit?: number): Promise<CommitInfo[]>

  getCapabilities(): VCSCapabilities

  healthCheck(): Promise<boolean>
}
