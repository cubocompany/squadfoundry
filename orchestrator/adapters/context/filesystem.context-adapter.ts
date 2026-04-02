/**
 * FilesystemContextAdapter — Real Implementation
 *
 * Discovers and loads context files from the local filesystem.
 * This is the primary context adapter for local development.
 *
 * Priority order (highest to lowest):
 * 1. PROJECT.md
 * 2. TASKS.md
 * 3. AGENTS.md
 * 4. README.md
 * 5. docs/**
 * 6. specs/**
 * 7. playbooks/**
 * 8. policies/**
 * 9. templates/**
 * 10. workflows/**
 * 11. brand/**
 */

import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { glob } from 'glob'

import type { IContextAdapter, ContextLoadOptions, ContextSummary } from './IContextAdapter.js'
import type {
  ContextDiscoveryResult,
  DiscoveredFile,
  LoadedContext,
  ContextFileCategory,
  FileContent,
} from '../../core/types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Category detection rules
// ─────────────────────────────────────────────────────────────────────────────

interface CategoryRule {
  category: ContextFileCategory
  priority: number
  patterns: string[]
  exactNames?: string[]
}

const CATEGORY_RULES: CategoryRule[] = [
  { category: 'project',   priority: 100, patterns: [], exactNames: ['PROJECT.md'] },
  { category: 'tasks',     priority: 90,  patterns: [], exactNames: ['TASKS.md'] },
  { category: 'agents',    priority: 85,  patterns: [], exactNames: ['AGENTS.md'] },
  { category: 'readme',    priority: 80,  patterns: [], exactNames: ['README.md'] },
  { category: 'docs',      priority: 70,  patterns: ['docs/**/*.md', 'docs/**/*.txt'] },
  { category: 'specs',     priority: 65,  patterns: ['specs/**/*.md', 'spec/**/*.md'] },
  { category: 'playbooks', priority: 60,  patterns: ['playbooks/**/*.md', 'playbook/**/*.md'] },
  { category: 'policies',  priority: 55,  patterns: ['policies/**/*.md', 'policy/**/*.md'] },
  { category: 'templates', priority: 50,  patterns: ['templates/**/*.md'] },
  { category: 'workflows', priority: 45,  patterns: ['workflows/**/*.md', 'workflow/**/*.md'] },
  { category: 'brand',     priority: 40,  patterns: ['brand/**/*.md', 'brand-guidelines/**/*.md'] },
]

const RECOMMENDED_FILES = ['PROJECT.md', 'TASKS.md', 'README.md']
const DEFAULT_MAX_SIZE = 512 * 1024 // 500 KB

// ─────────────────────────────────────────────────────────────────────────────
// Adapter Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class FilesystemContextAdapter implements IContextAdapter {
  readonly id = 'filesystem'
  readonly name = 'Filesystem Context Adapter'

  async initialize(): Promise<void> {
    // No initialization needed for filesystem access
  }

  async discover(options: ContextLoadOptions): Promise<ContextDiscoveryResult> {
    const { rootPath, excludePatterns = [], includeCategories } = options
    const foundFiles: DiscoveredFile[] = []

    for (const rule of CATEGORY_RULES) {
      if (includeCategories && !includeCategories.includes(rule.category)) continue

      // Check exact names first
      if (rule.exactNames) {
        for (const name of rule.exactNames) {
          const abs = join(rootPath, name)
          if (existsSync(abs)) {
            const stat = statSync(abs)
            foundFiles.push({
              relativePath: name,
              absolutePath: abs,
              category: rule.category,
              priority: rule.priority,
              sizeBytes: stat.size,
            })
          }
        }
      }

      // Glob patterns
      for (const pattern of rule.patterns) {
        try {
          const matches = await glob(pattern, {
            cwd: rootPath,
            ignore: [...excludePatterns, 'node_modules/**', 'dist/**', '.git/**'],
            nodir: true,
          })
          for (const rel of matches) {
            const abs = join(rootPath, rel)
            // Skip if already found by exact name
            if (foundFiles.some((f) => f.absolutePath === abs)) continue
            const stat = statSync(abs)
            foundFiles.push({
              relativePath: rel,
              absolutePath: abs,
              category: rule.category,
              priority: rule.priority,
              sizeBytes: stat.size,
            })
          }
        } catch {
          // Pattern failed — skip silently
        }
      }
    }

    // Sort by priority descending
    foundFiles.sort((a, b) => b.priority - a.priority)

    const missingRecommended = RECOMMENDED_FILES.filter(
      (name) => !foundFiles.some((f) => f.relativePath === name),
    )

    return {
      rootPath,
      foundFiles,
      missingRecommended,
      loadedAt: new Date().toISOString(),
    }
  }

  async load(options: ContextLoadOptions): Promise<LoadedContext> {
    const { maxFileSizeBytes = DEFAULT_MAX_SIZE } = options
    const discovery = await this.discover(options)

    const loadFile = (rel: string): string | undefined => {
      const file = discovery.foundFiles.find((f) => f.relativePath === rel)
      if (!file || file.sizeBytes > maxFileSizeBytes) return undefined
      try {
        return readFileSync(file.absolutePath, 'utf-8')
      } catch {
        return undefined
      }
    }

    const loadCategory = (category: ContextFileCategory): FileContent[] => {
      return discovery.foundFiles
        .filter((f) => f.category === category && f.sizeBytes <= maxFileSizeBytes)
        .map((f) => {
          try {
            return {
              path: f.relativePath,
              content: readFileSync(f.absolutePath, 'utf-8'),
              loadedAt: new Date().toISOString(),
            }
          } catch {
            return null
          }
        })
        .filter((x): x is FileContent => x !== null)
    }

    return {
      projectMd: loadFile('PROJECT.md'),
      tasksMd: loadFile('TASKS.md'),
      agentsMd: loadFile('AGENTS.md'),
      readmeMd: loadFile('README.md'),
      docs: loadCategory('docs'),
      specs: loadCategory('specs'),
      playbooks: loadCategory('playbooks'),
      policies: loadCategory('policies'),
      templates: loadCategory('templates'),
      custom: [...loadCategory('workflows'), ...loadCategory('brand')],
    }
  }

  async loadFile(path: string): Promise<string> {
    return readFileSync(path, 'utf-8')
  }

  async summarize(rootPath: string): Promise<ContextSummary> {
    const discovery = await this.discover({ rootPath })
    const categoryCounts = {} as Record<ContextFileCategory, number>

    for (const file of discovery.foundFiles) {
      categoryCounts[file.category] = (categoryCounts[file.category] ?? 0) + 1
    }

    const totalBytes = discovery.foundFiles.reduce((sum, f) => sum + f.sizeBytes, 0)

    return {
      totalFiles: discovery.foundFiles.length,
      totalBytes,
      categoryCounts,
      missingRecommended: discovery.missingRecommended,
      hasProjectMd: discovery.foundFiles.some((f) => f.category === 'project'),
      hasTasksMd: discovery.foundFiles.some((f) => f.category === 'tasks'),
      hasAgentsMd: discovery.foundFiles.some((f) => f.category === 'agents'),
    }
  }

  async listByCategory(rootPath: string, category: ContextFileCategory): Promise<DiscoveredFile[]> {
    const discovery = await this.discover({ rootPath })
    return discovery.foundFiles.filter((f) => f.category === category)
  }

  async healthCheck(): Promise<boolean> {
    return true
  }
}
