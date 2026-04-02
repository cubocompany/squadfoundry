# Squad Foundry — Task Tracker

## Phase 1: Project Scaffolding
- [x] package.json + tsconfig.json + .gitignore
- [x] vitest.config.ts

## Phase 2: Core Layer
- [x] orchestrator/core/types.ts
- [x] orchestrator/core/state-machine.ts
- [x] orchestrator/core/guardrails.ts

## Phase 3: Adapter Interfaces
- [x] orchestrator/adapters/host/IHostAdapter.ts
- [x] orchestrator/adapters/model/IModelAdapter.ts
- [x] orchestrator/adapters/tools/IToolAdapter.ts
- [x] orchestrator/adapters/vcs/IVCSAdapter.ts
- [x] orchestrator/adapters/publishing/ISocialMediaAdapter.ts
- [x] orchestrator/adapters/deploy/IDeployAdapter.ts
- [x] orchestrator/adapters/context/IContextAdapter.ts

## Phase 4: Adapter Stubs
- [x] orchestrator/adapters/host/anthropic.adapter.ts
- [x] orchestrator/adapters/host/openai.adapter.ts
- [x] orchestrator/adapters/host/local.adapter.ts
- [x] orchestrator/adapters/vcs/github.adapter.ts
- [x] orchestrator/adapters/publishing/instagram.adapter.ts
- [x] orchestrator/adapters/deploy/vercel.adapter.ts
- [x] orchestrator/adapters/context/filesystem.context-adapter.ts

## Phase 5: Context Layer
- [x] orchestrator/context/context-loader.ts
- [x] orchestrator/context/context-index.ts

## Phase 6: Artifact Store
- [x] orchestrator/artifacts/artifact-store.ts

## Phase 7: Squad Runtime
- [x] orchestrator/runtime/job-manager.ts
- [x] orchestrator/runtime/agent-dispatcher.ts
- [x] orchestrator/runtime/handoff-manager.ts
- [x] orchestrator/runtime/approval-gate.ts
- [x] orchestrator/runtime/squad-runtime.ts

## Phase 8: Squad Builder
- [x] orchestrator/builder/interview-questions.ts
- [x] orchestrator/builder/domain-classifier.ts
- [x] orchestrator/builder/squad-generator.ts
- [x] orchestrator/builder/squad-builder.ts

## Phase 9: CLI Entrypoint
- [x] orchestrator/cli/index.ts

## Phase 10: Squad Examples
- [x] squads/examples/software-development/ (SQUAD.md, WORKFLOW.md, AGENTS.md, POLICIES.md, config/squad.json)
- [x] squads/examples/instagram-content/ (idem)

## Phase 11: Templates
- [x] templates/PROJECT.md
- [x] templates/TASKS.md
- [x] templates/SQUAD.md
- [x] templates/WORKFLOW.md
- [x] templates/POLICIES.md
- [x] templates/AGENTS.md
- [x] squads/templates/ (squad template patterns)

## Phase 12: Documentation
- [x] docs/architecture/overview.md
- [x] docs/architecture/adapter-pattern.md
- [x] docs/architecture/state-machine.md
- [x] docs/architecture/context-loading.md
- [x] docs/squads/how-to-create.md
- [x] docs/squads/how-to-execute.md
- [x] docs/squads/domain-examples.md
- [x] docs/development/adding-agents.md
- [x] docs/development/adding-hosts.md
- [x] docs/development/adding-models.md
- [x] docs/development/adding-integrations.md

## Phase 13: Tests
- [x] tests/unit/state-machine.test.ts
- [x] tests/unit/guardrails.test.ts
- [x] tests/unit/context-loader.test.ts
- [x] tests/unit/squad-builder.test.ts
- [x] tests/unit/artifact-store.test.ts
- [x] tests/integration/software-squad.test.ts
- [x] tests/integration/instagram-squad.test.ts

## Phase 14: Root Files
- [x] README.md
- [x] PROJECT.md
- [x] AGENTS.md

## Phase 15: Verify
- [x] npm install
- [x] npm run build
- [x] npm test
