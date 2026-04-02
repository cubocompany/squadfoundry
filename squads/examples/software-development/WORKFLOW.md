# Workflow: Software Development Pipeline

Sequential pipeline with review and test loops.

## Steps

### 1. Requirements & Design (`step-product`)
- **Agent:** Product Agent
- **Input:** Task description / feature request
- **Output:** PRD.md, SDD.md
- **Approval:** None required

### 2. Implementation (`step-code`)
- **Agent:** Code Agent
- **Input:** PRD, SDD
- **Output:** Implementation files
- **Approval:** None required
- **Requires:** PRD must be present (guardrail)

### 3. Code Review (`step-review`)
- **Agent:** Reviewer Agent
- **Input:** Implementation, PRD
- **Output:** Review Findings (PASS or FAIL with details)
- **Approval:** None required
- **Loop:** If FAIL → returns to Code Agent

### 4. Testing (`step-test`)
- **Agent:** Test Agent
- **Input:** Implementation, Review Findings
- **Output:** Test Results
- **Approval:** None required
- **Loop:** If tests fail → returns to Code Agent

### 5. Commit (`step-commit`)
- **Agent:** Commit Agent
- **Input:** Implementation, Test Results
- **Output:** Branch name + Commit SHA
- **Approval:** None required

### 6. Pull Request (`step-pr`)
- **Agent:** PR Agent
- **Input:** Commit Info, Review Findings, Test Results
- **Output:** PR URL and metadata
- **Approval:** None required before; human should review the PR
- **Requires:** Review artifacts + test artifacts (guardrail)

### 7. Deploy (`step-deploy`)
- **Agent:** Deploy Agent
- **Input:** PR Info
- **Output:** Deploy result and URL
- **Approval:** **REQUIRED BEFORE execution**
- **Guardrail:** `require_human_before_deploy` — always blocks without explicit confirmation

## Transition Diagram

```
INTAKE_PENDING
  → CONTEXT_LOADING
  → JOB_CREATED
  → READY_FOR_EXECUTION
  → RUNNING_STEP (Product Agent)
  → READY_FOR_EXECUTION
  → RUNNING_STEP (Code Agent)
  → READY_FOR_EXECUTION
  → RUNNING_STEP (Reviewer Agent)
    ↳ if FAIL → back to Code Agent
  → READY_FOR_EXECUTION
  → RUNNING_STEP (Test Agent)
    ↳ if fail → back to Code Agent
  → READY_FOR_EXECUTION
  → RUNNING_STEP (Commit Agent)
  → READY_FOR_EXECUTION
  → RUNNING_STEP (PR Agent)
  → WAITING_APPROVAL (human confirms deploy)
  → READY_FOR_EXECUTION
  → RUNNING_STEP (Deploy Agent)
  → COMPLETED
```
