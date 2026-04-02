#!/usr/bin/env npx tsx
/**
 * Squad Foundry — MCP Server
 *
 * Expõe o Squad Foundry como um MCP Server para ser usado pelo Claude Code,
 * Antigravity, OpenCode, Cursor e qualquer IDE com suporte a MCP.
 *
 * ── Claude Code ──────────────────────────────────────────────────────────────
 *   claude mcp add squadfoundry \
 *     -e SQUAD_FOUNDRY_ADAPTER=claude-code \
 *     -- npx tsx /caminho/para/squadfoundry/orchestrator/mcp/server.ts
 *
 * ── Antigravity ───────────────────────────────────────────────────────────────
 *   Settings → MCP → Add Server → Command:
 *   npx tsx /caminho/para/squadfoundry/orchestrator/mcp/server.ts
 *   (use SQUAD_FOUNDRY_ADAPTER=opencode ou deixe auto-detect se já houver host válido persistido)
 *
 * ── Variáveis de ambiente ─────────────────────────────────────────────────────
 *   SQUAD_FOUNDRY_ADAPTER  — claude-code | opencode | anthropic | openai | antigravity | local
 *   ANTHROPIC_API_KEY      — necessário para adapter=anthropic
 *   ANTHROPIC_MODEL        — modelo Claude (padrão: claude-sonnet-4-6)
 *   OPENAI_API_KEY         — necessário para adapter=openai
 *   ANTIGRAVITY_URL        — padrão: http://localhost:8045
 *   LOCAL_LLM_BASE_URL     — padrão: http://localhost:11434
 *
 * Ferramentas expostas:
 *   - squad_list           — lista squads disponíveis
 *   - squad_build          — inicia o processo de criação de um squad
 *   - squad_run            — executa um job para um squad existente
 *   - squad_status         — consulta status de um job
 *   - squad_approve        — aprova uma aprovação pendente
 *   - squad_context        — mostra contexto carregado do projeto
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createSquadBuilder } from '../builder/squad-builder.js'
import { createSquadRuntime } from '../runtime/squad-runtime.js'
import { ArtifactStore } from '../artifacts/artifact-store.js'
import { AntigravityHostAdapter } from '../adapters/host/antigravity.adapter.js'
import { AnthropicHostAdapter } from '../adapters/host/anthropic.adapter.js'
import { ClaudeCodeHostAdapter } from '../adapters/host/claude-code.adapter.js'
import { LocalHostAdapter } from '../adapters/host/local.adapter.js'
import { OpenAIHostAdapter } from '../adapters/host/openai.adapter.js'
import { OpenCodeHostAdapter } from '../adapters/host/opencode.adapter.js'
import { ContextLoader } from '../context/context-loader.js'
import type { IHostAdapter } from '../adapters/host/IHostAdapter.js'
import type { SquadDefinition, InterviewAnswer } from '../core/types.js'
import { ActiveHostDetector } from '../shell/services/active-host-detector.service.js'
import { HostResolutionService, type PersistedHostPreference } from '../shell/services/host-resolution.service.js'

const CWD = process.cwd()
const ARTIFACTS_DIR = join(CWD, 'artifacts')
const SQUADS_DIR = join(CWD, 'squads')

// ─── Adapter selection ────────────────────────────────────────────────────────

const HOST_PREFS_PATH = join(CWD, 'squadfoundry.hosts.json')

function createAdapter(hostId: string): IHostAdapter | null {
  if (hostId === 'claude-code') {
    return new ClaudeCodeHostAdapter()
  }
  if (hostId === 'opencode') {
    return new OpenCodeHostAdapter()
  }
  if (hostId === 'anthropic') return new AnthropicHostAdapter()
  if (hostId === 'antigravity') return new AntigravityHostAdapter()
  if (hostId === 'local') return new LocalHostAdapter()
  if (hostId === 'openai') return new OpenAIHostAdapter()
  return null
}

function loadPersistedPreference(): PersistedHostPreference | null {
  if (!existsSync(HOST_PREFS_PATH)) return null
  try {
    const data = JSON.parse(readFileSync(HOST_PREFS_PATH, 'utf-8')) as {
      preferredHost?: string | null
      validation?: PersistedHostPreference['validation'] | null
      lastValidated?: string | null
    }

    const validation = data.validation ?? (data.lastValidated
      ? { timestamp: data.lastValidated, matchedSignals: [] }
      : null)

    return {
      preferredHost: data.preferredHost ?? null,
      validation,
    }
  } catch {
    return null
  }
}

function persistPreferredHost(preference: PersistedHostPreference): void {
  const existing = loadPersistedPreference()
  const raw = existsSync(HOST_PREFS_PATH)
    ? JSON.parse(readFileSync(HOST_PREFS_PATH, 'utf-8')) as { hosts?: string[] }
    : { hosts: [] }

  const knownHosts = new Set<string>([
    ...(raw.hosts ?? []),
    ...(existing?.preferredHost ? [existing.preferredHost] : []),
    ...['claude-code', 'opencode', 'antigravity', 'anthropic', 'local', 'openai'],
    ...(preference.preferredHost ? [preference.preferredHost] : []),
  ])

  writeFileSync(HOST_PREFS_PATH, `${JSON.stringify({
    preferredHost: preference.preferredHost,
    validation: preference.validation,
    lastValidated: preference.validation?.timestamp ?? null,
    hosts: [...knownHosts].sort((a, b) => a.localeCompare(b)),
  }, null, 2)}\n`, 'utf-8')
}

async function resolveHostAdapterForCommand(commandId: string): Promise<IHostAdapter> {
  const explicitAdapter = process.env['SQUAD_FOUNDRY_ADAPTER']
  if (explicitAdapter && explicitAdapter !== 'auto') {
    const adapter = createAdapter(explicitAdapter)
    if (!adapter) throw new Error(`Unsupported adapter '${explicitAdapter}'.`)
    return adapter
  }

  const detector = new ActiveHostDetector()
  const detection = await detector.detect({ cwd: CWD, argv: process.argv, env: process.env, processHints: [process.title] })

  const resolver = new HostResolutionService({
    loadPersistedPreference: async () => loadPersistedPreference(),
    persistPreferredHost: async (pref) => persistPreferredHost(pref),
    getHostAdapter: (hostId) => createAdapter(hostId),
    isCommandSupported: async (hostId, _cmd) => {
      return createAdapter(hostId) !== null
    },
    assistedSelectHost: async () => {
      throw new Error('Host resolution requires explicit SQUAD_FOUNDRY_ADAPTER in MCP mode when no detected/persisted host is valid.')
    },
  })

  const resolved = await resolver.resolve({ detection, commandId })
  const adapter = createAdapter(resolved.hostId)
  if (!adapter) {
    throw new Error(`Resolved host '${resolved.hostId}' is not supported in MCP mode.`)
  }
  return adapter
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'squadfoundry',
  version: '0.1.0',
})

// ─── squad_list ───────────────────────────────────────────────────────────────

server.tool(
  'squad_list',
  'Lista todos os squads disponíveis no projeto e seus jobs',
  {},
  async () => {
    if (!existsSync(SQUADS_DIR)) {
      return { content: [{ type: 'text', text: 'Nenhum squad encontrado. Use squad_build para criar um.' }] }
    }

    const store = new ArtifactStore(ARTIFACTS_DIR)
    const squads = readdirSync(SQUADS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== 'templates' && d.name !== 'examples')
      .map((d) => d.name)

    if (squads.length === 0) {
      return { content: [{ type: 'text', text: 'Nenhum squad encontrado. Use squad_build para criar um.' }] }
    }

    const lines: string[] = ['# Squads disponíveis\n']
    for (const squadId of squads) {
      lines.push(`## ${squadId}`)
      const jobs = store.listJobs(squadId)
      if (jobs.length === 0) {
        lines.push('  Sem jobs ainda.\n')
      } else {
        for (const jobId of jobs) {
          const job = store.loadJob(squadId, jobId)
          lines.push(`  - Job \`${jobId.slice(0, 16)}...\` [${job?.status ?? 'desconhecido'}]`)
        }
        lines.push('')
      }
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
)

// ─── squad_build ─────────────────────────────────────────────────────────────

server.tool(
  'squad_build',
  'Cria um novo squad a partir de um conjunto de respostas da entrevista',
  {
    answers: z.array(z.object({
      questionId: z.string().describe('ID da pergunta (ex: q_objective, q_domain, q_squad_name)'),
      answer: z.string().describe('Resposta para a pergunta'),
    })).describe('Respostas da entrevista de criação do squad'),
  },
  async ({ answers }) => {
    const builder = createSquadBuilder({ contextRootPath: CWD, outputDir: CWD })
    const missing = builder.validateAnswers(answers as InterviewAnswer[])

    if (missing.length > 0) {
      const questions = builder.getQuestions().filter((q) => missing.includes(q.id))
      const lines = ['# Perguntas obrigatórias não respondidas\n']
      for (const q of questions) {
        lines.push(`**${q.id}**: ${q.question}`)
        if (q.hint) lines.push(`  _Dica: ${q.hint}_`)
        lines.push('')
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    }

    try {
      const result = await builder.build(answers as InterviewAnswer[])
      const lines = [
        `# Squad '${result.squadDefinition.name}' criado!\n`,
        `**ID:** \`${result.squadDefinition.id}\``,
        `**Domínio:** ${result.squadDefinition.domain}`,
        `**Agentes:** ${result.squadDefinition.agents.map((a) => a.name).join(', ')}`,
        '',
        '## Arquivos gerados',
        ...result.generatedFiles.map((f) => `- \`${f.path}\``),
      ]
      if (result.warnings.length > 0) {
        lines.push('', '## Avisos', ...result.warnings.map((w) => `- ⚠ ${w}`))
      }
      lines.push('', `Para executar: use \`squad_run\` com squad_id \`${result.squadDefinition.id}\``)
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Erro ao criar squad: ${err}` }], isError: true }
    }
  },
)

// ─── squad_interview_questions ────────────────────────────────────────────────

server.tool(
  'squad_interview_questions',
  'Retorna todas as perguntas da entrevista de criação de squad',
  {},
  async () => {
    const builder = createSquadBuilder()
    return { content: [{ type: 'text', text: builder.generateInterviewPrompt() }] }
  },
)

// ─── squad_run ────────────────────────────────────────────────────────────────

server.tool(
  'squad_run',
  'Executa um job para um squad existente',
  {
    squad_id: z.string().describe('ID do squad (ex: software-development, instagram-content)'),
    objective: z.string().describe('Objetivo do job — o que deve ser feito'),
    input: z.string().optional().describe('Input inicial — contexto adicional ou descrição detalhada'),
  },
  async ({ squad_id, objective, input }) => {
    const squadConfigPath = join(CWD, 'squads', squad_id, 'config', 'squad.json')

    // Também verifica nos exemplos
    const examplePath = join(CWD, 'squads', 'examples', squad_id, 'config', 'squad.json')
    const configPath = existsSync(squadConfigPath) ? squadConfigPath : existsSync(examplePath) ? examplePath : null

    if (!configPath) {
      return {
        content: [{ type: 'text', text: `Squad '${squad_id}' não encontrado.\nUse squad_list para ver os squads disponíveis.` }],
        isError: true,
      }
    }

    const { default: squadJson } = await import(configPath, { assert: { type: 'json' } }) as { default: unknown }
    const squad = squadJson as SquadDefinition

    // Resolve host adapter through shared detection+resolution flow
    const hostAdapter = await resolveHostAdapterForCommand('run')
    const runtime = createSquadRuntime({
      artifactsDir: ARTIFACTS_DIR,
      hostAdapter,
      contextRootPath: CWD,
    })

    await hostAdapter.initialize()

    const job = await runtime.startJob(squad, objective, input ?? objective)
    await runtime.runAll(squad, job)

    const lines = [
      `# Job executado\n`,
      `**Job ID:** \`${job.id}\``,
      `**Squad:** ${squad.name}`,
      `**Status:** ${job.status}`,
      `**Objetivo:** ${job.objective}`,
      '',
    ]

    if (job.artifacts.length > 0) {
      lines.push('## Artefatos produzidos')
      for (const a of job.artifacts) {
        lines.push(`- **${a.name}** → \`${a.path}\``)
      }
      lines.push('')
    }

    if (job.status === 'WAITING_APPROVAL') {
      const pending = job.approvals.filter((a) => a.status === 'pending')
      lines.push('## ⚠ Aprovações pendentes')
      for (const a of pending) {
        lines.push(`- **ID:** \`${a.id}\``)
        lines.push(`  Necessário para: ${a.requiredFor}`)
      }
      lines.push('', 'Use `squad_approve` para aprovar ou rejeitar.')
    }

    if (job.status === 'FAILED') {
      lines.push(`## ❌ Falha\n${job.failureReason ?? 'Sem detalhes'}`)
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
)

// ─── squad_status ─────────────────────────────────────────────────────────────

server.tool(
  'squad_status',
  'Consulta o status de um job específico',
  {
    squad_id: z.string().describe('ID do squad'),
    job_id: z.string().describe('ID do job (pode ser o prefixo)'),
  },
  async ({ squad_id, job_id }) => {
    const store = new ArtifactStore(ARTIFACTS_DIR)
    const jobs = store.listJobs(squad_id)
    const matchedId = jobs.find((j) => j === job_id || j.startsWith(job_id))

    if (!matchedId) {
      return { content: [{ type: 'text', text: `Job '${job_id}' não encontrado para squad '${squad_id}'.` }], isError: true }
    }

    const job = store.loadJob(squad_id, matchedId)
    if (!job) {
      return { content: [{ type: 'text', text: 'Job não encontrado no disco.' }], isError: true }
    }

    const lines = [
      `# Job ${job.id}\n`,
      `**Squad:** ${job.squadId}`,
      `**Status:** ${job.status}`,
      `**Objetivo:** ${job.objective}`,
      `**Iniciado:** ${job.startedAt}`,
      `**Atualizado:** ${job.updatedAt}`,
      job.completedAt ? `**Concluído:** ${job.completedAt}` : '',
      '',
      `## Artefatos (${job.artifacts.length})`,
      ...job.artifacts.map((a) => `- ${a.name} → \`${a.path}\``),
      '',
      `## Aprovações (${job.approvals.length})`,
      ...job.approvals.map((a) => `- [${a.status}] ${a.requiredFor} \`${a.id}\``),
      '',
      '## Últimos eventos',
      ...job.history.slice(-5).map((e) => `- ${e.timestamp.slice(11, 19)} [${e.type}] ${e.message}`),
    ]

    return { content: [{ type: 'text', text: lines.filter(Boolean).join('\n') }] }
  },
)

// ─── squad_approve ────────────────────────────────────────────────────────────

server.tool(
  'squad_approve',
  'Aprova ou rejeita uma aprovação pendente em um job',
  {
    squad_id: z.string(),
    job_id: z.string(),
    approval_id: z.string().describe('ID da aprovação (retornado por squad_run ou squad_status)'),
    decision: z.enum(['approve', 'reject']).describe('approve ou reject'),
    notes: z.string().optional().describe('Notas opcionais sobre a decisão'),
  },
  async ({ squad_id, job_id, approval_id, decision, notes }) => {
    const store = new ArtifactStore(ARTIFACTS_DIR)
    const jobs = store.listJobs(squad_id)
    const matchedId = jobs.find((j) => j === job_id || j.startsWith(job_id))
    if (!matchedId) {
      return { content: [{ type: 'text', text: `Job não encontrado.` }], isError: true }
    }

    const job = store.loadJob(squad_id, matchedId)
    if (!job) {
      return { content: [{ type: 'text', text: `Job não encontrado no disco.` }], isError: true }
    }

    const approval = job.approvals.find((a) => a.id === approval_id)
    if (!approval) {
      return { content: [{ type: 'text', text: `Aprovação '${approval_id}' não encontrada.` }], isError: true }
    }

    if (approval.status !== 'pending') {
      return { content: [{ type: 'text', text: `Aprovação já resolvida (status: ${approval.status}).` }] }
    }

    // Aplica a decisão
    approval.status = decision === 'approve' ? 'approved' : 'rejected'
    approval.resolvedAt = new Date().toISOString()
    approval.resolvedBy = 'human-via-mcp'
    if (notes) approval.notes = notes

    store.saveApprovals(squad_id, matchedId, job.approvals)
    store.saveJob(job)

    const verb = decision === 'approve' ? 'aprovada ✓' : 'rejeitada ✗'
    return {
      content: [{
        type: 'text',
        text: `Aprovação \`${approval_id}\` ${verb}.\n\nPara continuar o job após aprovação, execute squad_run novamente com o mesmo squad_id e objetivo.`,
      }],
    }
  },
)

// ─── squad_context ────────────────────────────────────────────────────────────

server.tool(
  'squad_context',
  'Mostra o contexto do projeto carregado (PROJECT.md, TASKS.md, docs, etc.)',
  {},
  async () => {
    const loader = new ContextLoader({ rootPath: CWD })
    const summary = await loader.summarize()

    const lines = [
      '# Contexto do projeto\n',
      `**Arquivos encontrados:** ${summary.totalFiles}`,
      `**Tamanho total:** ${(summary.totalBytes / 1024).toFixed(1)} KB`,
      `**PROJECT.md:** ${summary.hasProjectMd ? '✓' : '✗ não encontrado'}`,
      `**TASKS.md:** ${summary.hasTasksMd ? '✓' : '✗ não encontrado'}`,
      `**AGENTS.md:** ${summary.hasAgentsMd ? '✓' : '✗ não encontrado'}`,
    ]

    if (summary.missingRecommended.length > 0) {
      lines.push('', '## ⚠ Arquivos recomendados ausentes')
      for (const f of summary.missingRecommended) {
        lines.push(`- ${f} (veja \`templates/${f}\` para criar)`)
      }
    }

    if (Object.keys(summary.categoryCounts).length > 0) {
      lines.push('', '## Distribuição por categoria')
      for (const [cat, count] of Object.entries(summary.categoryCounts)) {
        lines.push(`- **${cat}**: ${count} arquivo(s)`)
      }
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
)

// ─── Start server ─────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)
