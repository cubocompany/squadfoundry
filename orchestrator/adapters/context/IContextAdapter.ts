/**
 * IContextAdapter — Context/Documentation Adapter Interface
 *
 * Abstracts how context files are discovered and loaded.
 * Default implementation reads from the local filesystem, but this
 * interface allows future adapters to read from Notion, Confluence,
 * GitHub wikis, or any other documentation source.
 *
 * STATUS: Interface defined. Concrete adapter: filesystem (real implementation)
 */

import type { ContextDiscoveryResult, DiscoveredFile, LoadedContext, ContextFileCategory } from '../../core/types.js'

export interface ContextLoadOptions {
  /** Root path to scan for context files */
  rootPath: string
  /** Maximum file size in bytes to load (default: 500KB) */
  maxFileSizeBytes?: number
  /** File categories to include (default: all) */
  includeCategories?: ContextFileCategory[]
  /** Glob patterns to explicitly exclude */
  excludePatterns?: string[]
  /** Whether to load recursively into subdirectories */
  recursive?: boolean
}

export interface ContextSummary {
  totalFiles: number
  totalBytes: number
  categoryCounts: Record<ContextFileCategory, number>
  missingRecommended: string[]
  hasProjectMd: boolean
  hasTasksMd: boolean
  hasAgentsMd: boolean
}

/**
 * Interface for context/documentation loading adapters.
 * The context adapter is responsible for discovering and ingesting
 * all human-authored documentation that informs agent behavior.
 */
export interface IContextAdapter {
  readonly id: string
  readonly name: string

  /**
   * Discover all context files in the given root path.
   * Returns metadata without loading file contents.
   */
  discover(options: ContextLoadOptions): Promise<ContextDiscoveryResult>

  /**
   * Load and return the full structured context.
   * This is what gets attached to a JobDefinition.loadedContext.
   */
  load(options: ContextLoadOptions): Promise<LoadedContext>

  /**
   * Load a single file by path.
   */
  loadFile(path: string): Promise<string>

  /**
   * Get a summary of what context is available.
   */
  summarize(rootPath: string): Promise<ContextSummary>

  /**
   * List all files in a specific category.
   */
  listByCategory(rootPath: string, category: ContextFileCategory): Promise<DiscoveredFile[]>

  healthCheck(): Promise<boolean>
}
