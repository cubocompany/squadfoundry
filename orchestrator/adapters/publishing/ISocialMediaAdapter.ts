/**
 * ISocialMediaAdapter — Social Media Publishing Adapter Interface
 *
 * Abstracts publishing operations across social media platforms
 * (Instagram, Twitter/X, LinkedIn, TikTok, etc.).
 *
 * STATUS: Interface defined. Concrete adapters: instagram (stub)
 */

export type MediaType = 'image' | 'video' | 'carousel' | 'reel' | 'story' | 'text'

export interface MediaAsset {
  type: MediaType
  url?: string
  localPath?: string
  altText?: string
  caption?: string
}

export interface PostDraft {
  caption: string
  media?: MediaAsset[]
  hashtags?: string[]
  mentions?: string[]
  scheduledAt?: string // ISO 8601
  location?: string
}

export interface PublishedPost {
  id: string
  platformPostId: string
  url: string
  caption: string
  publishedAt: string
  status: 'published' | 'scheduled' | 'failed' | 'pending_review'
  platform: string
}

export interface PostAnalytics {
  postId: string
  impressions: number
  reach: number
  engagement: number
  likes: number
  comments: number
  shares: number
  saves?: number
  clickThroughRate?: number
  measuredAt: string
}

export interface AccountInfo {
  id: string
  username: string
  displayName: string
  platform: string
  followerCount: number
  followingCount: number
  postCount: number
}

export interface PublishingCapabilities {
  supportsScheduling: boolean
  supportsCarousel: boolean
  supportsVideo: boolean
  supportsStories: boolean
  supportsAnalytics: boolean
  maxCaptionLength: number
  maxHashtags: number
}

/**
 * Interface for social media publishing adapters.
 * Implement this to add support for Instagram, LinkedIn, Twitter/X, etc.
 */
export interface ISocialMediaAdapter {
  readonly id: string
  readonly platform: string

  initialize(): Promise<void>

  /** Get the authenticated account info */
  getAccountInfo(): Promise<AccountInfo>

  /**
   * Publish a post immediately.
   * IMPORTANT: This must never be called without human approval (guardrail enforced).
   */
  publishPost(draft: PostDraft): Promise<PublishedPost>

  /**
   * Schedule a post for a future time.
   * IMPORTANT: Requires human approval before scheduling.
   */
  schedulePost(draft: PostDraft, publishAt: string): Promise<PublishedPost>

  /** Get analytics for a published post */
  getPostAnalytics(postId: string): Promise<PostAnalytics>

  /** List recent posts */
  listPosts(limit?: number): Promise<PublishedPost[]>

  /** Delete a scheduled post (not published) */
  cancelScheduledPost(postId: string): Promise<void>

  getCapabilities(): PublishingCapabilities

  healthCheck(): Promise<boolean>
}
