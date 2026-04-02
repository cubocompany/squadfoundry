# Workflow: [Workflow Name]

[Brief description of the workflow pattern]

## Steps

### 1. [Step Name] (`step-id`)
- **Agent:** [Agent Name]
- **Input:** [what comes in]
- **Output:** [what goes out]
- **Approval:** [Required / None]
- **Guardrail:** [if any]
- **Loop:** [Yes/No — under what condition]
- **Next:** [next step or _(end)_]

### 2. [Step Name] (`step-id`)
[repeat for each step]

## Transition Diagram

```
[Draw ASCII flow here]
```

## Loops

| Loop | Trigger | Return Point |
|------|---------|-------------|
| [Loop name] | [Condition] | [Step name] |

## Approval Gates

| Gate | Step | Who Approves |
|------|------|-------------|
| [Gate name] | [Step] | Human |
