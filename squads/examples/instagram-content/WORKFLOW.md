# Workflow: Instagram Content Pipeline

End-to-end content workflow with review loops and a mandatory human approval gate before publishing.

## Steps

### 1. Content Strategy (`step-strategy`)
- **Agent:** Strategy Agent
- **Input:** Campaign brief or topic request
- **Output:** strategy_brief.md
- **Approval:** None

### 2. Research (`step-research`)
- **Agent:** Research Agent
- **Input:** Strategy brief
- **Output:** research_summary.md (hashtags, trends, insights)
- **Approval:** None

### 3. Copywriting (`step-copy`)
- **Agent:** Copy Agent
- **Input:** Strategy brief, research summary
- **Output:** caption_draft.md
- **Approval:** None
- **Loop:** Returns here from Creative Review (REVISE) or Compliance (FAIL)

### 4. Creative Review (`step-creative-review`)
- **Agent:** Creative Review Agent
- **Input:** Caption draft, strategy brief
- **Output:** creative_review.md (PASS or REVISE)
- **Approval:** None
- **Loop:** REVISE → Copy Agent

### 5. Brand & Compliance Review (`step-brand`)
- **Agent:** Brand/Compliance Agent
- **Input:** Caption draft, creative review
- **Output:** compliance_review.md (PASS or FAIL)
- **Approval:** None
- **Loop:** FAIL → Copy Agent

### 6. Human Approval (`step-approval`)
- **Agent:** Approval Agent
- **Input:** Caption draft, compliance review
- **Output:** approval_decision.json
- **Approval:** **REQUIRED** — human must explicitly approve
- **Guardrail:** `require_approval_before_publish`

### 7. Publishing (`step-publish`)
- **Agent:** Publisher Agent
- **Input:** Caption draft, approval_decision
- **Output:** published_post.json
- **Approval:** **REQUIRED** — publish gate blocks without approval record
- **Guardrail:** `require_approval_before_publish`

### 8. Analytics (`step-analytics`)
- **Agent:** Analytics Agent
- **Input:** Published post metadata
- **Output:** analytics_report.md
- **Approval:** None
