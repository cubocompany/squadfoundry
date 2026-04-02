# Policies — Instagram Content Squad

## Guardrails

### 1. Require Minimum Context (`grail-min-context`)
- **Severity:** warn
- **Rule:** `require_minimum_context`
- **Description:** Brand guidelines context recommended (brand/** files)

### 2. Require Approval Before Publish (`grail-approval-publish`)
- **Severity:** block
- **Rule:** `require_approval_before_publish`
- **Description:** No content is ever published without explicit human approval

## Prohibited Actions

- Auto-publish without human approval
- Post content that fails brand compliance check
- Use more than 30 hashtags
- Post content rejected by Creative Review
- Delete published posts automatically
- Fabricate engagement metrics or statistics
- Use competitor brand names in captions without approval

## Required Approvals

| Action | Requirement |
|--------|-------------|
| publish | Human must see full caption and explicitly approve before any Instagram post is created |

## Brand Guidelines

All agents should read from `brand/**` context files when available, including:
- `brand/voice-guidelines.md`
- `brand/prohibited-words.md`
- `brand/hashtag-policy.md`
- `brand/visual-guidelines.md`

## Caption Rules

- Maximum 2,200 characters
- Maximum 30 hashtags
- Must include a clear call-to-action
- Must match brand tone of voice
- No promotional claims without compliance review
