/**
 * ContextIndex
 *
 * In-memory index of loaded context files with fast lookup by category and path.
 * Constructed from a LoadedContext object and provides query methods used
 * by the Squad Builder (during squad generation) and Squad Runtime (during execution).
 */

import type { LoadedContext, FileContent, ContextFileCategory } from '../core/types.js'

export interface IndexedFile {
  path: string
  category: ContextFileCategory
  content: string
  loadedAt: string
  sizeChars: number
}

export class ContextIndex {
  private files: IndexedFile[] = []
  private projectMd: string | undefined
  private tasksMd: string | undefined
  private agentsMd: string | undefined
  private readmeMd: string | undefined

  constructor(ctx: LoadedContext) {
    this.projectMd = ctx.projectMd
    this.tasksMd = ctx.tasksMd
    this.agentsMd = ctx.agentsMd
    this.readmeMd = ctx.readmeMd

    // Index named files
    if (ctx.projectMd) {
      this.files.push(this.makeEntry('PROJECT.md', 'project', ctx.projectMd))
    }
    if (ctx.tasksMd) {
      this.files.push(this.makeEntry('TASKS.md', 'tasks', ctx.tasksMd))
    }
    if (ctx.agentsMd) {
      this.files.push(this.makeEntry('AGENTS.md', 'agents', ctx.agentsMd))
    }
    if (ctx.readmeMd) {
      this.files.push(this.makeEntry('README.md', 'readme', ctx.readmeMd))
    }

    // Index category arrays
    for (const f of ctx.docs) this.files.push(this.fromFileContent(f, 'docs'))
    for (const f of ctx.specs) this.files.push(this.fromFileContent(f, 'specs'))
    for (const f of ctx.playbooks) this.files.push(this.fromFileContent(f, 'playbooks'))
    for (const f of ctx.policies) this.files.push(this.fromFileContent(f, 'policies'))
    for (const f of ctx.templates) this.files.push(this.fromFileContent(f, 'templates'))
    for (const f of ctx.custom) this.files.push(this.fromFileContent(f, 'custom'))
  }

  private makeEntry(path: string, category: ContextFileCategory, content: string): IndexedFile {
    return {
      path,
      category,
      content,
      loadedAt: new Date().toISOString(),
      sizeChars: content.length,
    }
  }

  private fromFileContent(f: FileContent, category: ContextFileCategory): IndexedFile {
    return {
      path: f.path,
      category,
      content: f.content,
      loadedAt: f.loadedAt,
      sizeChars: f.content.length,
    }
  }

  // ─── Query Methods ─────────────────────────────────────────────────────────

  /** Get all indexed files */
  all(): IndexedFile[] {
    return this.files
  }

  /** Get files by category */
  byCategory(category: ContextFileCategory): IndexedFile[] {
    return this.files.filter((f) => f.category === category)
  }

  /** Get a file by its path */
  byPath(path: string): IndexedFile | undefined {
    return this.files.find((f) => f.path === path)
  }

  /** Get PROJECT.md content */
  getProjectMd(): string | undefined {
    return this.projectMd
  }

  /** Get TASKS.md content */
  getTasksMd(): string | undefined {
    return this.tasksMd
  }

  /** Get AGENTS.md content */
  getAgentsMd(): string | undefined {
    return this.agentsMd
  }

  /** Get README.md content */
  getReadmeMd(): string | undefined {
    return this.readmeMd
  }

  /** Search all indexed content for a keyword */
  search(keyword: string): IndexedFile[] {
    const lower = keyword.toLowerCase()
    return this.files.filter(
      (f) =>
        f.path.toLowerCase().includes(lower) ||
        f.content.toLowerCase().includes(lower),
    )
  }

  /** Return a compact stats object */
  stats(): Record<string, number> {
    const counts: Record<string, number> = { total: this.files.length }
    for (const f of this.files) {
      counts[f.category] = (counts[f.category] ?? 0) + 1
    }
    return counts
  }

  /** Return whether any context was loaded */
  isEmpty(): boolean {
    return this.files.length === 0
  }

  /** Check whether core context files are present */
  hasCoreContext(): boolean {
    return !!(this.projectMd ?? this.tasksMd ?? this.readmeMd)
  }
}
