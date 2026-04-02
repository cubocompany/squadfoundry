import { describe, it, expect } from 'vitest'
import { ContextLoader } from '../../orchestrator/context/context-loader.js'
import { ContextIndex } from '../../orchestrator/context/context-index.js'
import type { LoadedContext } from '../../orchestrator/core/types.js'

function makeContext(overrides: Partial<LoadedContext> = {}): LoadedContext {
  return {
    docs: [],
    specs: [],
    playbooks: [],
    policies: [],
    templates: [],
    custom: [],
    ...overrides,
  }
}

describe('ContextLoader static helpers', () => {
  it('formats empty context gracefully', () => {
    const ctx = makeContext()
    const result = ContextLoader.formatContextForPrompt(ctx)
    expect(result).toContain('_(No context files found)_')
  })

  it('includes PROJECT.md in formatted output', () => {
    const ctx = makeContext({ projectMd: '# My Project\nDetails here.' })
    const result = ContextLoader.formatContextForPrompt(ctx)
    expect(result).toContain('PROJECT.md')
    expect(result).toContain('My Project')
  })

  it('includes TASKS.md in formatted output', () => {
    const ctx = makeContext({ tasksMd: '# Tasks\n- [ ] Task 1' })
    const result = ContextLoader.formatContextForPrompt(ctx)
    expect(result).toContain('TASKS.md')
    expect(result).toContain('Task 1')
  })

  it('includes docs files in formatted output', () => {
    const ctx = makeContext({
      docs: [{ path: 'docs/api.md', content: '# API Docs', loadedAt: new Date().toISOString() }],
    })
    const result = ContextLoader.formatContextForPrompt(ctx)
    expect(result).toContain('docs/api.md')
    expect(result).toContain('API Docs')
  })

  it('describes context accurately', () => {
    const ctx = makeContext({
      projectMd: '# Project',
      tasksMd: '# Tasks',
      docs: [{ path: 'docs/x.md', content: 'x', loadedAt: '' }],
    })
    const desc = ContextLoader.describeContext(ctx)
    expect(desc).toContain('PROJECT.md')
    expect(desc).toContain('TASKS.md')
    expect(desc).toContain('1 doc(s)')
  })

  it('returns none for completely empty context', () => {
    const ctx = makeContext()
    const desc = ContextLoader.describeContext(ctx)
    expect(desc).toBe('none')
  })
})

describe('ContextIndex', () => {
  it('indexes project and tasks files', () => {
    const ctx = makeContext({
      projectMd: '# Project Content',
      tasksMd: '# Tasks Content',
    })
    const index = new ContextIndex(ctx)
    expect(index.getProjectMd()).toBe('# Project Content')
    expect(index.getTasksMd()).toBe('# Tasks Content')
  })

  it('returns files by category', () => {
    const ctx = makeContext({
      docs: [
        { path: 'docs/a.md', content: 'doc a', loadedAt: '' },
        { path: 'docs/b.md', content: 'doc b', loadedAt: '' },
      ],
    })
    const index = new ContextIndex(ctx)
    const docs = index.byCategory('docs')
    expect(docs).toHaveLength(2)
  })

  it('searches across all content', () => {
    const ctx = makeContext({
      projectMd: '# My Special Project',
      docs: [{ path: 'docs/api.md', content: 'API endpoints', loadedAt: '' }],
    })
    const index = new ContextIndex(ctx)
    const results = index.search('Special')
    expect(results.some((f) => f.path === 'PROJECT.md')).toBe(true)

    const apiResults = index.search('API')
    expect(apiResults.some((f) => f.path === 'docs/api.md')).toBe(true)
  })

  it('reports isEmpty correctly', () => {
    expect(new ContextIndex(makeContext()).isEmpty()).toBe(true)
    expect(new ContextIndex(makeContext({ projectMd: '# P' })).isEmpty()).toBe(false)
  })

  it('reports hasCoreContext correctly', () => {
    expect(new ContextIndex(makeContext()).hasCoreContext()).toBe(false)
    expect(new ContextIndex(makeContext({ projectMd: '# P' })).hasCoreContext()).toBe(true)
  })

  it('returns stats', () => {
    const ctx = makeContext({
      projectMd: 'p',
      docs: [{ path: 'd.md', content: 'd', loadedAt: '' }],
    })
    const stats = new ContextIndex(ctx).stats()
    expect(stats['total']).toBe(2)
    expect(stats['project']).toBe(1)
    expect(stats['docs']).toBe(1)
  })
})
