# How to Create a Squad

Squads are created via the **Squad Builder** — an interview-driven system that generates all necessary files.

## Method 1: CLI Interview

```bash
npx squadfoundry create
```

The CLI will ask you a series of questions and generate the squad files.

For non-interactive environments, provide answers via file:

```bash
npx squadfoundry create --answers-file ./answers.json
```

Accepted `answers.json` formats:

- Object map keyed by question id (`q_objective`, `q_domain`, etc.)
- Array of `{ "questionId": "...", "answer": "..." }`

## Method 2: Programmatic API

```typescript
import { createSquadBuilder } from './orchestrator/builder/squad-builder.js'
import type { InterviewAnswer } from './orchestrator/core/types.js'

const builder = createSquadBuilder({
  contextRootPath: process.cwd(),
  outputDir: process.cwd(),
})

const answers: InterviewAnswer[] = [
  { questionId: 'q_objective', answer: 'Create and publish Instagram content' },
  { questionId: 'q_domain', answer: '3' },  // social-media
  { questionId: 'q_description', answer: 'End-to-end Instagram content pipeline' },
  { questionId: 'q_inputs', answer: 'Campaign brief or topic' },
  { questionId: 'q_outputs', answer: 'Published Instagram post with analytics' },
  { questionId: 'q_steps', answer: '1. Strategy, 2. Write, 3. Review, 4. Approve, 5. Publish' },
  { questionId: 'q_approvals', answer: 'Publishing requires human approval' },
  { questionId: 'q_human_in_loop', answer: 'Never auto-publish' },
  { questionId: 'q_squad_name', answer: 'instagram-content' },
]

const result = await builder.build(answers)
console.log('Generated files:', result.generatedFiles.map(f => f.path))
```

## Method 3: Manual Creation

Copy the template from `templates/SQUAD.md` and create:

```
squads/my-squad/
  SQUAD.md
  WORKFLOW.md
  AGENTS.md
  POLICIES.md
  config/
    squad.json
```

The `config/squad.json` is the source of truth. See `squads/examples/software-development/config/squad.json` for a complete example.

## Generated Files

| File | Purpose |
|------|---------|
| `SQUAD.md` | Human-readable squad overview |
| `WORKFLOW.md` | Step-by-step workflow documentation |
| `AGENTS.md` | Agent descriptions and responsibilities |
| `POLICIES.md` | Guardrails and prohibited actions |
| `config/squad.json` | Machine-readable squad definition (source of truth) |

## Interview Questions

The builder asks about:
- **Objective** — What does the squad achieve?
- **Domain** — What type of work (software, social media, docs, etc.)?
- **I/O** — What goes in? What comes out?
- **Steps** — What are the workflow steps?
- **Approvals** — What requires human sign-off?
- **Tools** — What integrations are needed?
- **Policies** — What is prohibited?
- **Risks** — What could go wrong?

## Customizing After Generation

Edit `config/squad.json` to:
- Add/remove agents
- Add/remove workflow steps
- Change guardrail severity
- Add approval requirements
- Update agent instructions
