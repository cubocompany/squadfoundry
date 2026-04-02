/**
 * Squad Foundry — Main Package Entry Point
 *
 * Import from this file when using Squad Foundry as an npm package.
 *
 * @example
 * // In Claude Code, OpenCode, Cursor, Codex, or any AI-native IDE:
 * import { IDEHostAdapter, createSquadRuntime, createSquadBuilder } from 'squadfoundry'
 *
 * const runtime = createSquadRuntime({
 *   hostAdapter: new IDEHostAdapter(async (prompt) => {
 *     // The IDE handles the model call — YOU provide this callback
 *     return yourIDE.complete(prompt)
 *   }),
 * })
 */

// ─── Core Types ───────────────────────────────────────────────────────────────
export type {
  // Identifiers
  SquadId,
  AgentId,
  JobId,
  StepId,
  GuardrailId,
  ArtifactId,
  HandoffId,

  // Domains
  SquadDomain,

  // State machine
  BaseJobStatus,
  JobStatus,

  // Agent
  AgentDefinition,
  AgentIO,
  HandoffRule,
  ModelPreference,

  // Workflow
  WorkflowDefinition,
  WorkflowStep,

  // Policy & Guardrails
  GuardrailSeverity,
  GuardrailRule,
  BuiltinGuardrailKey,
  PolicyDefinition,
  ApprovalRequirement,

  // Squad
  SquadDefinition,
  ExpectedArtifact,
  IntegrationRef,
  SquadMetadata,

  // Job
  JobDefinition,
  LoadedContext,
  FileContent,
  ArtifactRef,
  ApprovalRecord,
  HistoryEntry,

  // Handoff
  HandoffEvent,
  HandoffPayload,

  // Context
  ContextDiscoveryResult,
  DiscoveredFile,
  ContextFileCategory,

  // Interview / Builder
  InterviewQuestion,
  InterviewCategory,
  InterviewAnswer,
  InterviewSession,
  SquadBuildResult,
  GeneratedFile,

  // Agent Response
  AgentResponse,
  PendingArtifact,
  HandoffSignal,

  // Guardrail Evaluation
  GuardrailEvaluationContext,
  GuardrailResult,
} from './core/types.js'

// ─── Core: State Machine ─────────────────────────────────────────────────────
export {
  StateMachine,
  createStateMachine,
} from './core/state-machine.js'
export type {
  TransitionEvent,
  GuardFn,
  GuardResult,
  TransitionDef,
  TransitionResult,
} from './core/state-machine.js'

// ─── Core: Guardrails ────────────────────────────────────────────────────────
export {
  GuardrailEngine,
  createGuardrailEngine,
} from './core/guardrails.js'
export type { GuardrailEvaluatorFn } from './core/guardrails.js'

// ─── Adapter Interfaces ──────────────────────────────────────────────────────
export type {
  IHostAdapter,
  PromptOptions,
  HostCapabilities,
  HostDetectionContext,
  HostDetectionResult,
  InterviewTurnInput,
  InterviewTurnState,
  InterviewTurnResult,
} from './adapters/host/IHostAdapter.js'
export type { IModelAdapter, ModelRequest, ModelResponse, ModelInfo, MessageTurn, ToolDefinition } from './adapters/model/IModelAdapter.js'
export type { IToolAdapter, ToolInput, ToolOutput, AvailableTool, ToolCategory } from './adapters/tools/IToolAdapter.js'
export type { IVCSAdapter, BranchOptions, CommitOptions, PullRequestOptions, PullRequestInfo, CommitInfo, BranchInfo, VCSCapabilities } from './adapters/vcs/IVCSAdapter.js'
export type { ISocialMediaAdapter, MediaType, MediaAsset, PostDraft, PublishedPost, PostAnalytics, AccountInfo, PublishingCapabilities } from './adapters/publishing/ISocialMediaAdapter.js'
export type { IDeployAdapter, DeployRequest, DeployResult, DeploymentInfo, DeployCapabilities, DeployEnvironment } from './adapters/deploy/IDeployAdapter.js'
export type { IContextAdapter, ContextLoadOptions, ContextSummary } from './adapters/context/IContextAdapter.js'

// ─── Host Adapters ───────────────────────────────────────────────────────────
/** Primary adapter for IDE/agent environments (Claude Code, OpenCode, Cursor, Codex, Zed, etc.) */
export { IDEHostAdapter } from './adapters/host/ide.adapter.js'
export type { ModelInvoker, IDEHostAdapterOptions } from './adapters/host/ide.adapter.js'

/** Native bridge adapter for Claude Code CLI environments. */
export { ClaudeCodeHostAdapter } from './adapters/host/claude-code.adapter.js'
export type { ClaudeCodeHostAdapterOptions } from './adapters/host/claude-code.adapter.js'

/** Native bridge adapter for OpenCode CLI environments. */
export { OpenCodeHostAdapter } from './adapters/host/opencode.adapter.js'
export type { OpenCodeHostAdapterOptions } from './adapters/host/opencode.adapter.js'

/**
 * Adapter para o Google Antigravity IDE.
 * Usa a porta 8045 exposta pelo Antigravity (API OpenAI-compatible).
 * Não requer API key — o modelo já está rodando na IDE.
 */
export { AntigravityHostAdapter } from './adapters/host/antigravity.adapter.js'
export type { AntigravityAdapterOptions } from './adapters/host/antigravity.adapter.js'

/** Direct API adapter for Anthropic Claude (requires ANTHROPIC_API_KEY) */
export { AnthropicHostAdapter } from './adapters/host/anthropic.adapter.js'

/** Direct API adapter for OpenAI (requires OPENAI_API_KEY) */
export { OpenAIHostAdapter } from './adapters/host/openai.adapter.js'

/** Adapter for local LLM (Ollama, LM Studio, llama.cpp — no API key needed) */
export { LocalHostAdapter } from './adapters/host/local.adapter.js'

// ─── VCS Adapters ────────────────────────────────────────────────────────────
export { GitHubVCSAdapter } from './adapters/vcs/github.adapter.js'

// ─── Publishing Adapters ─────────────────────────────────────────────────────
export { InstagramAdapter } from './adapters/publishing/instagram.adapter.js'

// ─── Deploy Adapters ─────────────────────────────────────────────────────────
export { VercelDeployAdapter } from './adapters/deploy/vercel.adapter.js'

// ─── Context Adapter ─────────────────────────────────────────────────────────
export { FilesystemContextAdapter } from './adapters/context/filesystem.context-adapter.js'

// ─── Context Layer ───────────────────────────────────────────────────────────
export { ContextLoader } from './context/context-loader.js'
export type { ContextLoaderOptions } from './context/context-loader.js'
export { ContextIndex } from './context/context-index.js'
export type { IndexedFile } from './context/context-index.js'

// ─── Artifact Store ──────────────────────────────────────────────────────────
export { ArtifactStore, createArtifactStore } from './artifacts/artifact-store.js'

// ─── Squad Runtime ───────────────────────────────────────────────────────────
export { SquadRuntime, createSquadRuntime } from './runtime/squad-runtime.js'
export type { RuntimeConfig, StepExecutionResult } from './runtime/squad-runtime.js'

export { JobManager, createJobManager } from './runtime/job-manager.js'
export type { CreateJobOptions } from './runtime/job-manager.js'

export { AgentDispatcher, createAgentDispatcher } from './runtime/agent-dispatcher.js'
export type { DispatchPlan } from './runtime/agent-dispatcher.js'

export { HandoffManager, createHandoffManager } from './runtime/handoff-manager.js'

export { ApprovalGate, createApprovalGate } from './runtime/approval-gate.js'
export type { ApprovalRequest } from './runtime/approval-gate.js'

// ─── Squad Builder ───────────────────────────────────────────────────────────
export { SquadBuilder, createSquadBuilder } from './builder/squad-builder.js'
export type { SquadBuilderOptions } from './builder/squad-builder.js'

export { DomainClassifier, createDomainClassifier } from './builder/domain-classifier.js'
export type { ClassificationResult, WorkflowPattern } from './builder/domain-classifier.js'

export { SquadGenerator, createSquadGenerator } from './builder/squad-generator.js'

export {
  INTERVIEW_QUESTIONS,
  getRequiredQuestions,
  getQuestionById,
  getQuestionsByCategory,
} from './builder/interview-questions.js'
