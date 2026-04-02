# Squad Foundry Design Spec: Host-Native CLI Shell

Date: 2026-04-01
Status: Draft (design approved in conversation)
Owner: Squad Foundry

## 1) Context and Goal

Squad Foundry already has a strong architecture in `orchestrator/core`, `orchestrator/runtime`, and `orchestrator/builder`, with clear adapter interfaces and test coverage. The product goal for this phase is to deliver an experience similar in usability to OpenSquad (command-first, low-friction workflow) while preserving Squad Foundry's own identity and architecture.

This phase is explicitly CLI-first. MCP remains available but is secondary.

Primary outcomes:
- Keep the core host/model/tool/domain agnostic.
- Provide a command flow that feels native in real IDE usage.
- Use the active IDE model for guided interviews (`create`/`edit`) and runtime execution (`run`).
- Avoid mandatory API key setup for the primary host-native workflow.

## 2) Product Principles

1. **Do not copy OpenSquad internals**: borrow interaction ergonomics only.
2. **Core remains pure**: `orchestrator/core/*` and runtime internals do not hardcode host vendors.
3. **Host-native first**: if running inside Claude Code, OpenCode, Codex, Antigravity, Zed, etc., use that host's active model.
4. **No silent fallback to API-key providers**: fallback is explicit and user-visible.
5. **Deterministic traceability**: every job records chosen host, model, confidence, and fallback reasons.

## 3) Scope

### In Scope
- New CLI shell layer for command UX.
- Host detection and host resolution with confidence scoring.
- Assisted host selection when auto-detection is ambiguous or fails.
- Interview bridge using host-native model for `create` and `edit`.
- Runtime invocation through resolved host adapter.
- Improved CLI diagnostics and run reporting.
- Tests and docs for the new flow.

### Out of Scope (This Phase)
- Replacing the core state machine or guardrail engine.
- MCP as primary transport.
- Full parity across every host on day one.
- Real deploy/publish side effects without explicit approval gates.

## 4) Target User Experience

### Core Commands
- `squadfoundry init`
- `squadfoundry create`
- `squadfoundry edit <squad-id>`
- `squadfoundry run <squad-id>`
- `squadfoundry list`
- `squadfoundry status <squad-id> <job-id>`
- `squadfoundry hosts`

### UX Guarantees
- `init` configures project for host-native usage first.
- `create` and `edit` interview turns run on the active IDE model.
- `run` uses the same resolved host unless user overrides.
- If host is not confidently detected, CLI asks user which IDE to use and persists that decision.

## 5) Architecture

### 5.1 Existing Layers (Preserved)
- `orchestrator/core/*`
- `orchestrator/runtime/*`
- `orchestrator/builder/*`
- `orchestrator/adapters/*`
- `orchestrator/context/*`
- `orchestrator/artifacts/*`

### 5.2 New CLI Shell Layer
Add:
- `orchestrator/shell/cli.ts`
- `orchestrator/shell/commands/init.command.ts`
- `orchestrator/shell/commands/create.command.ts`
- `orchestrator/shell/commands/edit.command.ts`
- `orchestrator/shell/commands/run.command.ts`
- `orchestrator/shell/commands/list.command.ts`
- `orchestrator/shell/commands/status.command.ts`
- `orchestrator/shell/commands/hosts.command.ts`

Support services:
- `orchestrator/shell/services/project-bootstrap.service.ts`
- `orchestrator/shell/services/squad-scaffold.service.ts`
- `orchestrator/shell/services/job-execution.service.ts`
- `orchestrator/shell/services/active-host-detector.service.ts`
- `orchestrator/shell/services/host-resolution.service.ts`
- `orchestrator/shell/services/interview-host-bridge.service.ts`

### 5.3 Config Files
- `squadfoundry.config.json`
- `squadfoundry.hosts.json`

`squads/<id>/config/squad.json` remains source of truth for squad definitions.

## 6) Host-Native Strategy

### 6.1 Detection Model
`ActiveHostDetector` scores candidate hosts using:
- Strong signals: host-specific command context / known workspace entrypoints.
- Medium signals: host config files in repo.
- Weak signals: environment/process hints.

Output:
- `detectedHostId`
- `confidence` (`high | medium | low`)
- `reasons[]`

### 6.2 Resolution Flow
1. If confidence is high, use detected host.
2. If confidence is medium and a previously validated host exists and matches current host-family signals, use it; otherwise prompt user.
3. If confidence is low, always run assisted selection prompt.
4. Persist selected host and last-validation metadata (timestamp + matched signals).

Persisted host validity requirements:
- adapter initializes successfully;
- capability check passes for requested command;
- at least one current medium/strong detection signal matches prior validation.

If any validity requirement fails, force assisted selection.

### 6.3 Mandatory User Prompt on Uncertain Detection
When no host reaches required confidence:
- Prompt user with supported options (installed and configured hosts first).
- Configure or install bridge files for the selected host.
- Continue flow using that host.

### 6.4 Model Selection Rule
`create`, `edit`, and `run` must all use the active model provided by resolved host adapter when available. If model cannot be read, log `model=host-default` in reports.

## 7) Adapter Contract Updates

`IHostAdapter` must support both interview and runtime paths:
- `detect(context): DetectionResult`
- `initialize(): Promise<void>`
- `runInterviewTurn(input, state): Promise<InterviewTurnResult>`
- `sendPrompt(prompt, agent, job, step, options?): Promise<AgentResponse>`
- `getCapabilities(): HostCapabilities`
- `getActiveModel(): Promise<string | null>`

Notes:
- Runtime core still consumes `AgentResponse` only.
- Shell owns resolution logic; runtime must never hardcode host selection.

## 8) Priority Support Matrix

Tier 1 (this cycle):
1. `claude-code`
2. `opencode`

Tier 2 (next cycle):
- `codex`
- `antigravity`
- `zed`

Tier 3:
- `cursor`
- `vscode-copilot`
- additional hosts via plugin adapters

## 9) Known Issues to Fix in Existing Code

1. **MCP host hardcode**: remove forced `AntigravityHostAdapter` behavior and route through normal resolution.
2. **IDE handoff parsing bug**: fix `IDEHostAdapter` handoff extraction logic (agent list source).
3. **CLI squad path mismatch**: support `squads/examples/*` and generated squads consistently.

## 10) Error Handling and Observability

Standardized CLI error categories:
- `host_detection_error`
- `host_execution_error`
- `invalid_squad_config`
- `guardrail_block`
- `approval_pending`

For each error, present:
- human-readable summary
- technical cause
- actionable next step

Each job report includes:
- resolved host
- detection confidence and reasons
- active model (or `host-default`)
- fallback path (if used)

## 11) Testing Strategy

Add tests for:
- host detection scoring and tie-break rules
- assisted host selection path
- host-native interview flow in `create` and `edit`
- runtime execution through resolved host
- fallback behavior without silent API-key switching
- path resolution for examples and generated squads

Keep existing unit/integration tests green.

## 12) Implementation Plan (Phased)

Phase 1:
- Add CLI shell command structure.
- Wire existing runtime/builder through shell services.

Phase 2:
- Implement detector + resolver + persisted host preferences.

Phase 3:
- Implement interview host bridge for `create` and `edit`.

Phase 4:
- Harden Tier 1 adapters (Claude Code then OpenCode).
- Fix known bugs (handoff, pathing, MCP hardcode).

Phase 5:
- Improve CLI diagnostics and run status reporting.

Phase 6:
- Add tests and docs updates.

## 13) Risks and Mitigations

Risks:
- Host capability differences can create uneven UX.
- Ambiguous environments can reduce detection reliability.
- Upstream IDE changes may break adapters.

Mitigations:
- Capability negotiation via adapter contract.
- Assisted selection as required fallback.
- Compatibility docs and adapter tests per host.

## 14) Definition of Done

Done means:
1. `init/create/edit/run` work through the new shell layer.
2. Interviews use active IDE model through resolved host adapter.
3. `run` uses resolved host and records host/model provenance.
4. Uncertain host detection triggers user selection and persistence.
5. No silent fallback to API-key provider paths.
6. Existing tests pass; new host-shell tests pass.
7. Documentation explains setup, operation, and extension.
8. Acceptance checks in CI:
   - `npm test` includes shell detection/resolution/interview/runtime/fallback coverage.
   - E2E verifies `init -> create -> run -> status` for Tier 1 hosts.
   - Golden report assertions include `resolvedHost`, `confidence`, `reasons[]`, `activeModel`, and `fallbackPath`.

## 15) Non-Goals and Guardrails

- Do not embed host-vendor logic into core state machine or guardrails.
- Do not claim unsupported host integrations as complete.
- Do not auto-execute deploy/publish side effects without explicit approvals.
- Do not break domain-agnostic squad behavior.
