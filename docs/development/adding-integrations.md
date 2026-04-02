# Adding New Integrations

All integrations implement one of the existing adapter interfaces. Each integration is isolated — the core and runtime never import integrations directly.

## Adapter Interfaces by Integration Type

| Integration type | Interface | Example |
|-----------------|-----------|---------|
| Git + PR platform | `IVCSAdapter` | GitHub, GitLab, Bitbucket |
| Social media publishing | `ISocialMediaAdapter` | Instagram, LinkedIn, Twitter/X |
| Deployment | `IDeployAdapter` | Vercel, AWS, Railway, Fly.io |
| Context/docs | `IContextAdapter` | Notion, Confluence, GitHub Wiki |
| Tools/APIs | `IToolAdapter` | Web search, database, custom APIs |

## Example: Adding a GitLab Adapter

```typescript
// orchestrator/adapters/vcs/gitlab.adapter.ts
import type { IVCSAdapter, ... } from './IVCSAdapter.js'

export class GitLabVCSAdapter implements IVCSAdapter {
  readonly id = 'gitlab'
  readonly name = 'GitLab'

  // Implement all IVCSAdapter methods
  // ...
}
```

## Example: Adding a LinkedIn Publisher

```typescript
// orchestrator/adapters/publishing/linkedin.adapter.ts
import type { ISocialMediaAdapter, ... } from './ISocialMediaAdapter.js'

export class LinkedInAdapter implements ISocialMediaAdapter {
  readonly id = 'linkedin'
  readonly platform = 'LinkedIn'

  // Implement all ISocialMediaAdapter methods
  // ...
}
```

## Registering Integrations in a Squad

In `config/squad.json`:

```json
{
  "allowedIntegrations": [
    {
      "id": "gitlab",
      "type": "vcs",
      "name": "GitLab",
      "required": true,
      "status": "real"
    }
  ]
}
```

## Making Stubs Real

All stubs follow this pattern:
1. They log `[STUB]` messages
2. They return mock data
3. They have `TODO:` comments marking where real API calls go

To activate a stub:
1. Set the required environment variables
2. Install the SDK (`npm install @anthropic-ai/sdk`, etc.)
3. Replace the stub implementation with real API calls
4. Update the adapter's `status` field from `'stub'` to `'real'`

## Safety

Always ensure:
- Publishing adapters check for human approval before acting
- Deploy adapters check for human confirmation before any deploy
- VCS adapters never force-push to protected branches

These checks belong in the runtime guardrail layer — the adapter implements the API call only.
