# Adding New Agents

Agents are defined in `config/squad.json` — no code changes required.

## Step 1: Define the Agent

Add to `agents[]` in `squads/<squad_id>/config/squad.json`:

```json
{
  "id": "my-new-agent",
  "name": "My New Agent",
  "role": "Specific Role",
  "domain": "software-development",
  "objective": "What this agent achieves",
  "instructions": "You are the My New Agent. [Full instructions here...]",
  "inputs": [
    { "name": "input_name", "description": "What comes in", "required": true }
  ],
  "outputs": [
    { "name": "output_name", "description": "What goes out", "required": true, "format": "markdown" }
  ],
  "allowedTools": ["filesystem", "git"],
  "constraints": ["Do not do X", "Always do Y"],
  "successCriteria": ["Output produced"],
  "failureCriteria": ["Cannot produce output"],
  "allowedStates": ["READY_FOR_EXECUTION", "RUNNING_STEP"],
  "blockingConditions": [],
  "handoffRules": [
    {
      "condition": "step_completed",
      "targetAgentId": "next-agent-id",
      "description": "Pass to next agent",
      "requiresApproval": false
    }
  ],
  "responseFormat": "markdown"
}
```

## Step 2: Add a Workflow Step

Add to `workflow.steps[]`:

```json
{
  "id": "step-my-new-agent",
  "name": "My New Step",
  "agentId": "my-new-agent",
  "description": "What this step does",
  "dependsOn": ["step-previous"],
  "guardrails": [],
  "requiresApprovalBefore": false,
  "requiresApprovalAfter": false,
  "requiredArtifacts": ["previous-output"],
  "producedArtifacts": ["my-output"],
  "nextStepId": "step-next"
}
```

## Step 3: Update the Previous Step

Point its `nextStepId` to your new step.

## Step 4: Document

Update `squads/<squad_id>/AGENTS.md` and `WORKFLOW.md`.

## Agent Instructions Best Practices

1. **Start with identity**: "You are the [Role]. [What you do]."
2. **Be explicit about inputs**: "Given [X] and [Y], ..."
3. **Specify outputs precisely**: "Produce [Z] as [format]."
4. **List constraints**: "Do NOT [X]. ALWAYS [Y]."
5. **Define handoff signal**: "When complete, signal: [condition]."
