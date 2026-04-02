# Policies — Software Development Squad

## Guardrails

### 1. Require Minimum Context (`grail-min-context`)
- **Severity:** warn
- **Rule:** `require_minimum_context`
- **Description:** PROJECT.md should be present to inform coding conventions

### 2. Require PRD Before Code (`grail-artifact-prd`)
- **Severity:** block
- **Rule:** `require_artifact_before_step`
- **Description:** Code Agent cannot run without a PRD artifact

### 3. Require Implementation Before Review (`grail-artifact-impl`)
- **Severity:** block
- **Rule:** `require_artifact_before_step`
- **Description:** Reviewer Agent cannot run without implementation

### 4. PR Criteria (`grail-pr-criteria`)
- **Severity:** block
- **Rule:** `require_pr_criteria`
- **Description:** PR cannot be created without review findings and test results

### 5. Human Before Deploy (`grail-human-deploy`)
- **Severity:** block
- **Rule:** `require_human_before_deploy`
- **Description:** All deployments require explicit human approval — no exceptions

## Prohibited Actions

- Auto-merge pull requests
- Deploy to production without human confirmation
- Push directly to `main` or `master`
- Approve your own pull requests
- Force-push to any branch
- Skip code review
- Skip tests

## Required Approvals

| Action | Requirement |
|--------|-------------|
| deploy | Human must confirm environment and branch |
