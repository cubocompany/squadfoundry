# Agent Conventions — Squad Foundry

This file describes how agents are defined, how they behave, and what conventions apply across all squads on this platform.

## Agent Identity

Every agent has a unique `id` within its squad. IDs are kebab-case slugs (e.g., `code-agent`, `publisher-agent`).

## Agent Instructions Pattern

Agent instructions follow this structure:
1. **Identity statement** — "You are the [Role]. [Short description]."
2. **Core task** — What to do given the inputs
3. **Output contract** — What to produce and in what format
4. **Constraints** — What NOT to do
5. **Handoff signal** — When and how to signal completion

## Handoff Protocol

When an agent completes its step, it signals handoff via `HandoffSignal` in the `AgentResponse`:
```json
{
  "handoffSignal": {
    "targetAgentId": "next-agent-id",
    "condition": "step_completed_successfully",
    "payload": { "summary": "..." }
  }
}
```

If no handoff signal is present, the runtime auto-generates one based on the workflow's `nextStepId`.

## Artifact Protocol

Agents produce artifacts via `PendingArtifact[]` in the `AgentResponse`:
```json
{
  "artifacts": [
    {
      "name": "prd",
      "content": "# PRD\n...",
      "format": "markdown"
    }
  ]
}
```

The ArtifactStore persists these and creates `ArtifactRef` entries in the job.

## State Constraints

Each agent declares `allowedStates[]`. The guardrail `block_invalid_state_transition` enforces this — an agent cannot act outside its allowed states.

## Approval Protocol

If an agent needs human approval, it sets `approvalNeeded: true` and `approvalReason: "..."` in the response. The ApprovalGate handles this — execution pauses until a human resolves it.

## Prohibited Behaviors (All Agents)

- Never execute real side effects (deploy, publish, merge) without an explicit approval record
- Never fabricate metrics, test results, or compliance outcomes
- Never skip required artifacts
- Never act in disallowed states

## Model Preferences

Agents may specify `modelPreference` to request a specific model or provider. If absent, the squad runtime uses the host adapter's default.

## Adding a New Agent

1. Define the agent in `squads/<squad_id>/config/squad.json` under `agents[]`
2. Add a workflow step in `workflow.steps[]` that references the agent
3. Document the agent in `squads/<squad_id>/AGENTS.md`
4. Update `squads/<squad_id>/WORKFLOW.md` with the new step

See `docs/development/adding-agents.md` for full guide.
