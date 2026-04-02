/**
 * ContextLoader
 *
 * High-level service that coordinates context discovery and loading.
 * Uses an IContextAdapter under the hood, defaulting to the filesystem adapter.
 *
 * This is what the Squad Builder and Squad Runtime call to ingest
 * PROJECT.md, TASKS.md, docs/**, etc. before starting any job.
 */

import { FilesystemContextAdapter } from '../adapters/context/filesystem.context-adapter.js'
import type { IContextAdapter } from '../adapters/context/IContextAdapter.js'
import type { LoadedContext, ContextDiscoveryResult } from '../core/types.js'

export interface ContextLoaderOptions {
  /** Root path to scan. Defaults to process.cwd() */
  rootPath?: string
  /** Max file size in bytes. Defaults to 500KB */
  maxFileSizeBytes?: number
  /** Custom context adapter. Defaults to FilesystemContextAdapter */
  adapter?: IContextAdapter
}

export class ContextLoader {
  private adapter: IContextAdapter
  private rootPath: string
  private maxFileSizeBytes: number

  constructor(options: ContextLoaderOptions = {}) {
    this.adapter = options.adapter ?? new FilesystemContextAdapter()
    this.rootPath = options.rootPath ?? process.cwd()
    this.maxFileSizeBytes = options.maxFileSizeBytes ?? 512 * 1024
  }

  /**
   * Discover all context files without loading their contents.
   * Useful for showing the user what context is available.
   */
  async discover(): Promise<ContextDiscoveryResult> {
    return this.adapter.discover({
      rootPath: this.rootPath,
      maxFileSizeBytes: this.maxFileSizeBytes,
    })
  }

  /**
   * Load all discovered context files into a structured LoadedContext.
   * This is the main method called before job execution.
   */
  async load(): Promise<LoadedContext> {
    return this.adapter.load({
      rootPath: this.rootPath,
      maxFileSizeBytes: this.maxFileSizeBytes,
    })
  }

  /**
   * Summarize available context (file counts, missing recommended files, etc.)
   */
  async summarize() {
    return this.adapter.summarize(this.rootPath)
  }

  /**
   * Format a LoadedContext into a human-readable summary string.
   * Used to inject context into agent prompts.
   */
  static formatContextForPrompt(ctx: LoadedContext): string {
    const parts: string[] = []

    if (ctx.projectMd) {
      parts.push(`## PROJECT.md\n${ctx.projectMd}`)
    }
    if (ctx.tasksMd) {
      parts.push(`## TASKS.md\n${ctx.tasksMd}`)
    }
    if (ctx.agentsMd) {
      parts.push(`## AGENTS.md\n${ctx.agentsMd}`)
    }
    if (ctx.readmeMd) {
      parts.push(`## README.md\n${ctx.readmeMd}`)
    }
    for (const doc of ctx.docs) {
      parts.push(`## ${doc.path}\n${doc.content}`)
    }
    for (const spec of ctx.specs) {
      parts.push(`## ${spec.path}\n${spec.content}`)
    }
    for (const pb of ctx.playbooks) {
      parts.push(`## ${pb.path}\n${pb.content}`)
    }
    for (const pol of ctx.policies) {
      parts.push(`## ${pol.path}\n${pol.content}`)
    }
    for (const tmpl of ctx.templates) {
      parts.push(`## ${tmpl.path}\n${tmpl.content}`)
    }

    return parts.length > 0
      ? `# Loaded Context\n\n${parts.join('\n\n---\n\n')}`
      : '# Loaded Context\n\n_(No context files found)_'
  }

  /**
   * Get a compact summary string suitable for display in CLI output.
   */
  static describeContext(ctx: LoadedContext): string {
    const items: string[] = []
    if (ctx.projectMd) items.push('PROJECT.md')
    if (ctx.tasksMd) items.push('TASKS.md')
    if (ctx.agentsMd) items.push('AGENTS.md')
    if (ctx.readmeMd) items.push('README.md')
    if (ctx.docs.length) items.push(`${ctx.docs.length} doc(s)`)
    if (ctx.specs.length) items.push(`${ctx.specs.length} spec(s)`)
    if (ctx.playbooks.length) items.push(`${ctx.playbooks.length} playbook(s)`)
    if (ctx.policies.length) items.push(`${ctx.policies.length} polic(ies)`)
    if (ctx.templates.length) items.push(`${ctx.templates.length} template(s)`)
    if (ctx.custom.length) items.push(`${ctx.custom.length} custom file(s)`)
    return items.length > 0 ? items.join(', ') : 'none'
  }
}
