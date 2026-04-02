# Software Development Squad

**ID:** `software-development`
**Domain:** software-development
**Version:** 1.0.0

## Objective

Implement software features from requirements through to deployed code with full review, testing, and traceability.

## Agents

| Agent | Role | Responsibility |
|-------|------|---------------|
| Product Agent | Product Manager | PRD + SDD generation |
| Code Agent | Engineer | Feature implementation |
| Reviewer Agent | Code Reviewer | Structured code review with PASS/FAIL |
| Test Agent | QA Engineer | Test writing and execution |
| Commit Agent | VCS Manager | Branch creation and committing |
| PR Agent | PR Manager | Pull request creation and documentation |
| Deploy Agent | Deployment Manager | Deploy to staging/production (requires human approval) |

## Workflow

```
Task Input
  ↓
Product Agent → PRD + SDD
  ↓
Code Agent → Implementation
  ↓
Reviewer Agent → Review Findings (loops back to Code Agent if FAIL)
  ↓
Test Agent → Test Results (loops back to Code Agent if tests fail)
  ↓
Commit Agent → Branch + Commit
  ↓
PR Agent → Pull Request
  ↓
[HUMAN APPROVAL REQUIRED]
  ↓
Deploy Agent → Deployment
```

## Key Policies

- **No auto-merge**: PRs are never merged automatically
- **No auto-deploy to production**: Always requires human confirmation
- **No direct push to main/master**: Always work on feature branches
- **Review loop**: Code Agent ↔ Reviewer Agent until PASS verdict
- **Test gate**: Tests must pass before PR is created

## Guardrails

- `require_minimum_context` — PROJECT.md should be present
- `require_artifact_before_step` — Code cannot run without PRD
- `require_pr_criteria` — PR requires review + test artifacts
- `require_human_before_deploy` — Deploy always needs human approval

## Integrations

| Integration | Status |
|-------------|--------|
| GitHub (VCS, PR) | stub |
| Vercel (Deploy) | stub |
