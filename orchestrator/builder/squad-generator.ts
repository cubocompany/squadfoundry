/**
 * SquadGenerator
 *
 * Takes interview answers + classification result and generates:
 * - A complete SquadDefinition (in-memory)
 * - SQUAD.md
 * - WORKFLOW.md
 * - AGENTS.md
 * - POLICIES.md
 * - config/squad.json
 *
 * All generated files are returned as GeneratedFile[] — writing to disk
 * is handled by SquadBuilder.
 */

import type {
  SquadDefinition,
  AgentDefinition,
  WorkflowDefinition,
  WorkflowStep,
  PolicyDefinition,
  GuardrailRule,
  InterviewAnswer,
  GeneratedFile,
  SquadBuildResult,
  SquadDomain,
  HandoffRule,
} from '../core/types.js'
import type { ClassificationResult } from './domain-classifier.js'

// ─────────────────────────────────────────────────────────────────────────────
// Generator
// ─────────────────────────────────────────────────────────────────────────────

export class SquadGenerator {
  generate(answers: InterviewAnswer[], classification: ClassificationResult): SquadBuildResult {
    const get = (id: string) => answers.find((a) => a.questionId === id)?.answer ?? ''

    const squadId = this.toSlug(get('q_squad_name') || `squad-${Date.now()}`)
    const now = new Date().toISOString()
    const warnings: string[] = [...classification.notes]

    // ── Build agents ─────────────────────────────────────────────────────────
    const agents = this.buildAgents(
      classification.suggestedAgentRoles,
      classification.domain,
      get('q_tools'),
      get('q_prohibited'),
    )

    // ── Build workflow ───────────────────────────────────────────────────────
    const stepsRaw = get('q_steps')
    const approvalSteps = get('q_approvals').toLowerCase()
    const workflow = this.buildWorkflow(
      agents,
      stepsRaw,
      approvalSteps,
      classification.suggestedWorkflowPattern,
    )

    // ── Build policy ──────────────────────────────────────────────────────────
    const policy = this.buildPolicy(
      get('q_prohibited'),
      get('q_policies'),
      get('q_human_in_loop'),
      workflow.steps,
    )

    // ── Assemble squad ───────────────────────────────────────────────────────
    const squad: SquadDefinition = {
      id: squadId,
      name: get('q_squad_name') || squadId,
      domain: classification.domain,
      objective: get('q_objective'),
      description: get('q_description'),
      context: `Generated from interview on ${now}`,
      agents,
      workflow,
      policy,
      expectedArtifacts: this.buildExpectedArtifacts(get('q_outputs'), agents),
      allowedIntegrations: this.buildIntegrations(get('q_tools')),
      templates: [],
      successCriteria: [get('q_outputs') || 'All workflow steps completed successfully'],
      failureCriteria: [`Any step fails. Risks: ${get('q_risks') || 'none specified'}`],
      metadata: {
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        tags: [classification.domain],
        hostCompatibility: ['claude-code', 'opencode', 'cursor', 'codex', 'zed', 'any'],
      },
    }

    // ── Generate files ───────────────────────────────────────────────────────
    const generatedFiles: GeneratedFile[] = [
      { path: `squads/${squadId}/SQUAD.md`, content: this.renderSquadMd(squad, answers), format: 'markdown' },
      { path: `squads/${squadId}/WORKFLOW.md`, content: this.renderWorkflowMd(workflow, agents), format: 'markdown' },
      { path: `squads/${squadId}/AGENTS.md`, content: this.renderAgentsMd(agents), format: 'markdown' },
      { path: `squads/${squadId}/POLICIES.md`, content: this.renderPoliciesMd(policy), format: 'markdown' },
      { path: `squads/${squadId}/config/squad.json`, content: JSON.stringify(squad, null, 2), format: 'json' },
    ]

    return { squadDefinition: squad, generatedFiles, warnings }
  }

  // ─── Agent builder ──────────────────────────────────────────────────────────

  private buildAgents(
    roles: string[],
    domain: SquadDomain,
    tools: string,
    prohibited: string,
  ): AgentDefinition[] {
    return roles.map((role, idx) => {
      const id = this.toSlug(role)
      const isLast = idx === roles.length - 1
      const nextRole = isLast ? null : roles[idx + 1]

      const handoffRules: HandoffRule[] = nextRole
        ? [
            {
              condition: 'step_completed_successfully',
              targetAgentId: this.toSlug(nextRole),
              description: `Pass output to ${nextRole}`,
              requiresApproval: role.toLowerCase().includes('approv'),
            },
          ]
        : []

      return {
        id,
        name: role,
        role,
        domain,
        objective: `Execute the '${role}' responsibilities in the squad workflow`,
        instructions: `You are the ${role}. Complete your assigned step carefully and produce the expected outputs. Respect all squad policies and constraints.`,
        inputs: [{ name: 'job_context', description: 'Current job context and previous step outputs', required: true }],
        outputs: [{ name: 'step_output', description: `Output produced by ${role}`, required: true }],
        allowedTools: this.inferTools(role, tools),
        constraints: prohibited ? [prohibited] : [],
        successCriteria: [`${role} task completed and output produced`],
        failureCriteria: [`${role} was unable to produce required output`],
        allowedStates: ['READY_FOR_EXECUTION', 'RUNNING_STEP'],
        blockingConditions: [],
        handoffRules,
        responseFormat: 'markdown',
      }
    })
  }

  // ─── Workflow builder ───────────────────────────────────────────────────────

  private buildWorkflow(
    agents: AgentDefinition[],
    stepsRaw: string,
    approvalSteps: string,
    _pattern: string,
  ): WorkflowDefinition {
    const steps: WorkflowStep[] = agents.map((agent, idx) => {
      const prev = idx > 0 ? agents[idx - 1] : null
      const next = idx < agents.length - 1 ? agents[idx + 1] : null
      const needsApproval = approvalSteps.includes(agent.name.toLowerCase()) ||
        approvalSteps.includes('publish') && agent.name.toLowerCase().includes('publish') ||
        approvalSteps.includes('deploy') && agent.name.toLowerCase().includes('deploy')

      return {
        id: `step-${agent.id}`,
        name: agent.name,
        agentId: agent.id,
        description: `Execute ${agent.name} responsibilities`,
        dependsOn: prev ? [`step-${prev.id}`] : [],
        guardrails: this.inferGuardrailsForStep(agent),
        requiresApprovalBefore: needsApproval && agent.name.toLowerCase().includes('publish'),
        requiresApprovalAfter: needsApproval && !agent.name.toLowerCase().includes('publish'),
        requiredArtifacts: idx > 0 ? [`${agents[idx - 1]?.name ?? ''}-output`] : [],
        producedArtifacts: [`${agent.name}-output`],
        allowsLoop: agent.name.toLowerCase().includes('review'),
        nextStepId: next ? `step-${next.id}` : undefined,
        failureStepId: undefined,
      }
    })

    const entryStep = steps[0]

    return {
      id: `workflow-${Date.now()}`,
      name: 'Generated Workflow',
      description: `Workflow generated from: ${stepsRaw || 'interview answers'}`,
      steps,
      entryStepId: entryStep?.id ?? 'step-0',
    }
  }

  // ─── Policy builder ─────────────────────────────────────────────────────────

  private buildPolicy(
    prohibited: string,
    policies: string,
    humanInLoop: string,
    steps: WorkflowStep[],
  ): PolicyDefinition {
    const guardrails: GuardrailRule[] = [
      {
        id: 'grail-min-context',
        name: 'Require Minimum Context',
        description: 'At least PROJECT.md or README.md must be present',
        severity: 'warn',
        ruleKey: 'require_minimum_context',
        params: { requiredFields: ['projectMd'] },
      },
    ]

    // Add publish guardrail if any publish steps exist
    const hasPublish = steps.some((s) =>
      s.name.toLowerCase().includes('publish') || s.name.toLowerCase().includes('publisher'),
    )
    if (hasPublish) {
      guardrails.push({
        id: 'grail-approval-publish',
        name: 'Require Approval Before Publish',
        description: 'Human approval is required before any publishing action',
        severity: 'block',
        ruleKey: 'require_approval_before_publish',
      })
    }

    // Add deploy guardrail if any deploy steps exist
    const hasDeploy = steps.some((s) => s.name.toLowerCase().includes('deploy'))
    if (hasDeploy) {
      guardrails.push({
        id: 'grail-human-deploy',
        name: 'Require Human Before Deploy',
        description: 'Deployments always require explicit human confirmation',
        severity: 'block',
        ruleKey: 'require_human_before_deploy',
      })
    }

    const prohibitedList = prohibited
      ? prohibited.split(/[,.\n]/).map((s) => s.trim()).filter(Boolean)
      : []

    return {
      id: 'policy-generated',
      name: 'Generated Policy',
      description: policies || 'Auto-generated policy from interview',
      guardrails,
      prohibitedActions: prohibitedList,
      requiredApprovals: humanInLoop
        ? [{ action: humanInLoop, description: `Human confirmation required: ${humanInLoop}` }]
        : [],
    }
  }

  // ─── Markdown renderers ────────────────────────────────────────────────────

  private renderSquadMd(squad: SquadDefinition, answers: InterviewAnswer[]): string {
    const get = (id: string) => answers.find((a) => a.questionId === id)?.answer ?? '_not provided_'
    return `# ${squad.name}

**ID:** \`${squad.id}\`
**Domain:** ${squad.domain}
**Version:** ${squad.metadata.version}
**Created:** ${squad.metadata.createdAt}

## Objective

${squad.objective}

## Description

${squad.description}

## Agents

${squad.agents.map((a) => `- **${a.name}** (\`${a.id}\`) — ${a.objective}`).join('\n')}

## Inputs

${get('q_inputs')}

## Outputs

${get('q_outputs')}

## Success Criteria

${squad.successCriteria.map((c) => `- ${c}`).join('\n')}

## Failure Criteria

${squad.failureCriteria.map((c) => `- ${c}`).join('\n')}

## Host Compatibility

${squad.metadata.hostCompatibility.join(', ')}

---
_Generated by Squad Foundry Squad Builder_
`
  }

  private renderWorkflowMd(workflow: WorkflowDefinition, agents: AgentDefinition[]): string {
    return `# Workflow: ${workflow.name}

${workflow.description}

## Steps

${workflow.steps
  .map(
    (step, i) => `### ${i + 1}. ${step.name}

- **Agent:** ${agents.find((a) => a.id === step.agentId)?.name ?? step.agentId}
- **Depends on:** ${step.dependsOn.length > 0 ? step.dependsOn.join(', ') : 'none'}
- **Approval before:** ${step.requiresApprovalBefore ? 'YES' : 'no'}
- **Approval after:** ${step.requiresApprovalAfter ? 'YES' : 'no'}
- **Produces:** ${step.producedArtifacts.join(', ') || 'none'}
- **Next step:** ${step.nextStepId ?? '_(end)_'}
`,
  )
  .join('\n')}

---
_Generated by Squad Foundry Squad Builder_
`
  }

  private renderAgentsMd(agents: AgentDefinition[]): string {
    return `# Agents

${agents
  .map(
    (a) => `## ${a.name}

**ID:** \`${a.id}\`
**Role:** ${a.role}
**Objective:** ${a.objective}
**Allowed Tools:** ${a.allowedTools.join(', ') || 'none'}
**Response Format:** ${a.responseFormat}

### Instructions

${a.instructions}

### Handoff Rules

${a.handoffRules.map((h) => `- On \`${h.condition}\` → **${h.targetAgentId}**${h.requiresApproval ? ' _(requires approval)_' : ''}`).join('\n') || '_(none)_'}

`,
  )
  .join('\n---\n\n')}

---
_Generated by Squad Foundry Squad Builder_
`
  }

  private renderPoliciesMd(policy: PolicyDefinition): string {
    return `# Policies

## Overview

${policy.description}

## Guardrails

${policy.guardrails.map((g) => `### ${g.name}\n- **Severity:** ${g.severity}\n- **Rule:** \`${g.ruleKey}\`\n- ${g.description}`).join('\n\n')}

## Prohibited Actions

${policy.prohibitedActions.length > 0 ? policy.prohibitedActions.map((a) => `- ${a}`).join('\n') : '_None specified_'}

## Required Approvals

${policy.requiredApprovals.length > 0 ? policy.requiredApprovals.map((a) => `- **${a.action}**: ${a.description}`).join('\n') : '_None specified_'}

---
_Generated by Squad Foundry Squad Builder_
`
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private toSlug(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  private inferTools(role: string, toolsAnswer: string): string[] {
    const lower = role.toLowerCase() + ' ' + toolsAnswer.toLowerCase()
    const tools: string[] = []
    if (lower.includes('github') || lower.includes('pr') || lower.includes('commit')) tools.push('git', 'github')
    if (lower.includes('deploy') || lower.includes('vercel')) tools.push('deploy')
    if (lower.includes('instagram') || lower.includes('publish')) tools.push('social-media')
    if (lower.includes('test')) tools.push('test-runner')
    if (lower.includes('search') || lower.includes('research')) tools.push('web-search')
    if (lower.includes('doc') || lower.includes('spec')) tools.push('filesystem')
    return tools
  }

  private inferGuardrailsForStep(agent: AgentDefinition): string[] {
    const roles = agent.role.toLowerCase()
    const ids: string[] = []
    if (roles.includes('publish')) ids.push('grail-approval-publish')
    if (roles.includes('deploy')) ids.push('grail-human-deploy')
    return ids
  }

  private buildExpectedArtifacts(_outputs: string, agents: AgentDefinition[]) {
    return agents.map((a, i) => ({
      id: `artifact-${a.id}`,
      name: `${a.name} Output`,
      description: `Artifact produced by ${a.name}`,
      path: `outputs/${a.id}-output.md`,
      required: i === agents.length - 1,
      format: 'markdown' as const,
    }))
  }

  private buildIntegrations(tools: string) {
    const lower = tools.toLowerCase()
    const integrations = []
    if (lower.includes('github')) integrations.push({ id: 'github', type: 'vcs' as const, name: 'GitHub', required: false, status: 'stub' as const })
    if (lower.includes('vercel')) integrations.push({ id: 'vercel', type: 'deploy' as const, name: 'Vercel', required: false, status: 'stub' as const })
    if (lower.includes('instagram')) integrations.push({ id: 'instagram', type: 'social-media' as const, name: 'Instagram', required: false, status: 'stub' as const })
    return integrations
  }
}

export function createSquadGenerator(): SquadGenerator {
  return new SquadGenerator()
}
