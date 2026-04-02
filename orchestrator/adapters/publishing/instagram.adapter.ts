/**
 * InstagramAdapter — Stub
 *
 * Adapter for Instagram publishing via the Instagram Graph API.
 *
 * CRITICAL SAFETY NOTE:
 * Publishing to Instagram is a real, irreversible action.
 * This adapter MUST only be called after explicit human approval
 * has been recorded via the ApprovalGate.
 *
 * STATUS: STUB — all methods log and return mock data.
 * To activate: set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID.
 */

import type { ISocialMediaAdapter, PostDraft, PublishedPost, PostAnalytics, AccountInfo, PublishingCapabilities } from './ISocialMediaAdapter.js'

export class InstagramAdapter implements ISocialMediaAdapter {
  readonly id = 'instagram'
  readonly platform = 'Instagram'

  private accessToken: string | undefined
  private accountId: string | undefined

  constructor(opts?: { accessToken?: string; accountId?: string }) {
    this.accessToken = opts?.accessToken ?? process.env['INSTAGRAM_ACCESS_TOKEN']
    this.accountId = opts?.accountId ?? process.env['INSTAGRAM_ACCOUNT_ID']
  }

  async initialize(): Promise<void> {
    if (!this.accessToken || !this.accountId) {
      console.warn('[InstagramAdapter] INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_ACCOUNT_ID not set — running in stub mode')
    }
  }

  async getAccountInfo(): Promise<AccountInfo> {
    // STUB: GET /{account-id}?fields=id,username,name,followers_count
    return {
      id: this.accountId ?? 'stub-account-id',
      username: 'stub_account',
      displayName: 'Stub Account',
      platform: 'Instagram',
      followerCount: 0,
      followingCount: 0,
      postCount: 0,
    }
  }

  async publishPost(draft: PostDraft): Promise<PublishedPost> {
    // SAFETY: This method must only be called after ApprovalGate confirms human approval.
    // STUB: POST /{account-id}/media + /{account-id}/media_publish
    console.log(`[InstagramAdapter][STUB] publishPost: ${draft.caption.slice(0, 60)}...`)
    console.warn('[InstagramAdapter][STUB] Real publishing NOT executed — stub mode active')
    return {
      id: `stub-post-${Date.now()}`,
      platformPostId: 'stub-platform-id',
      url: 'https://www.instagram.com/p/stub/',
      caption: draft.caption,
      publishedAt: new Date().toISOString(),
      status: 'pending_review',
      platform: 'Instagram',
    }
  }

  async schedulePost(draft: PostDraft, publishAt: string): Promise<PublishedPost> {
    // STUB: Requires Content Publishing API with scheduling support
    console.log(`[InstagramAdapter][STUB] schedulePost for ${publishAt}: ${draft.caption.slice(0, 60)}`)
    return {
      id: `stub-scheduled-${Date.now()}`,
      platformPostId: 'stub-scheduled-platform-id',
      url: 'https://www.instagram.com/p/stub/',
      caption: draft.caption,
      publishedAt: publishAt,
      status: 'scheduled',
      platform: 'Instagram',
    }
  }

  async getPostAnalytics(postId: string): Promise<PostAnalytics> {
    // STUB: GET /{media-id}/insights
    return {
      postId,
      impressions: 0,
      reach: 0,
      engagement: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      measuredAt: new Date().toISOString(),
    }
  }

  async listPosts(_limit = 10): Promise<PublishedPost[]> {
    return []
  }

  async cancelScheduledPost(postId: string): Promise<void> {
    console.log(`[InstagramAdapter][STUB] cancelScheduledPost: ${postId}`)
  }

  getCapabilities(): PublishingCapabilities {
    return {
      supportsScheduling: true,
      supportsCarousel: true,
      supportsVideo: true,
      supportsStories: true,
      supportsAnalytics: true,
      maxCaptionLength: 2200,
      maxHashtags: 30,
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.accessToken) return false
    return true
  }
}
