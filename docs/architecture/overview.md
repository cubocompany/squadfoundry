# Architecture Overview

Squad Foundry is built around five core principles:

1. **Core never imports adapters** — dependency inversion always
2. **State machine is explicit** — every transition is declared, no implicit changes
3. **All artifacts are human-readable** — JSON + Markdown, inspectable without tooling
4. **Squad = portable config** — reusable across hosts, models, and environments
5. **Guardrails are first-class** — enforced programmatically, not just in prompts

## Layers

```
┌─────────────────────────────────────────────┐
│               CLI / Host Interface          │
├─────────────────────────────────────────────┤
│          Squad Builder | Squad Runtime      │
├────────────────────────┬────────────────────┤
│     Context Layer      │   Artifact Store   │
├────────────────────────┴────────────────────┤
│               Core Layer                    │
│  (types, state machine, guardrails)         │
├─────────────────────────────────────────────┤
│             Adapter Layer                   │
│  host | model | tools | vcs | publishing   │
│  deploy | context                           │
└─────────────────────────────────────────────┘
```

## Core Layer (`orchestrator/core/`)

Pure TypeScript, zero external runtime dependencies. Contains:
- **`types.ts`** — All portable interfaces and type definitions
- **`state-machine.ts`** — Explicit state machine with guard functions
- **`guardrails.ts`** — Policy constraint evaluator

The core never imports from adapters. All coupling flows upward.

## Adapter Layer (`orchestrator/adapters/`)

Pluggable implementations for every external system:

| Interface | Purpose |
|-----------|---------|
| `IHostAdapter` | LLM execution runtime (Anthropic, OpenAI, local) |
| `IModelAdapter` | AI model provider selection |
| `IToolAdapter` | Tool/integration invocation |
| `IVCSAdapter` | Git operations and PRs |
| `ISocialMediaAdapter` | Social media publishing |
| `IDeployAdapter` | Deployment operations |
| `IContextAdapter` | Context file discovery and loading |

All adapters implement a clear interface. Swap implementations without touching core logic.

## Context Layer (`orchestrator/context/`)

Discovers and loads project documentation:
- `context-loader.ts` — Orchestrates discovery + loading via `IContextAdapter`
- `context-index.ts` — In-memory search index over loaded files

Priority order: PROJECT.md > TASKS.md > AGENTS.md > README.md > docs/** > specs/** > ...

## Artifact Store (`orchestrator/artifacts/`)

Filesystem-based persistence for all job data:
```
artifacts/<squad_id>/<job_id>/
  state.json       — full job state
  handoffs.json    — agent handoff records
  events.json      — history entries
  approvals.json   — approval records
  outputs/         — agent-produced artifacts
  reports/         — human-readable reports
```

## Squad Builder (`orchestrator/builder/`)

Interview-driven squad generation:
1. `interview-questions.ts` — Question bank organized by topic
2. `domain-classifier.ts` — Maps answers to SquadDomain
3. `squad-generator.ts` — Generates SquadDefinition + files
4. `squad-builder.ts` — Orchestrates the interview process

## Squad Runtime (`orchestrator/runtime/`)

Execution engine:
1. `job-manager.ts` — Job creation, state updates, history
2. `agent-dispatcher.ts` — Step → agent resolution + prompt building
3. `handoff-manager.ts` — Records and validates handoffs
4. `approval-gate.ts` — Human-in-the-loop pause/resume
5. `squad-runtime.ts` — Main coordinator

## Data Flow

```
User input
  ↓ SquadBuilder (interview)
  ↓ DomainClassifier
  ↓ SquadGenerator → squad.json files written to disk
  ↓
SquadRuntime.startJob()
  ↓ ContextLoader.load() → LoadedContext
  ↓ JobManager.create() → JobDefinition (persisted)
  ↓ StateMachine.transition('MARK_READY')
  ↓
Loop: SquadRuntime.executeStep()
  ↓ GuardrailEngine.evaluateAll() → block or pass
  ↓ ApprovalGate.isPending() → wait or continue
  ↓ AgentDispatcher.plan() → prompt
  ↓ IHostAdapter.sendPrompt() → AgentResponse
  ↓ ArtifactStore.persistArtifact() → ArtifactRef
  ↓ HandoffManager.record() → HandoffEvent
  ↓ StateMachine.transition('STEP_COMPLETE')
  ↓ next step or COMPLETE
```
