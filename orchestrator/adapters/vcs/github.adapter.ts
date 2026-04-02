/**
 * GitHubVCSAdapter — Stub
 *
 * Adapter for GitHub operations: branches, commits, PRs, comments.
 * Uses the GitHub REST API (via GITHUB_TOKEN).
 *
 * STATUS: STUB — all methods log and return mock data.
 * To activate: set GITHUB_TOKEN and GITHUB_REPO, then implement API calls.
 */

import type { IVCSAdapter, BranchOptions, CommitOptions, PullRequestOptions, PullRequestInfo, CommitInfo, BranchInfo, VCSCapabilities } from './IVCSAdapter.js'

export class GitHubVCSAdapter implements IVCSAdapter {
  readonly id = 'github'
  readonly name = 'GitHub'

  private token: string | undefined
  private repo: string | undefined
  private owner: string | undefined

  constructor(opts?: { token?: string; owner?: string; repo?: string }) {
    this.token = opts?.token ?? process.env['GITHUB_TOKEN']
    const fullRepo = opts?.repo ?? process.env['GITHUB_REPO'] ?? ''
    const [owner, repo] = fullRepo.split('/')
    this.owner = opts?.owner ?? owner
    this.repo = repo
  }

  async initialize(): Promise<void> {
    if (!this.token) {
      console.warn('[GitHubVCSAdapter] GITHUB_TOKEN not set — running in stub mode')
    }
  }

  async getCurrentBranch(): Promise<string> {
    // STUB: In real impl, run `git rev-parse --abbrev-ref HEAD`
    return 'main'
  }

  async listBranches(): Promise<BranchInfo[]> {
    // STUB: GET /repos/{owner}/{repo}/branches
    return [{ name: 'main', sha: 'abc123', isDefault: true, isProtected: true }]
  }

  async createBranch(name: string, _options?: BranchOptions): Promise<BranchInfo> {
    // STUB: POST /repos/{owner}/{repo}/git/refs
    console.log(`[GitHubVCSAdapter][STUB] createBranch: ${name}`)
    return { name, sha: 'stub-sha', isDefault: false, isProtected: false }
  }

  async commit(options: CommitOptions): Promise<CommitInfo> {
    // STUB: In real impl, git add + git commit
    console.log(`[GitHubVCSAdapter][STUB] commit: ${options.message}`)
    return {
      sha: `stub-${Date.now()}`,
      message: options.message,
      author: 'squadfoundry[bot]',
      timestamp: new Date().toISOString(),
    }
  }

  async push(branch: string, _force = false): Promise<void> {
    console.log(`[GitHubVCSAdapter][STUB] push: ${branch}`)
  }

  async createPullRequest(options: PullRequestOptions): Promise<PullRequestInfo> {
    // STUB: POST /repos/{owner}/{repo}/pulls
    console.log(`[GitHubVCSAdapter][STUB] createPullRequest: ${options.title}`)
    return {
      id: `stub-pr-${Date.now()}`,
      number: 1,
      url: `https://github.com/${this.owner}/${this.repo}/pull/1`,
      title: options.title,
      status: 'open',
      baseBranch: options.baseBranch,
      headBranch: options.headBranch,
      createdAt: new Date().toISOString(),
    }
  }

  async getPullRequest(number: number): Promise<PullRequestInfo> {
    // STUB: GET /repos/{owner}/{repo}/pulls/{number}
    return {
      id: `stub-pr-${number}`,
      number,
      url: `https://github.com/${this.owner}/${this.repo}/pull/${number}`,
      title: 'Stub PR',
      status: 'open',
      baseBranch: 'main',
      headBranch: 'feature/stub',
      createdAt: new Date().toISOString(),
    }
  }

  async listPullRequests(_state: 'open' | 'closed' | 'all' = 'open'): Promise<PullRequestInfo[]> {
    return []
  }

  async commentOnPullRequest(number: number, body: string): Promise<void> {
    console.log(`[GitHubVCSAdapter][STUB] commentOnPullRequest #${number}: ${body.slice(0, 80)}`)
  }

  async getCommitHistory(_branch?: string, limit = 10): Promise<CommitInfo[]> {
    return Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
      sha: `stub-sha-${i}`,
      message: `Stub commit ${i}`,
      author: 'squadfoundry[bot]',
      timestamp: new Date().toISOString(),
    }))
  }

  getCapabilities(): VCSCapabilities {
    return {
      supportsPullRequests: true,
      supportsReviews: true,
      supportsLabels: true,
      supportsWebhooks: true,
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.token) return false
    // STUB: GET /user
    return true
  }
}
