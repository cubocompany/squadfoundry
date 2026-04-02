# Instagram Content Squad

**ID:** `instagram-content`
**Domain:** social-media
**Version:** 1.0.0

## Objective

Create, review, approve, and publish high-quality Instagram content from concept to post.

## Agents

| Agent | Role | Responsibility |
|-------|------|---------------|
| Strategy Agent | Content Strategist | Define content strategy and brief |
| Research Agent | Content Researcher | Hashtags, trends, audience insights |
| Copy Agent | Copywriter | Write Instagram caption + CTA |
| Creative Review Agent | Creative Director | Review for engagement and tone |
| Brand/Compliance Agent | Brand Guardian | Check brand guidelines and compliance |
| Approval Agent | Human Coordinator | Present to human for final sign-off |
| Publisher Agent | Content Publisher | Publish to Instagram (never without approval) |
| Analytics Agent | Performance Analyst | Track and report post performance |

## Workflow

```
Campaign Brief
  ↓
Strategy Agent → Strategy Brief
  ↓
Research Agent → Research Summary + Hashtags
  ↓
Copy Agent → Caption Draft
  ↓
Creative Review Agent → PASS or REVISE (loops to Copy Agent)
  ↓
Brand/Compliance Agent → PASS or FAIL (loops to Copy Agent)
  ↓
[HUMAN APPROVAL REQUIRED]
  ↓
Publisher Agent → Published Post
  ↓
Analytics Agent → Performance Report
```

## Key Policies

- **No auto-publish**: Content is never published without explicit human approval
- **Brand compliance gate**: All content must pass brand/compliance review
- **Caption limits**: Max 2200 characters, max 30 hashtags
- **Revision loop**: Copy Agent loops until creative + compliance review passes
- **Analytics follow-up**: Every published post is tracked and reported

## Guardrails

- `require_minimum_context` — Brand guidelines context recommended
- `require_approval_before_publish` — Blocks publishing without human approval

## Integrations

| Integration | Status |
|-------------|--------|
| Instagram Graph API | stub |
