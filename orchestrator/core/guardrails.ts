/**
 * Squad Foundry — Guardrail Engine
 *
 * Guardrails are first-class policy constraints enforced at runtime.
 * They are NOT just text in a prompt — they are evaluated programmatically
 * before each step transition.
 *
 * Built-in guardrails cover common patterns. Squads can register custom ones.
 */

import type {
  GuardrailRule,
  GuardrailResult,
  GuardrailEvaluationContext,
  BuiltinGuardrailKey,
} from './types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Guardrail Evaluator Type
// ─────────────────────────────────────────────────────────────────────────────

export type GuardrailEvaluatorFn = (
  ctx: GuardrailEvaluationContext,
  params: Record<string, unknown>,
) => GuardrailResult

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Guardrail Evaluators
// ─────────────────────────────────────────────────────────────────────────────

const builtinEvaluators: Record<BuiltinGuardrailKey, GuardrailEvaluatorFn> = {
  require_minimum_context(ctx, params): GuardrailResult {
    const minFields = (params['requiredFields'] as string[]) ?? ['projectMd']
    const context = ctx.job.loadedContext
    const missing: string[] = []

    for (const field of minFields) {
      if (field === 'projectMd' && !context.projectMd) missing.push('PROJECT.md')
      if (field === 'tasksMd' && !context.tasksMd) missing.push('TASKS.md')
      if (field === 'agentsMd' && !context.agentsMd) missing.push('AGENTS.md')
      if (field === 'readmeMd' && !context.readmeMd) missing.push('README.md')
    }

    if (missing.length > 0) {
      return {
        guardrailId: 'require_minimum_context',
        passed: false,
        severity: 'block',
        message: `Missing required context files: ${missing.join(', ')}`,
        blockedTransition: true,
      }
    }

    return {
      guardrailId: 'require_minimum_context',
      passed: true,
      severity: 'block',
      message: 'All required context files present',
    }
  },

  require_artifact_before_step(ctx, params): GuardrailResult {
    const requiredArtifactNames = (params['artifactNames'] as string[]) ??
      ctx.step.requiredArtifacts

    const existingArtifactPaths = ctx.job.artifacts.map((a) => a.name)
    const missing = requiredArtifactNames.filter(
      (name) => !existingArtifactPaths.includes(name),
    )

    if (missing.length > 0) {
      return {
        guardrailId: 'require_artifact_before_step',
        passed: false,
        severity: 'block',
        message: `Cannot run step '${ctx.step.name}' — missing artifacts: ${missing.join(', ')}`,
        blockedTransition: true,
      }
    }

    return {
      guardrailId: 'require_artifact_before_step',
      passed: true,
      severity: 'block',
      message: 'All required artifacts present',
    }
  },

  require_approval_before_publish(ctx, _params): GuardrailResult {
    const isPublishStep = ctx.step.name.toLowerCase().includes('publish') ||
      ctx.agent.role.toLowerCase().includes('publish')

    if (!isPublishStep) {
      return {
        guardrailId: 'require_approval_before_publish',
        passed: true,
        severity: 'block',
        message: 'Not a publish step — guardrail does not apply',
      }
    }

    const hasPendingApproval = ctx.job.approvals.some(
      (a) => a.stepId === ctx.step.id && a.status === 'pending',
    )
    const hasApproval = ctx.job.approvals.some(
      (a) => a.stepId === ctx.step.id && a.status === 'approved',
    )

    if (!hasApproval && !hasPendingApproval) {
      return {
        guardrailId: 'require_approval_before_publish',
        passed: false,
        severity: 'block',
        message: `Publishing step '${ctx.step.name}' requires human approval before execution`,
        blockedTransition: true,
      }
    }

    if (hasPendingApproval) {
      return {
        guardrailId: 'require_approval_before_publish',
        passed: false,
        severity: 'block',
        message: `Waiting for human approval before publishing — step '${ctx.step.name}'`,
        blockedTransition: true,
      }
    }

    return {
      guardrailId: 'require_approval_before_publish',
      passed: true,
      severity: 'block',
      message: 'Approval received — may proceed with publishing',
    }
  },

  require_human_before_deploy(ctx, _params): GuardrailResult {
    const isDeployStep = ctx.step.name.toLowerCase().includes('deploy') ||
      ctx.agent.role.toLowerCase().includes('deploy')

    if (!isDeployStep) {
      return {
        guardrailId: 'require_human_before_deploy',
        passed: true,
        severity: 'block',
        message: 'Not a deploy step — guardrail does not apply',
      }
    }

    const hasApproval = ctx.job.approvals.some(
      (a) => a.stepId === ctx.step.id && a.status === 'approved',
    )

    if (!hasApproval) {
      return {
        guardrailId: 'require_human_before_deploy',
        passed: false,
        severity: 'block',
        message: `Deploy step '${ctx.step.name}' ALWAYS requires explicit human confirmation. No automated deploys.`,
        blockedTransition: true,
      }
    }

    return {
      guardrailId: 'require_human_before_deploy',
      passed: true,
      severity: 'block',
      message: 'Human deploy confirmation received',
    }
  },

  block_invalid_state_transition(ctx, params): GuardrailResult {
    const allowedFromStates = (params['allowedFromStates'] as string[]) ??
      ctx.agent.allowedStates

    if (!allowedFromStates.includes(ctx.job.status)) {
      return {
        guardrailId: 'block_invalid_state_transition',
        passed: false,
        severity: 'block',
        message: `Agent '${ctx.agent.name}' cannot act in state '${ctx.job.status}'. Allowed: ${allowedFromStates.join(', ')}`,
        blockedTransition: true,
      }
    }

    return {
      guardrailId: 'block_invalid_state_transition',
      passed: true,
      severity: 'block',
      message: `Agent '${ctx.agent.name}' is allowed to act in state '${ctx.job.status}'`,
    }
  },

  require_pr_criteria(ctx, params): GuardrailResult {
    const criteria = (params['criteria'] as string[]) ?? [
      'tests_passed',
      'review_complete',
      'branch_clean',
    ]
    const reviewArtifact = ctx.job.artifacts.find(
      (a) => a.name.toLowerCase().includes('review') ||
             a.name.toLowerCase().includes('findings'),
    )
    const testArtifact = ctx.job.artifacts.find(
      (a) => a.name.toLowerCase().includes('test'),
    )

    const missing: string[] = []
    if (criteria.includes('review_complete') && !reviewArtifact) {
      missing.push('Review artifacts')
    }
    if (criteria.includes('tests_passed') && !testArtifact) {
      missing.push('Test results')
    }

    if (missing.length > 0) {
      return {
        guardrailId: 'require_pr_criteria',
        passed: false,
        severity: 'block',
        message: `PR cannot be created — missing: ${missing.join(', ')}`,
        blockedTransition: true,
      }
    }

    return {
      guardrailId: 'require_pr_criteria',
      passed: true,
      severity: 'block',
      message: 'All PR criteria satisfied',
    }
  },

  no_agent_outside_allowed_states(ctx, _params): GuardrailResult {
    const allowed = ctx.agent.allowedStates
    if (!allowed.includes(ctx.job.status)) {
      return {
        guardrailId: 'no_agent_outside_allowed_states',
        passed: false,
        severity: 'block',
        message: `Agent '${ctx.agent.id}' is not permitted to run in status '${ctx.job.status}'`,
        blockedTransition: true,
      }
    }
    return {
      guardrailId: 'no_agent_outside_allowed_states',
      passed: true,
      severity: 'block',
      message: 'Agent is operating within its allowed states',
    }
  },

  require_artifact_produced(ctx, params): GuardrailResult {
    const expectedName = params['artifactName'] as string | undefined
    if (!expectedName) {
      return {
        guardrailId: 'require_artifact_produced',
        passed: true,
        severity: 'warn',
        message: 'No artifact name specified — guardrail skipped',
      }
    }

    const produced = ctx.job.artifacts.find((a) => a.name === expectedName)
    if (!produced) {
      return {
        guardrailId: 'require_artifact_produced',
        passed: false,
        severity: 'warn',
        message: `Expected artifact '${expectedName}' was not produced by step '${ctx.step.name}'`,
      }
    }

    return {
      guardrailId: 'require_artifact_produced',
      passed: true,
      severity: 'warn',
      message: `Artifact '${expectedName}' confirmed`,
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardrail Engine
// ─────────────────────────────────────────────────────────────────────────────

export class GuardrailEngine {
  private customEvaluators: Map<string, GuardrailEvaluatorFn> = new Map()

  /**
   * Register a custom guardrail evaluator.
   */
  register(key: string, fn: GuardrailEvaluatorFn): void {
    this.customEvaluators.set(key, fn)
  }

  /**
   * Evaluate a single guardrail rule against the current context.
   */
  evaluate(
    rule: GuardrailRule,
    ctx: GuardrailEvaluationContext,
  ): GuardrailResult {
    const key = rule.ruleKey as BuiltinGuardrailKey
    const builtin = builtinEvaluators[key]
    const custom = this.customEvaluators.get(rule.ruleKey)
    const evaluator = builtin ?? custom

    if (!evaluator) {
      return {
        guardrailId: rule.id,
        passed: false,
        severity: 'warn',
        message: `Unknown guardrail rule key: '${rule.ruleKey}'`,
      }
    }

    const result = evaluator(ctx, rule.params ?? {})
    // Override the guardrailId with the rule's configured ID
    return { ...result, guardrailId: rule.id, severity: rule.severity }
  }

  /**
   * Evaluate all guardrails for a step. Returns all results.
   * Any result with severity 'block' and passed=false will block execution.
   */
  evaluateAll(
    rules: GuardrailRule[],
    ctx: GuardrailEvaluationContext,
  ): { results: GuardrailResult[]; blocked: boolean; warnings: GuardrailResult[] } {
    const results = rules.map((rule) => this.evaluate(rule, ctx))
    const blocked = results.some((r) => r.severity === 'block' && !r.passed)
    const warnings = results.filter((r) => r.severity === 'warn' && !r.passed)
    return { results, blocked, warnings }
  }
}

export function createGuardrailEngine(): GuardrailEngine {
  return new GuardrailEngine()
}
