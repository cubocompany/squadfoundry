# Host-Native CLI Shell Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a CLI-first Squad Foundry experience that feels OpenSquad-like in usability while remaining fully host/model agnostic and using the active IDE model for interviews and execution.

**Architecture:** Add a new shell layer (`orchestrator/shell/*`) that orchestrates existing builder/runtime modules without moving business logic into CLI handlers. Host selection runs through a detector + resolver pipeline with confidence scoring, assisted fallback, and persisted preferences. Existing core and runtime remain adapter-driven and vendor-neutral.

**Tech Stack:** TypeScript (Node.js ESM), Commander, Vitest, existing Squad Foundry orchestrator modules.

---

## File Structure Map

### New files
- `orchestrator/shell/cli.ts` — new shell entrypoint and command registration.
- `orchestrator/shell/commands/init.command.ts` — project bootstrap command.
- `orchestrator/shell/commands/create.command.ts` — guided squad creation via host-native interview.
- `orchestrator/shell/commands/edit.command.ts` — guided squad editing via host-native interview.
- `orchestrator/shell/commands/run.command.ts` — job execution using resolved host.
- `orchestrator/shell/commands/list.command.ts` — list squads/jobs (including examples).
- `orchestrator/shell/commands/status.command.ts` — status command with actionable diagnostics.
- `orchestrator/shell/commands/hosts.command.ts` — inspect and manage host preferences.
- `orchestrator/shell/services/project-bootstrap.service.ts` — init scaffolding and config writing.
- `orchestrator/shell/services/squad-scaffold.service.ts` — common squad load/save/path helpers.
- `orchestrator/shell/services/active-host-detector.service.ts` — signal-based host detection.
- `orchestrator/shell/services/host-resolution.service.ts` — confidence resolution + assisted selection.
- `orchestrator/shell/services/interview-host-bridge.service.ts` — host-driven interview loop interface.
- `orchestrator/shell/services/job-execution.service.ts` — runtime invocation and report metadata.
- `tests/unit/shell/project-bootstrap.service.test.ts` — init config persistence tests.
- `tests/unit/shell/active-host-detector.test.ts` — detector scoring tests.
- `tests/unit/shell/host-resolution.service.test.ts` — fallback and persistence tests.
- `tests/unit/host/host-adapter-contract.test.ts` — host adapter contract compliance tests.
- `tests/unit/shell/interview-host-bridge.test.ts` — interview bridge tests.
- `tests/integration/shell/cli-run-host-native.test.ts` — init/create/run/status flow tests.

### Modified files
- `orchestrator/cli/index.ts` — become compatibility wrapper or delegate to shell.
- `orchestrator/adapters/host/IHostAdapter.ts` — extend host contract for detection/interview/model metadata.
- `orchestrator/adapters/host/ide.adapter.ts` — fix handoff parsing and implement new optional APIs.
- `orchestrator/mcp/server.ts` — remove hardcoded host for `squad_run`, use shared resolver path.
- `orchestrator/index.ts` — export shell APIs and updated adapter types.
- `package.json` — wire bin entry to shell CLI if needed.
- `docs/squads/how-to-execute.md` — update with host-native CLI flow.
- `docs/development/adding-hosts.md` — document new host adapter contract.

### Runtime config files created by `init`
- `squadfoundry.config.json`
- `squadfoundry.hosts.json`

## Chunk 1: Shell Foundation and Host Resolution

### Task 1: Create shell entrypoint and command wiring

**Files:**
- Create: `orchestrator/shell/cli.ts`
- Create: `orchestrator/shell/commands/init.command.ts`
- Create: `orchestrator/shell/commands/create.command.ts`
- Create: `orchestrator/shell/commands/edit.command.ts`
- Create: `orchestrator/shell/commands/run.command.ts`
- Create: `orchestrator/shell/commands/list.command.ts`
- Create: `orchestrator/shell/commands/status.command.ts`
- Create: `orchestrator/shell/commands/hosts.command.ts`
- Modify: `orchestrator/cli/index.ts`
- Test: `tests/integration/shell/cli-run-host-native.test.ts`

- [ ] **Step 1: Write failing integration test for command registration**

```ts
it('prints help with init/create/edit/run/list/status/hosts', async () => {
  const output = await runCli(['--help'])
  expect(output).toContain('init')
  expect(output).toContain('create')
  expect(output).toContain('edit')
  expect(output).toContain('run')
  expect(output).toContain('list')
  expect(output).toContain('status')
  expect(output).toContain('hosts')
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/integration/shell/cli-run-host-native.test.ts -t "prints help"`
Expected: FAIL because shell CLI does not exist yet.

- [ ] **Step 3: Implement minimal shell CLI and command modules**

```ts
// orchestrator/shell/cli.ts
const program = new Command()
registerInit(program)
registerCreate(program)
registerEdit(program)
registerRun(program)
registerList(program)
registerStatus(program)
registerHosts(program)
```

- [ ] **Step 4: Run targeted test to verify pass**

Run: `npx vitest run tests/integration/shell/cli-run-host-native.test.ts -t "prints help"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add orchestrator/shell orchestrator/cli/index.ts tests/integration/shell/cli-run-host-native.test.ts
git commit -m "feat(cli): add shell entrypoint and command modules"
```

### Task 2: Add config and host preference persistence

**Files:**
- Create: `orchestrator/shell/services/project-bootstrap.service.ts`
- Create: `orchestrator/shell/services/squad-scaffold.service.ts`
- Test: `tests/unit/shell/project-bootstrap.service.test.ts`

- [ ] **Step 1: Write failing unit test for default config creation**

```ts
it('writes squadfoundry.config.json and squadfoundry.hosts.json on init', async () => {
  await initProject(tmpDir)
  expect(existsSync(join(tmpDir, 'squadfoundry.config.json'))).toBe(true)
  expect(existsSync(join(tmpDir, 'squadfoundry.hosts.json'))).toBe(true)
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/unit/shell/project-bootstrap.service.test.ts -t "writes squadfoundry"`
Expected: FAIL.

- [ ] **Step 3: Implement minimal bootstrap persistence**

```ts
await writeJson('squadfoundry.config.json', { version: 1, cliMode: 'shell' })
await writeJson('squadfoundry.hosts.json', { preferredHost: null, lastValidated: null, hosts: [] })
```

- [ ] **Step 4: Re-run test**

Run: `npx vitest run tests/unit/shell/project-bootstrap.service.test.ts -t "writes squadfoundry"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add orchestrator/shell/services/project-bootstrap.service.ts orchestrator/shell/services/squad-scaffold.service.ts tests/unit/shell/project-bootstrap.service.test.ts
git commit -m "feat(cli): persist foundry project and host preference configs"
```

### Task 3: Implement ActiveHostDetector service

**Files:**
- Create: `orchestrator/shell/services/active-host-detector.service.ts`
- Test: `tests/unit/shell/active-host-detector.test.ts`

- [ ] **Step 1: Write failing detector scoring tests**

```ts
it('returns high confidence for strong host signals', async () => {
  const result = await detector.detect({ cwd: fixtureClaude })
  expect(result.confidence).toBe('high')
  expect(result.detectedHostId).toBe('claude-code')
})

it('returns deterministic winner and reasons on tie', async () => {
  const result = await detector.detect({ cwd: fixtureAmbiguous })
  expect(result.reasons).toEqual([...result.reasons].sort())
  expect(result.detectedHostId).toBeDefined()
})

it('returns low confidence when no meaningful signals exist', async () => {
  const result = await detector.detect({ cwd: fixtureNoSignals })
  expect(result.confidence).toBe('low')
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/shell/active-host-detector.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement detector with weighted signals**

```ts
score += signal.type === 'strong' ? 100 : signal.type === 'medium' ? 30 : 10
```

- [ ] **Step 4: Re-run detector tests**

Run: `npx vitest run tests/unit/shell/active-host-detector.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add orchestrator/shell/services/active-host-detector.service.ts tests/unit/shell/active-host-detector.test.ts
git commit -m "feat(host): add active host detector with confidence scoring"
```

### Task 4: Implement HostResolutionService with assisted fallback

**Files:**
- Create: `orchestrator/shell/services/host-resolution.service.ts`
- Test: `tests/unit/shell/host-resolution.service.test.ts`

- [ ] **Step 1: Write failing tests for medium/low confidence rules**

```ts
it('prompts user when confidence is low', async () => {
  const result = await resolver.resolve({ confidence: 'low' })
  expect(result.path).toBe('assisted-selection')
})

it('rejects persisted host when adapter initialization fails', async () => {
  const result = await resolver.resolve(withBrokenPersistedHost())
  expect(result.path).toBe('assisted-selection')
})

it('rejects persisted host when capability check fails for command', async () => {
  const result = await resolver.resolve(withUnsupportedCapabilities('create'))
  expect(result.path).toBe('assisted-selection')
})

it('rejects persisted host without medium/strong signal match', async () => {
  const result = await resolver.resolve(withSignalMismatch())
  expect(result.path).toBe('assisted-selection')
})

it('persists validation metadata for accepted host', async () => {
  const result = await resolver.resolve(withValidPersistedHost())
  expect(result.validation?.timestamp).toBeDefined()
  expect((result.validation?.matchedSignals ?? []).length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/shell/host-resolution.service.test.ts -t "confidence is low"`
Expected: FAIL.

- [ ] **Step 3: Implement resolver validity checks and persistence**

```ts
if (confidence === 'low') return promptUserSelection()
if (confidence === 'medium' && !matchesPriorSignals) return promptUserSelection()
```

- [ ] **Step 4: Re-run resolver tests**

Run: `npx vitest run tests/unit/shell/host-resolution.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add orchestrator/shell/services/host-resolution.service.ts tests/unit/shell/host-resolution.service.test.ts
git commit -m "feat(host): add resolution flow with assisted fallback and validation"
```

### Task 5: Extend host adapter contract for detection/interview/model metadata

**Files:**
- Modify: `orchestrator/adapters/host/IHostAdapter.ts`
- Modify: `orchestrator/adapters/host/ide.adapter.ts`
- Modify: `orchestrator/adapters/host/local.adapter.ts`
- Modify: `orchestrator/adapters/host/antigravity.adapter.ts`
- Modify: `orchestrator/index.ts`
- Test: `tests/unit/host/host-adapter-contract.test.ts`

- [ ] **Step 1: Write failing type-level and behavior tests for new host APIs**

```ts
expect(typeof adapter.getActiveModel).toBe('function')
expect(typeof adapter.runInterviewTurn).toBe('function')
expect(typeof adapter.detect).toBe('function')
```

- [ ] **Step 2: Run targeted tests**

Run: `npx vitest run tests/unit/host/host-adapter-contract.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add required contract methods and implement adapter defaults**

```ts
getActiveModel(): Promise<string | null>
runInterviewTurn(...): Promise<InterviewTurnResult>
detect(context): DetectionResult
```

- [ ] **Step 4: Re-run tests**

Run: `npx vitest run tests/unit/host/host-adapter-contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add orchestrator/adapters/host/IHostAdapter.ts orchestrator/adapters/host/ide.adapter.ts orchestrator/adapters/host/local.adapter.ts orchestrator/adapters/host/antigravity.adapter.ts orchestrator/index.ts tests/unit/host/host-adapter-contract.test.ts
git commit -m "feat(host): extend adapter contract for detection interview and active model"
```

## Chunk 2: Host-Native Interview, Runtime Integration, and Hardening

### Task 6: Implement interview host bridge and wire create/edit to host-native model

**Files:**
- Create: `orchestrator/shell/services/interview-host-bridge.service.ts`
- Modify: `orchestrator/shell/commands/create.command.ts`
- Modify: `orchestrator/shell/commands/edit.command.ts`
- Test: `tests/unit/shell/interview-host-bridge.test.ts`

- [ ] **Step 1: Write failing tests for host-driven interview turns**

```ts
it('uses resolved host adapter for interview turns', async () => {
  await runCreateWithHost(mockHost)
  expect(mockHost.runInterviewTurn).toHaveBeenCalled()
  expect(getInterviewState().activeModel).toBe(mockHostModel)
})

it('uses resolved host adapter for edit interview turns', async () => {
  await runEditWithHost(mockHost)
  expect(mockHost.runInterviewTurn).toHaveBeenCalled()
  expect(getInterviewState().activeModel).toBe(mockHostModel)
})

it('stores host-default when host cannot expose active model', async () => {
  await runCreateWithHost(mockHostWithoutModel)
  expect(getInterviewState().activeModel).toBe('host-default')
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/unit/shell/interview-host-bridge.test.ts -t "interview turns"`
Expected: FAIL.

- [ ] **Step 3: Implement bridge and command integration**

```ts
const turn = await interviewBridge.nextTurn({ hostAdapter, userInput, state })
```

- [ ] **Step 4: Re-run tests**

Run: `npx vitest run tests/unit/shell/interview-host-bridge.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add orchestrator/shell/services/interview-host-bridge.service.ts orchestrator/shell/commands/create.command.ts orchestrator/shell/commands/edit.command.ts tests/unit/shell/interview-host-bridge.test.ts
git commit -m "feat(builder): run create/edit interviews on resolved host native model"
```

### Task 7: Implement job execution service and wire run/status/list/hosts commands

**Files:**
- Create: `orchestrator/shell/services/job-execution.service.ts`
- Modify: `orchestrator/shell/commands/run.command.ts`
- Modify: `orchestrator/shell/commands/status.command.ts`
- Modify: `orchestrator/shell/commands/list.command.ts`
- Modify: `orchestrator/shell/commands/hosts.command.ts`
- Test: `tests/integration/shell/cli-run-host-native.test.ts`

- [ ] **Step 1: Write failing integration test for init->run->status metadata**

```ts
expect(statusOutput).toContain('resolvedHost')
expect(statusOutput).toContain('activeModel')
expect(statusOutput).toContain('confidence')
expect(statusOutput).toContain('reasons')
expect(statusOutput).toContain('fallbackPath')
expect(await runCli(['list'])).toContain('software-development')
expect(await runCli(['hosts'])).toContain('preferredHost')
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/integration/shell/cli-run-host-native.test.ts -t "resolvedHost"`
Expected: FAIL.

- [ ] **Step 3: Implement service and command wiring**

```ts
const resolution = await resolver.resolve(ctx)
const runtime = createSquadRuntime({ hostAdapter: resolution.adapter, ... })
```

- [ ] **Step 4: Re-run integration test**

Run: `npx vitest run tests/integration/shell/cli-run-host-native.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add orchestrator/shell/services/job-execution.service.ts orchestrator/shell/commands/run.command.ts orchestrator/shell/commands/status.command.ts orchestrator/shell/commands/list.command.ts orchestrator/shell/commands/hosts.command.ts tests/integration/shell/cli-run-host-native.test.ts
git commit -m "feat(runtime): resolve host for run and report host/model provenance"
```

### Task 8: Fix IDE host handoff parsing bug

**Files:**
- Modify: `orchestrator/adapters/host/ide.adapter.ts`
- Test: `tests/unit/host/ide.adapter.test.ts`

- [ ] **Step 1: Write failing unit test for HANDOFF parsing against squad agents**

```ts
expect(response.handoffSignal?.targetAgentId).toBe('reviewer-agent')
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/unit/host/ide.adapter.test.ts -t "HANDOFF"`
Expected: FAIL.

- [ ] **Step 3: Implement fix using squad agent IDs, not context docs**

```ts
const agentIds = squad.agents.map((a) => a.id)
```

- [ ] **Step 4: Re-run test**

Run: `npx vitest run tests/unit/host/ide.adapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add orchestrator/adapters/host/ide.adapter.ts tests/unit/host/ide.adapter.test.ts
git commit -m "fix(host): parse ide handoff using squad agent ids"
```

### Task 9: Fix squad path handling for generated and example squads

**Files:**
- Modify: `orchestrator/shell/services/squad-scaffold.service.ts`
- Modify: `orchestrator/shell/commands/run.command.ts`
- Modify: `orchestrator/shell/commands/list.command.ts`
- Test: `tests/integration/shell/cli-run-host-native.test.ts`

- [ ] **Step 1: Write failing integration test for example squad discovery**

```ts
expect(await runCli(['list'])).toContain('software-development')
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/integration/shell/cli-run-host-native.test.ts -t "example squad"`
Expected: FAIL.

- [ ] **Step 3: Implement unified squad lookup order**

```ts
lookup: squads/<id> first, then squads/examples/<id>
```

- [ ] **Step 4: Re-run integration test**

Run: `npx vitest run tests/integration/shell/cli-run-host-native.test.ts -t "example squad"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add orchestrator/shell/services/squad-scaffold.service.ts orchestrator/shell/commands/run.command.ts orchestrator/shell/commands/list.command.ts tests/integration/shell/cli-run-host-native.test.ts
git commit -m "fix(cli): resolve both generated and example squads consistently"
```

### Task 10: De-hardcode MCP host selection (secondary path)

**Files:**
- Modify: `orchestrator/mcp/server.ts`
- Test: `tests/integration/mcp/squad-run-host-selection.test.ts`

- [ ] **Step 1: Write failing MCP integration test for non-hardcoded host resolution**

```ts
expect(hostResolutionServiceResolveSpy).toHaveBeenCalled()
expect(result.usedResolutionPath).toMatch(/detected|persisted|assisted-selection/)
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/integration/mcp/squad-run-host-selection.test.ts`
Expected: FAIL.

- [ ] **Step 3: Route MCP `squad_run` through shared resolver path**

```ts
const hostAdapter = await hostResolutionService.resolve(...)
```

- [ ] **Step 4: Re-run MCP test**

Run: `npx vitest run tests/integration/mcp/squad-run-host-selection.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add orchestrator/mcp/server.ts tests/integration/mcp/squad-run-host-selection.test.ts
git commit -m "refactor(mcp): use shared host resolution instead of hardcoded antigravity"
```

### Task 11: Add and stabilize full test matrix

**Files:**
- Modify: `tests/unit/shell/host-resolution.service.test.ts`
- Modify: `tests/unit/shell/active-host-detector.test.ts`
- Modify: `tests/unit/shell/interview-host-bridge.test.ts`
- Modify: `tests/integration/shell/cli-run-host-native.test.ts`
- Modify: `tests/integration/software-squad.test.ts`
- Modify: `tests/integration/instagram-squad.test.ts`
- Modify: `orchestrator/shell/services/host-resolution.service.ts`
- Modify: `orchestrator/shell/services/job-execution.service.ts`

- [ ] **Step 1: Add failing cases for low-confidence assisted prompt and persistence validity checks**

```ts
expect(result.path).toBe('assisted-selection')
expect(result.validity.matchedSignals).toBeGreaterThan(0)
```

- [ ] **Step 2: Run targeted shell tests**

Run: `npx vitest run tests/unit/shell tests/integration/shell`
Expected: at least one FAIL before implementation completion.

- [ ] **Step 3: Implement only failing behaviors from Step 1 tests**

```ts
// 3a: persist assisted-selection metadata in host-resolution.service.ts
// 3b: persist matchedSignals in validation metadata
// 3c: include fallbackPath and reasons[] in run report payload from job-execution.service.ts
```

- [ ] **Step 4: Run full suite**

Run: `npm test`
Expected: PASS all tests.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/shell/host-resolution.service.test.ts tests/unit/shell/active-host-detector.test.ts tests/unit/shell/interview-host-bridge.test.ts tests/integration/shell/cli-run-host-native.test.ts tests/integration/software-squad.test.ts tests/integration/instagram-squad.test.ts orchestrator/shell/services/host-resolution.service.ts orchestrator/shell/services/job-execution.service.ts
git commit -m "test(shell): add resolver and runtime provenance coverage"
```

### Task 12: Update docs and migration notes

**Files:**
- Modify: `README.md`
- Modify: `docs/squads/how-to-execute.md`
- Modify: `docs/development/adding-hosts.md`
- Create: `docs/development/host-detection-and-resolution.md`
- Create: `tests/unit/docs/host-native-docs.test.ts`

- [ ] **Step 1: Write failing doc-check test or checklist assertion**

```ts
expect(readme).toContain('squadfoundry init')
expect(readme).toContain('host-native')
```

- [ ] **Step 2: Run check to verify failure**

Run: `npx vitest run tests/unit/docs/host-native-docs.test.ts`
Expected: FAIL with missing host-native CLI documentation assertions before docs updates.

- [ ] **Step 3: Update docs with CLI-first and host-native behavior**

```md
Document: detection flow, assisted fallback, active model rule, and override flags.
```

- [ ] **Step 4: Re-run docs check and full tests**

Run: `npx vitest run tests/unit/docs/host-native-docs.test.ts && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/squads/how-to-execute.md docs/development/adding-hosts.md docs/development/host-detection-and-resolution.md tests/unit/docs/host-native-docs.test.ts
git commit -m "docs: document host-native cli flow and adapter extension contract"
```

## Verification Gate (Before Merge)

- [ ] Run: `npm test` and confirm all unit/integration suites pass.
- [ ] Run: `npm run build` and confirm TypeScript compiles cleanly.
- [ ] Validate run report includes: `resolvedHost`, `confidence`, `reasons[]`, `activeModel` (or `host-default`), and `fallbackPath`.
- [ ] Validate no-silent-fallback rule: unresolved host must trigger assisted selection, not API-key provider auto-switch.
- [ ] Manual smoke test in workspace:
  - `squadfoundry init`
  - `squadfoundry create`
  - `squadfoundry edit <squad_id>`
  - `squadfoundry run software-development --objective "smoke" --input "smoke"`
  - `squadfoundry status <squad_id> <job_id>`

## Notes for Implementation Worker

- Keep core/runtime logic out of command handlers; use shell services.
- Preserve existing state machine and guardrail behaviors.
- Do not add automatic deploy/publish side effects.
- If a host does not expose active model, store `host-default` and continue.
- Keep changes DRY and avoid speculative abstractions beyond current Tier 1 hosts.
