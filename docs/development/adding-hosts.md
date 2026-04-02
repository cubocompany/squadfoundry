# Adding a New Host Runtime Adapter

A "host" is the execution environment that runs the LLM.

## Step 1: Implement `IHostAdapter`

Create `orchestrator/adapters/host/myhost.adapter.ts`:

```typescript
import type {
  IHostAdapter,
  PromptOptions,
  HostCapabilities,
  HostDetectionContext,
  HostDetectionResult,
  InterviewTurnInput,
  InterviewTurnState,
  InterviewTurnResult,
} from './IHostAdapter.js'
import type { AgentDefinition, AgentResponse, JobDefinition, WorkflowStep } from '../../core/types.js'

export class MyHostAdapter implements IHostAdapter {
  readonly id = 'myhost'
  readonly name = 'My Host'

  detect(_context: HostDetectionContext): HostDetectionResult {
    return { isDetected: false, confidence: 'low', reasons: [] }
  }

  async initialize(): Promise<void> {
    // Connect, validate credentials, etc.
  }

  async runInterviewTurn(input: InterviewTurnInput, _state: InterviewTurnState): Promise<InterviewTurnResult> {
    return { content: input.prompt, status: 'continue' }
  }

  async getActiveModel(): Promise<string | null> {
    return 'my-model'
  }

  async sendPrompt(
    prompt: string,
    agent: AgentDefinition,
    job: JobDefinition,
    step: WorkflowStep,
    options?: PromptOptions,
  ): Promise<AgentResponse> {
    // Call your LLM/host here
    const content = await callMyLLM(prompt, options)

    return {
      agentId: agent.id,
      stepId: step.id,
      jobId: job.id,
      content,
      artifacts: [],    // parse from content if needed
      status: 'success',
    }
  }

  getCapabilities(): HostCapabilities {
    return {
      supportsStreaming: false,
      supportsToolUse: false,
      supportsVision: false,
      maxContextTokens: 32000,
      supportedModels: ['my-model'],
    }
  }

  async healthCheck(): Promise<boolean> {
    // Verify connectivity
    return true
  }
}
```

## Step 2: Parse Agent Response

The key contract is the `AgentResponse` type. Your adapter must parse the LLM output and return:
- `content` — the text response
- `artifacts` — any `PendingArtifact[]` the agent wants to persist
- `handoffSignal` — optional, if the agent signals handoff explicitly
- `status` — `'success' | 'failure' | 'needs_input' | 'loop_back'`

## Step 3: Use the Adapter

```typescript
import { MyHostAdapter } from './orchestrator/adapters/host/myhost.adapter.js'
import { createSquadRuntime } from './orchestrator/runtime/squad-runtime.js'

const runtime = createSquadRuntime({
  hostAdapter: new MyHostAdapter(),
  artifactsDir: 'artifacts',
})
```

## Notes

- The `SquadRuntime` never imports a specific host adapter — it only uses `IHostAdapter`
- You can have different agents use different host adapters by extending `SquadRuntime`
- For IDE-native agents (Claude Code, Cursor, etc.), the host adapter can simply relay to the IDE's built-in agent API
- `sendPrompt` receives `options.metadata.allowedAgentIds` from runtime; use this to validate explicit handoff targets when parsing response text.
