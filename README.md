# Squad Foundry

**Local extensible multi-agent squad orchestration platform.**

Model-agnostic. Host-agnostic. Tool-agnostic. Domain-agnostic.

---

## What is Squad Foundry?

Squad Foundry lets you design and run **collaborative multi-agent squads** for any domain:

- Software development (spec → code → review → test → PR → deploy)
- Instagram content (strategy → copy → review → approval → publish → analytics)
- Documentation, research, marketing, operations — anything task-and-handoff-oriented

Squads are **portable JSON configurations**. The same squad runs in Claude Code, OpenCode, Cursor, Codex, Zed, or any compatible host — just swap the adapter.

---

## Quickstart

### Instalar como pacote npm

```bash
npm install squadfoundry
```

### Usar no Claude Code / OpenCode / Cursor / Codex / Zed

Você não precisa de API key — a IDE já é o modelo. O `IDEHostAdapter` recebe um callback que a IDE executa:

```typescript
import {
  IDEHostAdapter,
  createSquadRuntime,
  createSquadBuilder,
} from 'squadfoundry'

// O callback que você fornece É o modelo — a IDE executa isso
const runtime = createSquadRuntime({
  hostAdapter: new IDEHostAdapter(async (prompt) => {
    // Aqui você integra com o modelo que já está rodando na sua IDE.
    // Em Claude Code: use o agente atual para responder o prompt.
    // Em OpenCode: use opencode.complete(prompt)
    // Em Cursor: use cursor.chat(prompt)
    return yourIDEModel.complete(prompt)
  }),
})

// Carregar um squad e executar um job
import squadJson from './squads/examples/software-development/config/squad.json' assert { type: 'json' }
const job = await runtime.startJob(squadJson, 'Implement dark mode', 'Add toggle to settings page')
await runtime.runAll(squadJson, job)
```

### CLI (uso local)

```bash
# Instalar globalmente
npm install -g squadfoundry

# Inicializar config host-native
squadfoundry init

# Criar um novo squad (entrevista guiada via host ativo)
squadfoundry create

# Editar um squad existente
squadfoundry edit software-development

# Executar um job
squadfoundry run software-development --objective "Implement dark mode"

# Ver status
squadfoundry status software-development <job-id>

# Listar squads
squadfoundry list

# Ver host resolvido e preferencia persistida
squadfoundry hosts
```

### Desenvolvimento local

```bash
# Clonar e instalar
npm install

# Compilar
npm run build

# Testes
npm test
```

---

## Architecture

```
Squad Foundry
├── Core Layer          orchestrator/core/
│   ├── types.ts        All portable type definitions
│   ├── state-machine.ts Explicit state transitions
│   └── guardrails.ts   Policy enforcement engine
│
├── Adapter Layer       orchestrator/adapters/
│   ├── host/           IHostAdapter + stubs (Anthropic, OpenAI, Local)
│   ├── model/          IModelAdapter
│   ├── tools/          IToolAdapter
│   ├── vcs/            IVCSAdapter + GitHub stub
│   ├── publishing/     ISocialMediaAdapter + Instagram stub
│   ├── deploy/         IDeployAdapter + Vercel stub
│   └── context/        IContextAdapter + filesystem adapter
│
├── Context Layer       orchestrator/context/
│   ├── context-loader.ts Discovers and loads PROJECT.md, TASKS.md, docs/**
│   └── context-index.ts  In-memory search index
│
├── Artifact Store      orchestrator/artifacts/
│   └── artifact-store.ts Persists all job state, handoffs, outputs
│
├── Squad Runtime       orchestrator/runtime/
│   ├── squad-runtime.ts  Main execution engine
│   ├── job-manager.ts    Job lifecycle
│   ├── agent-dispatcher.ts Step → Agent routing
│   ├── handoff-manager.ts Agent handoff records
│   └── approval-gate.ts  Human-in-the-loop mechanism
│
├── Squad Builder       orchestrator/builder/
│   ├── squad-builder.ts  Interview orchestrator
│   ├── interview-questions.ts Question bank
│   ├── domain-classifier.ts  Domain detection
│   └── squad-generator.ts    File generation
│
├── CLI                 orchestrator/cli/index.ts
│
├── Squad Examples      squads/examples/
│   ├── software-development/
│   └── instagram-content/
│
├── Templates           templates/
└── Docs                docs/
```

---

## Key Concepts

### Squad
A portable, reusable configuration defining: agents, workflow, policies, guardrails, expected artifacts. Stored as `squads/<squad_id>/config/squad.json`.

### Job
A runtime instance of a squad. Has a unique ID, state machine status, history, artifacts, and approvals. Stored under `artifacts/<squad_id>/<job_id>/`.

### Agent
A portable definition of an AI agent: role, instructions, allowed tools, handoff rules. Not tied to any specific model or host.

### Workflow
Ordered steps with dependencies, loops, approval gates, and guardrails. Fully declarative — no hardcoded logic.

### Guardrail
A programmatically enforced policy constraint. Examples: "no deploy without human approval", "no publish without compliance review".

### Adapter
An implementation of a well-defined interface (host, model, VCS, publish, deploy). Swap adapters to change the execution environment without touching core logic.

---

## Squad Examples

| Squad | Domain | Agents |
|-------|--------|--------|
| `software-development` | software-development | Product, Code, Reviewer, Test, Commit, PR, Deploy |
| `instagram-content` | social-media | Strategy, Research, Copy, Creative Review, Brand, Approval, Publisher, Analytics |

---

## Adapter Status

| Adapter | Tipo | Status | Quando usar |
|---------|------|--------|-------------|
| `ClaudeCodeHostAdapter` | host | **real** | Bridge CLI nativa do Claude Code (sem API key) |
| `OpenCodeHostAdapter` | host | **real** | Bridge CLI nativa do OpenCode (sem API key) |
| `IDEHostAdapter` | host | **real** | Claude Code, OpenCode, Cursor, Codex, Zed — **a IDE é o modelo** |
| `LocalHostAdapter` | host | stub | Ollama, LM Studio, llama.cpp local |
| `AnthropicHostAdapter` | host | stub | API Anthropic direta (`ANTHROPIC_API_KEY`) |
| `OpenAIHostAdapter` | host | stub | API OpenAI direta (`OPENAI_API_KEY`) |
| `GitHubVCSAdapter` | vcs | stub | `GITHUB_TOKEN` + `GITHUB_REPO` |
| `InstagramAdapter` | publishing | stub | `INSTAGRAM_ACCESS_TOKEN` |
| `VercelDeployAdapter` | deploy | stub | `VERCEL_TOKEN` |
| `FilesystemContextAdapter` | context | **real** | Lê arquivos locais automaticamente |

> **Nota sobre IDEs AI-nativas:** Claude Code, OpenCode, Cursor, Codex e similares **já são o modelo**. Use `IDEHostAdapter` com um callback que delega para o mecanismo nativo da IDE. Nenhum API key adicional é necessário nesses ambientes.

---

## Context Files

Squad Foundry automatically reads:

| File | Priority | Purpose |
|------|----------|---------|
| `PROJECT.md` | 1 (highest) | Project overview, conventions |
| `TASKS.md` | 2 | Current task state |
| `AGENTS.md` | 3 | Agent conventions |
| `README.md` | 4 | General project info |
| `docs/**` | 5 | Documentation |
| `specs/**` | 6 | Specifications |
| `playbooks/**` | 7 | Playbooks |
| `policies/**` | 8 | Policies |

---

## Human-in-the-Loop

Approvals are always explicit. The system never auto-approves publishing or deployment.

Configure required approvals in the squad's `POLICIES.md` and `config/squad.json`.

---

## Host-native Resolution

Host resolution is CLI-first and explicit:

- Detector scores strong/medium/weak host signals.
- Resolver uses detected host when valid, then persisted host when still valid.
- If unresolved, interactive CLI asks for host selection.
- Runtime writes host provenance at `artifacts/<squad>/<job>/reports/runtime-metadata.json`.
- `status` prints `resolvedHost`, `confidence`, `reasons`, `activeModel`, and `fallbackPath`.

---

## Creating a New Squad

```bash
# Interactive interview
node dist/cli/index.js build

# Or programmatically
import { createSquadBuilder } from './orchestrator/builder/squad-builder.js'
const builder = createSquadBuilder()
const result = await builder.build(answers)
```

See [`docs/squads/how-to-create.md`](docs/squads/how-to-create.md) for full guide.

---

## License

MIT
