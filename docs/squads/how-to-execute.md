# How to Execute a Squad

## Prerequisites

1. A squad definition exists at `squads/<squad_id>/config/squad.json`
2. npm dependencies are installed (`npm install`)
3. TypeScript compiled (`npm run build`)

## Method 1: CLI

```bash
# initialize host-native config
node dist/orchestrator/cli/index.js init

# create or edit squad definitions
node dist/orchestrator/cli/index.js create
node dist/orchestrator/cli/index.js edit software-development

# Run a job
node dist/orchestrator/cli/index.js run software-development \
  --objective "Implement dark mode toggle" \
  --input "Add a dark mode toggle to the settings page. Use CSS variables."

# Check status
node dist/orchestrator/cli/index.js status software-development <job-id>

# List all squads
node dist/orchestrator/cli/index.js list

# Inspect host selection and persisted preference
node dist/orchestrator/cli/index.js hosts
```

## Method 2: Programmatic API

```typescript
import { createSquadRuntime } from './orchestrator/runtime/squad-runtime.js'
import { AnthropicHostAdapter } from './orchestrator/adapters/host/anthropic.adapter.js'
import squadJson from './squads/software-development/config/squad.json' assert { type: 'json' }
import type { SquadDefinition } from './orchestrator/core/types.js'

const squad = squadJson as SquadDefinition

const hostAdapter = new AnthropicHostAdapter()
await hostAdapter.initialize()

const runtime = createSquadRuntime({
  hostAdapter,
  artifactsDir: 'artifacts',
  contextRootPath: process.cwd(),
})

// Start job
const job = await runtime.startJob(
  squad,
  'Implement dark mode toggle',
  'Add dark mode to settings page using CSS variables',
)

// Run all steps (stops at approvals or blocks)
await runtime.runAll(squad, job)

console.log('Job status:', job.status)
console.log('Artifacts:', job.artifacts.map(a => a.name))
```

## Handling Approvals

When a job reaches `WAITING_APPROVAL`:

```typescript
// Grant approval
const pendingApproval = job.approvals.find(a => a.status === 'pending')
if (pendingApproval) {
  runtime.grantApproval(job, pendingApproval.id, 'human-operator', 'Looks good, proceed')

  // Resume execution
  await runtime.runAll(squad, job)
}
```

## Artifacts

All job outputs are stored at:
```
artifacts/<squad_id>/<job_id>/
  state.json        — full job state
  handoffs.json     — agent handoffs
  events.json       — full event history
  approvals.json    — approval records
  outputs/          — agent-produced files (markdown, json)
  reports/          — summary reports and runtime metadata
```

Runtime metadata report:
- `reports/runtime-metadata.json`
- fields: `resolvedHost`, `confidence`, `reasons`, `activeModel`, `fallbackPath`

## Switching the Host Adapter

For CLI shell mode, host resolution is automatic by detection + persisted preference.
If no valid host is detected, CLI asks for host selection.

For explicit adapter selection in non-interactive environments:

```bash
SQUAD_FOUNDRY_ADAPTER=local node dist/orchestrator/cli/index.js run software-development --objective "..."
```

Available adapter IDs in current runtime:
- `local`
- `antigravity`
- `anthropic`
- `openai`

Programmatic switching remains available:

```typescript
// Use Anthropic
import { AnthropicHostAdapter } from './orchestrator/adapters/host/anthropic.adapter.js'
const hostAdapter = new AnthropicHostAdapter() // reads ANTHROPIC_API_KEY

// Use OpenAI
import { OpenAIHostAdapter } from './orchestrator/adapters/host/openai.adapter.js'
const hostAdapter = new OpenAIHostAdapter() // reads OPENAI_API_KEY

// Use local LLM (Ollama)
import { LocalHostAdapter } from './orchestrator/adapters/host/local.adapter.js'
const hostAdapter = new LocalHostAdapter('http://localhost:11434', 'llama3.2')
```

## Context Loading

The runtime automatically loads context from the project root:
- `PROJECT.md` → informs all agents about project conventions
- `TASKS.md` → informs agents about current work state
- `docs/**` → additional documentation

Place these files in your project root before running jobs.
