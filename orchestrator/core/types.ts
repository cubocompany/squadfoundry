/**
 * Squad Foundry — Core Type Definitions
 *
 * These types form the portable, host-agnostic contract for the entire platform.
 * No external dependencies. No IDE-specific concepts. No vendor lock-in.
 *
 * All adapters, runtime components, and builders operate against these types.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Primitive identifiers
// ─────────────────────────────────────────────────────────────────────────────

export type SquadId = string
export type AgentId = string
export type JobId = string
export type StepId = string
export type GuardrailId = string
export type ArtifactId = string
export type HandoffId = string

// ─────────────────────────────────────────────────────────────────────────────
// Domains
// ─────────────────────────────────────────────────────────────────────────────

export type SquadDomain =
  | 'software-development'
  | 'content-marketing'
  | 'social-media'
  | 'documentation'
  | 'research'
  | 'operations'
  | 'hr'
  | 'sales'
  | 'custom'

// ─────────────────────────────────────────────────────────────────────────────
// Job State Machine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base states available to every job regardless of squad domain.
 * Squads can define additional custom states in their WorkflowDefinition.
 */
export type BaseJobStatus =
  | 'INTAKE_PENDING'       // Job received, context not yet loaded
  | 'CONTEXT_LOADING'      // Reading PROJECT.md, TASKS.md, docs, etc.
  | 'SQUAD_DESIGNING'      // Builder is generating squad definition
  | 'SQUAD_READY'          // Squad definition approved and persisted
  | 'JOB_CREATED'          // Job entity created with unique ID
  | 'WAITING_USER_INPUT'   // Paused — waiting for human clarification
  | 'READY_FOR_EXECUTION'  // All preconditions met, can start running
  | 'RUNNING_STEP'         // A step/agent is currently executing
  | 'BLOCKED'              // Guardrail blocked progression
  | 'WAITING_APPROVAL'     // Human approval required before next step
  | 'FAILED'               // Terminal failure state
  | 'COMPLETED'            // All steps done, artifacts persisted

export type JobStatus = BaseJobStatus | (string & Record<never, never>)

// ─────────────────────────────────────────────────────────────────────────────
// Agent Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A portable definition of an agent. Not tied to any host, model, or tool.
 * The same AgentDefinition can run in Claude Code, OpenCode, Cursor, etc.
 */
export interface AgentDefinition {
  /** Unique identifier within the squad */
  id: AgentId
  /** Human-readable name */
  name: string
  /** Functional role in the squad */
  role: string
  /** Domain this agent operates in */
  domain: SquadDomain
  /** What this agent is responsible for */
  objective: string
  /** Base system prompt / instructions for this agent */
  instructions: string
  /** Expected input format/description */
  inputs: AgentIO[]
  /** Expected output format/description */
  outputs: AgentIO[]
  /** Tool IDs this agent is allowed to invoke */
  allowedTools: string[]
  /** Hard constraints / prohibitions */
  constraints: string[]
  /** What constitutes success for this agent's turn */
  successCriteria: string[]
  /** What constitutes failure for this agent's turn */
  failureCriteria: string[]
  /** Which job states this agent can run in */
  allowedStates: JobStatus[]
  /** Conditions that block this agent from running */
  blockingConditions: string[]
  /** Handoff rules: which agent comes next and under which conditions */
  handoffRules: HandoffRule[]
  /** Expected response format */
  responseFormat: 'markdown' | 'json' | 'plain' | 'structured'
  /** Model preference for this agent (optional — uses squad default if absent) */
  modelPreference?: ModelPreference
}

export interface AgentIO {
  name: string
  description: string
  required: boolean
  format?: string
}

export interface HandoffRule {
  condition: string
  targetAgentId: AgentId
  description: string
  requiresApproval?: boolean
}

export interface ModelPreference {
  provider?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Definition
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  /** Ordered list of steps */
  steps: WorkflowStep[]
  /** Custom states this squad adds beyond the base states */
  customStates?: string[]
  /** Default entry point step */
  entryStepId: StepId
}

export interface WorkflowStep {
  id: StepId
  name: string
  agentId: AgentId
  description: string
  /** Steps that must be completed before this one */
  dependsOn: StepId[]
  /** Guardrail IDs that apply to this step */
  guardrails: GuardrailId[]
  /** Whether a human must approve before entering this step */
  requiresApprovalBefore: boolean
  /** Whether a human must approve the output before moving forward */
  requiresApprovalAfter: boolean
  /** Artifacts that must exist before this step can run */
  requiredArtifacts: string[]
  /** Artifacts this step is expected to produce */
  producedArtifacts: string[]
  /** Precondition expression (evaluated against job context) */
  precondition?: string
  /** Postcondition expression (evaluated against step output) */
  postcondition?: string
  /** If true, step can loop back to itself or a previous step */
  allowsLoop?: boolean
  /** Next step under normal conditions */
  nextStepId?: StepId
  /** Next step if the agent signals failure */
  failureStepId?: StepId
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy / Guardrail
// ─────────────────────────────────────────────────────────────────────────────

export type GuardrailSeverity = 'warn' | 'block'

export interface GuardrailRule {
  id: GuardrailId
  name: string
  description: string
  severity: GuardrailSeverity
  /** The JS function body as string OR a pre-defined rule key */
  ruleKey: BuiltinGuardrailKey | string
  /** Parameters passed to the rule evaluator */
  params?: Record<string, unknown>
}

export type BuiltinGuardrailKey =
  | 'require_minimum_context'
  | 'require_artifact_before_step'
  | 'require_approval_before_publish'
  | 'require_human_before_deploy'
  | 'block_invalid_state_transition'
  | 'require_pr_criteria'
  | 'no_agent_outside_allowed_states'
  | 'require_artifact_produced'

export interface PolicyDefinition {
  id: string
  name: string
  description: string
  guardrails: GuardrailRule[]
  /** Actions that are globally prohibited for this squad */
  prohibitedActions: string[]
  /** Required approvals for specific actions */
  requiredApprovals: ApprovalRequirement[]
}

export interface ApprovalRequirement {
  action: string
  description: string
  approverRole?: string
  timeout?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Squad Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A Squad is the core, portable, reusable entity.
 * This JSON/object structure can be serialized and loaded by any host.
 */
export interface SquadDefinition {
  id: SquadId
  name: string
  domain: SquadDomain
  objective: string
  description: string
  /** Free-form context about the squad's operational environment */
  context: string
  agents: AgentDefinition[]
  workflow: WorkflowDefinition
  policy: PolicyDefinition
  /** Artifacts expected at squad completion */
  expectedArtifacts: ExpectedArtifact[]
  /** External tools and integrations this squad may use */
  allowedIntegrations: IntegrationRef[]
  /** Template IDs used by this squad */
  templates: string[]
  /** Criteria for declaring the squad job successful */
  successCriteria: string[]
  /** Criteria for declaring the squad job failed */
  failureCriteria: string[]
  /** Metadata */
  metadata: SquadMetadata
}

export interface ExpectedArtifact {
  id: string
  name: string
  description: string
  path: string
  required: boolean
  format: 'json' | 'markdown' | 'text' | 'binary'
}

export interface IntegrationRef {
  id: string
  type: 'vcs' | 'cicd' | 'social-media' | 'deploy' | 'analytics' | 'docs' | 'mcp' | 'custom'
  name: string
  /** Whether this integration is required or optional */
  required: boolean
  /** Adapter stub status */
  status: 'real' | 'stub' | 'mock'
}

export interface SquadMetadata {
  version: string
  createdAt: string
  updatedAt: string
  author?: string
  tags: string[]
  hostCompatibility: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Job Definition
// ─────────────────────────────────────────────────────────────────────────────

export interface JobDefinition {
  id: JobId
  squadId: SquadId
  status: JobStatus
  objective: string
  /** Human-provided initial context / request */
  initialInput: string
  /** Loaded context from files (PROJECT.md, TASKS.md, etc.) */
  loadedContext: LoadedContext
  artifacts: ArtifactRef[]
  approvals: ApprovalRecord[]
  currentStepId: StepId | null
  currentAgentId: AgentId | null
  history: HistoryEntry[]
  startedAt: string
  updatedAt: string
  completedAt?: string
  failureReason?: string
}

export interface LoadedContext {
  projectMd?: string
  tasksMd?: string
  agentsMd?: string
  readmeMd?: string
  docs: FileContent[]
  specs: FileContent[]
  playbooks: FileContent[]
  policies: FileContent[]
  templates: FileContent[]
  custom: FileContent[]
}

export interface FileContent {
  path: string
  content: string
  loadedAt: string
}

export interface ArtifactRef {
  id: ArtifactId
  name: string
  path: string
  producedByAgentId: AgentId
  producedAtStepId: StepId
  format: 'json' | 'markdown' | 'text' | 'binary'
  createdAt: string
}

export interface ApprovalRecord {
  id: string
  stepId: StepId
  requiredFor: string
  status: 'pending' | 'approved' | 'rejected'
  requestedAt: string
  resolvedAt?: string
  resolvedBy?: string
  notes?: string
}

export interface HistoryEntry {
  timestamp: string
  type: 'state_transition' | 'agent_run' | 'handoff' | 'approval' | 'blocked' | 'error' | 'info'
  fromStatus?: JobStatus
  toStatus?: JobStatus
  agentId?: AgentId
  stepId?: StepId
  message: string
  data?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Handoff Event
// ─────────────────────────────────────────────────────────────────────────────

export interface HandoffEvent {
  id: HandoffId
  jobId: JobId
  fromAgentId: AgentId
  toAgentId: AgentId
  fromStepId: StepId
  toStepId: StepId
  condition: string
  payload: HandoffPayload
  timestamp: string
  requiresApproval: boolean
  approved?: boolean
}

export interface HandoffPayload {
  summary: string
  artifacts: ArtifactRef[]
  notes?: string
  data?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Discovery
// ─────────────────────────────────────────────────────────────────────────────

export interface ContextDiscoveryResult {
  rootPath: string
  foundFiles: DiscoveredFile[]
  missingRecommended: string[]
  loadedAt: string
}

export interface DiscoveredFile {
  relativePath: string
  absolutePath: string
  category: ContextFileCategory
  priority: number
  sizeBytes: number
}

export type ContextFileCategory =
  | 'project'    // PROJECT.md
  | 'tasks'      // TASKS.md
  | 'agents'     // AGENTS.md
  | 'readme'     // README.md
  | 'docs'       // docs/**
  | 'specs'      // specs/**
  | 'playbooks'  // playbooks/**
  | 'policies'   // policies/**
  | 'templates'  // templates/**
  | 'workflows'  // workflows/**
  | 'brand'      // brand/**
  | 'custom'

// ─────────────────────────────────────────────────────────────────────────────
// Interview / Builder
// ─────────────────────────────────────────────────────────────────────────────

export interface InterviewQuestion {
  id: string
  question: string
  hint?: string
  category: InterviewCategory
  required: boolean
  followUpIds?: string[]
}

export type InterviewCategory =
  | 'objective'
  | 'domain'
  | 'io'
  | 'steps'
  | 'approvals'
  | 'tools'
  | 'policies'
  | 'risks'
  | 'context'

export interface InterviewAnswer {
  questionId: string
  answer: string
}

export interface InterviewSession {
  id: string
  answers: InterviewAnswer[]
  startedAt: string
  completedAt?: string
}

export interface SquadBuildResult {
  squadDefinition: SquadDefinition
  generatedFiles: GeneratedFile[]
  warnings: string[]
}

export interface GeneratedFile {
  path: string
  content: string
  format: 'json' | 'markdown'
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Response (from host)
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentResponse {
  agentId: AgentId
  stepId: StepId
  jobId: JobId
  content: string
  artifacts: PendingArtifact[]
  handoffSignal?: HandoffSignal
  approvalNeeded?: boolean
  approvalReason?: string
  status: 'success' | 'failure' | 'needs_input' | 'loop_back'
  metadata?: Record<string, unknown>
}

export interface PendingArtifact {
  name: string
  content: string
  format: 'json' | 'markdown' | 'text'
  description?: string
}

export interface HandoffSignal {
  targetAgentId: AgentId
  condition: string
  payload: Omit<HandoffPayload, 'artifacts'>
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardrail Evaluation
// ─────────────────────────────────────────────────────────────────────────────

export interface GuardrailEvaluationContext {
  job: JobDefinition
  step: WorkflowStep
  agent: AgentDefinition
  response?: AgentResponse
}

export interface GuardrailResult {
  guardrailId: GuardrailId
  passed: boolean
  severity: GuardrailSeverity
  message: string
  blockedTransition?: boolean
}
