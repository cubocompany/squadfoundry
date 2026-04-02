# Squad Foundry — Implementation Plan

## Overview

**Squad Foundry** is a local, extensible multi-agent squad orchestration platform designed to be:
- Model-agnostic (swap providers without rewriting core)
- Host-agnostic (works in Antigravity, Claude Code, Cursor, Codex, Zed, OpenCode, etc.)
- Tool-agnostic (adapters for any integration)
- Domain-agnostic (software, Instagram, marketing, docs, research, etc.)

The repository starts **completely empty**, so this plan establishes the full architecture from scratch.

---

## User Review Required

> [!IMPORTANT]
> The entire architecture will be created in a single session. Nothing exists yet. Review the structure and adapter strategy before approving.

> [!WARNING]
> All integrations (GitHub, CI/CD, Instagram, etc.) will be implemented as **typed stubs/interfaces**. No real API calls will be made. This is intentional and documented.

---

## Architecture Overview

```
Squad Foundry
├── Core Layer       — Pure TS, zero external deps, model/host/tool agnostic
├── Builder Layer    — Interviews user, reads context, generates squad definitions
├── Runtime Layer    — Executes squads, manages jobs, state machine, guardrails
├── Adapter Layer    — Pluggable drivers for host, model, tools, VCS, etc.
├── Context Layer    — Reads PROJECT.md, TASKS.md, docs/**, specs/**, etc.
├── Artifact Store   — Persists all job state, handoffs, outputs to filesystem
└── Squads           — Formal squad definitions (examples + user-created)
```

### Core Principles
1. **Core never imports adapters** — dependency inversion always
2. **State machine is explicit** — no implicit state transitions
3. **All artifacts are human-readable files** — JSON + Markdown
4. **Squad = portable config file** — reusable across hosts/models
5. **Guardrails are first-class** — enforced at runtime layer

---

## Proposed Changes

### Foundation Layer

#### [NEW] `package.json` + `tsconfig.json`
- TypeScript project with strict mode
- No framework dependencies for core
- `zod` for runtime schema validation
- `commander` for CLI entrypoint
- `glob` for context file discovery

---

### Core Abstractions (`orchestrator/core/`)

#### [NEW] `orchestrator/core/types.ts`
All base type definitions:
- `SquadDefinition` — full squad config
- `AgentDefinition` — portable agent config
- `WorkflowDefinition` — steps, deps, loops, guards
- `JobDefinition` — runtime job entity
- `HandoffEvent` — agent-to-agent transition record
- `ArtifactRef` — reference to a persisted artifact
- `GuardrailRule` — policy constraint
- `JobStatus` — state machine enum

#### [NEW] `orchestrator/core/state-machine.ts`
Explicit state machine with:
- Base states: `INTAKE_PENDING`, `CONTEXT_LOADING`, `SQUAD_DESIGNING`, `SQUAD_READY`, `JOB_CREATED`, `WAITING_USER_INPUT`, `READY_FOR_EXECUTION`, `RUNNING_STEP`, `BLOCKED`, `WAITING_APPROVAL`, `FAILED`, `COMPLETED`
- `transition(from, event, guardFn)` — validated transitions
- Squad-extensible (custom states per squad)

#### [NEW] `orchestrator/core/guardrails.ts`
Built-in guardrail rules + evaluation engine:
- `requireMinimumContext`
- `requireArtifactBeforeStep`
- `requireApprovalBeforePublish`
- `requireHumanBeforeDeploy`
- `blockInvalidStateTransition`

---

### Adapter Interfaces (`orchestrator/adapters/`)

#### [NEW] `orchestrator/adapters/host/IHostAdapter.ts`
Interface for host runtime (how the agent "runs"):
```ts
interface IHostAdapter {
  sendPrompt(prompt: string, options: PromptOptions): Promise<AgentResponse>
  streamPrompt(prompt: string, options: PromptOptions): AsyncGenerator<string>
}
```

#### [NEW] `orchestrator/adapters/host/anthropic.adapter.ts` (stub)
#### [NEW] `orchestrator/adapters/host/openai.adapter.ts` (stub)
#### [NEW] `orchestrator/adapters/host/local.adapter.ts` (stub)

#### [NEW] `orchestrator/adapters/model/IModelAdapter.ts`
Per-agent model selection with provider abstraction.

#### [NEW] `orchestrator/adapters/tools/IToolAdapter.ts`
Generic tool invocation interface.

#### [NEW] `orchestrator/adapters/vcs/IVCSAdapter.ts`
Git operations: branch, commit, push (stub).

#### [NEW] `orchestrator/adapters/vcs/github.adapter.ts` (stub)
PR creation, review, merge.

#### [NEW] `orchestrator/adapters/publishing/ISocialMediaAdapter.ts`
Post scheduling, publishing (stub).

#### [NEW] `orchestrator/adapters/publishing/instagram.adapter.ts` (stub)

#### [NEW] `orchestrator/adapters/deploy/IDeployAdapter.ts`
Deploy trigger with human-confirmation gate (stub).

#### [NEW] `orchestrator/adapters/context/IContextAdapter.ts`
Context file loading: PROJECT.md, TASKS.md, docs/**, etc.

#### [NEW] `orchestrator/adapters/context/filesystem.context-adapter.ts`
Real implementation: discovers and reads context files from filesystem.

---

### Context Layer (`orchestrator/context/`)

#### [NEW] `orchestrator/context/context-loader.ts`
Discovers and loads contextual files by priority:
1. `PROJECT.md`
2. `TASKS.md`
3. `AGENTS.md`
4. `README.md`
5. `docs/**`
6. `specs/**`
7. `playbooks/**`
8. `policies/**`
9. `templates/**`

#### [NEW] `orchestrator/context/context-index.ts`
In-memory index of loaded context with metadata.

---

### Squad Builder (`orchestrator/builder/`)

#### [NEW] `orchestrator/builder/squad-builder.ts`
Interview engine:
- Conducts structured Q&A session
- Reads existing context files
- Classifies domain
- Generates squad definition

#### [NEW] `orchestrator/builder/interview-questions.ts`
Question bank organized by topic:
- Objective, domain, inputs/outputs
- Steps & approvals, tools, policies
- Risks, human-in-the-loop requirements
- Context files available

#### [NEW] `orchestrator/builder/squad-generator.ts`
Takes interview answers → generates:
- `SQUAD.md`
- `WORKFLOW.md`
- `AGENTS.md`
- `POLICIES.md`
- `config/squad.json`

#### [NEW] `orchestrator/builder/domain-classifier.ts`
Maps interview answers to domain templates:
- `software-development`
- `content-marketing`
- `social-media`
- `documentation`
- `research`
- `custom`

---

### Squad Runtime (`orchestrator/runtime/`)

#### [NEW] `orchestrator/runtime/squad-runtime.ts`
Main execution engine:
- Loads squad definition
- Creates job
- Runs state machine
- Dispatches agents
- Manages handoffs

#### [NEW] `orchestrator/runtime/job-manager.ts`
Job lifecycle: create, update, complete, fail.

#### [NEW] `orchestrator/runtime/agent-dispatcher.ts`
Selects correct agent for current workflow step.

#### [NEW] `orchestrator/runtime/handoff-manager.ts`
Records and validates agent-to-agent handoffs.

#### [NEW] `orchestrator/runtime/approval-gate.ts`
Human-in-the-loop pause/resume mechanism.

---

### Artifact Store (`orchestrator/artifacts/`)

#### [NEW] `orchestrator/artifacts/artifact-store.ts`
Filesystem-based artifact persistence:
- `artifacts/<squad_id>/<job_id>/state.json`
- `artifacts/<squad_id>/<job_id>/handoffs.json`
- `artifacts/<squad_id>/<job_id>/events.json`
- `artifacts/<squad_id>/<job_id>/approvals.json`
- `artifacts/<squad_id>/<job_id>/outputs/`
- `artifacts/<squad_id>/<job_id>/reports/`

---

### CLI Entrypoint (`orchestrator/cli/`)

#### [NEW] `orchestrator/cli/index.ts`
Commands:
- `squadfoundry build` — start squad builder interview
- `squadfoundry run <squad_id>` — execute a squad job
- `squadfoundry status <job_id>` — check job status
- `squadfoundry list` — list squads and jobs

---

### Squad Examples (`squads/`)

#### [NEW] `squads/templates/` — Reusable patterns

#### [NEW] `squads/examples/software-development/`
Full development squad:
- `SQUAD.md`, `WORKFLOW.md`, `AGENTS.md`, `POLICIES.md`
- Agents: Product, Code, Reviewer, Test, Commit, PR, Deploy
- `config/squad.json`

#### [NEW] `squads/examples/instagram-content/`
Instagram squad:
- `SQUAD.md`, `WORKFLOW.md`, `AGENTS.md`, `POLICIES.md`
- Agents: Strategy, Research, Copy, Creative Review, Brand/Compliance, Approval, Publisher, Analytics
- `config/squad.json`

---

### Context Templates (`templates/`)

#### [NEW] `templates/PROJECT.md`
#### [NEW] `templates/TASKS.md`
#### [NEW] `templates/SQUAD.md`
#### [NEW] `templates/WORKFLOW.md`
#### [NEW] `templates/POLICIES.md`
#### [NEW] `templates/AGENTS.md`

---

### Documentation (`docs/`)

#### [NEW] `docs/architecture/overview.md`
#### [NEW] `docs/architecture/adapter-pattern.md`
#### [NEW] `docs/architecture/state-machine.md`
#### [NEW] `docs/architecture/context-loading.md`
#### [NEW] `docs/squads/how-to-create.md`
#### [NEW] `docs/squads/how-to-execute.md`
#### [NEW] `docs/squads/domain-examples.md`
#### [NEW] `docs/development/adding-agents.md`
#### [NEW] `docs/development/adding-hosts.md`
#### [NEW] `docs/development/adding-models.md`
#### [NEW] `docs/development/adding-integrations.md`

---

### Tests (`tests/`)

#### [NEW] `tests/unit/state-machine.test.ts`
#### [NEW] `tests/unit/guardrails.test.ts`
#### [NEW] `tests/unit/context-loader.test.ts`
#### [NEW] `tests/unit/squad-builder.test.ts`
#### [NEW] `tests/unit/artifact-store.test.ts`
#### [NEW] `tests/integration/software-squad.test.ts`
#### [NEW] `tests/integration/instagram-squad.test.ts`

---

### Root Files

#### [NEW] `README.md` — Platform overview + quickstart
#### [NEW] `PROJECT.md` — Meta: describes Squad Foundry itself
#### [NEW] `AGENTS.md` — Platform-level agent conventions
#### [NEW] `.gitignore`

---

## Open Questions

> [!IMPORTANT]
> **Language choice**: The plan uses **TypeScript** for the core. This gives static typing, portability, and works well in all target environments (Node.js CLI, IDE agents). If you prefer Python, I can pivot. 

> [!IMPORTANT]
> **Test runner**: Plan uses **Vitest** (fast, zero config, TypeScript-native). Confirm or suggest alternative.

> [!IMPORTANT]
> **Interview mode**: The Squad Builder interview is designed as a **CLI interactive flow** for now. In agent environments (Antigravity, Claude Code), it becomes a conversation loop. Is that acceptable?

---

## Verification Plan

### Automated Tests
```bash
npm run test               # all tests
npm run test:unit          # unit tests only
npm run test:integration   # integration tests only
```

### Manual Verification
1. Run `npm run build` — TypeScript compiles cleanly
2. Run `node dist/cli/index.js list` — lists example squads
3. Inspect `squads/examples/software-development/` — all files present and valid JSON
4. Inspect `squads/examples/instagram-content/` — domain-agnostic proof
5. Run `npm test` — all tests pass

---

## Implementation Order

1. **Project scaffolding** (package.json, tsconfig, .gitignore)
2. **Core types** (types.ts, state-machine.ts, guardrails.ts)
3. **Adapter interfaces** (all `I*.ts` files)
4. **Context layer** (context-loader, context-index)
5. **Adapter stubs** (host, model, tools, VCS, publishing, deploy)
6. **Artifact store**
7. **Squad runtime** (runtime, job-manager, dispatcher, handoffs, approvals)
8. **Squad builder** (interview, generator, domain-classifier)
9. **CLI entrypoint**
10. **Squad examples** (software-dev, instagram)
11. **Templates** (PROJECT.md, TASKS.md, etc.)
12. **Documentation** (docs/**)
13. **Tests**
14. **README.md + PROJECT.md**
