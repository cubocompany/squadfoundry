/**
 * DomainClassifier
 *
 * Maps interview answers to a SquadDomain and selects the appropriate
 * agent template set and workflow pattern.
 *
 * The classifier uses keyword matching — it is intentionally simple
 * and transparent. Replace with an LLM-based classifier if needed.
 */

import type { SquadDomain, InterviewAnswer } from '../core/types.js'

export interface ClassificationResult {
  domain: SquadDomain
  confidence: 'high' | 'medium' | 'low'
  suggestedAgentRoles: string[]
  suggestedWorkflowPattern: WorkflowPattern
  notes: string[]
}

export type WorkflowPattern =
  | 'linear'          // A → B → C → done
  | 'review-loop'     // A → B → review → (B again | C)
  | 'publish-gate'    // ... → approval gate → publish
  | 'iterative'       // multiple revision cycles
  | 'pipeline'        // CI/CD-style sequential pipeline
  | 'custom'

// ─────────────────────────────────────────────────────────────────────────────
// Domain templates
// ─────────────────────────────────────────────────────────────────────────────

interface DomainTemplate {
  domain: SquadDomain
  keywords: string[]
  agentRoles: string[]
  workflowPattern: WorkflowPattern
}

const DOMAIN_TEMPLATES: DomainTemplate[] = [
  {
    domain: 'software-development',
    keywords: [
      'code', 'software', 'dev', 'development', 'programming', 'deploy', 'ci', 'cd',
      'github', 'pr', 'pull request', 'test', 'review', 'bug', 'feature', 'branch',
      'commit', 'release', 'build', 'api', 'backend', 'frontend', 'typescript', 'python',
    ],
    agentRoles: ['Product Agent', 'Code Agent', 'Reviewer Agent', 'Test Agent', 'Commit Agent', 'PR Agent', 'Deploy Agent'],
    workflowPattern: 'pipeline',
  },
  {
    domain: 'social-media',
    keywords: [
      'instagram', 'twitter', 'linkedin', 'tiktok', 'social', 'post', 'publish',
      'content', 'caption', 'hashtag', 'story', 'reel', 'engagement', 'follower',
      'brand', 'campaign', 'influencer', 'analytics',
    ],
    agentRoles: ['Strategy Agent', 'Research Agent', 'Copy Agent', 'Creative Review Agent', 'Brand/Compliance Agent', 'Approval Agent', 'Publisher Agent', 'Analytics Agent'],
    workflowPattern: 'publish-gate',
  },
  {
    domain: 'content-marketing',
    keywords: [
      'blog', 'article', 'seo', 'content', 'marketing', 'copy', 'editorial',
      'newsletter', 'email', 'landing page', 'keyword', 'audience', 'traffic',
    ],
    agentRoles: ['Strategy Agent', 'Research Agent', 'Writer Agent', 'Editor Agent', 'SEO Agent', 'Approval Agent', 'Publisher Agent'],
    workflowPattern: 'review-loop',
  },
  {
    domain: 'documentation',
    keywords: [
      'doc', 'documentation', 'spec', 'wiki', 'readme', 'guide', 'manual',
      'technical writing', 'confluence', 'notion', 'changelog', 'api doc',
    ],
    agentRoles: ['Intake Agent', 'Structuring Agent', 'Writer Agent', 'Reviewer Agent', 'Approval Agent', 'Publisher Agent'],
    workflowPattern: 'review-loop',
  },
  {
    domain: 'research',
    keywords: [
      'research', 'analysis', 'report', 'data', 'survey', 'literature', 'findings',
      'summary', 'competitive', 'market research', 'insights',
    ],
    agentRoles: ['Planning Agent', 'Research Agent', 'Analysis Agent', 'Synthesis Agent', 'Review Agent', 'Report Agent'],
    workflowPattern: 'iterative',
  },
  {
    domain: 'operations',
    keywords: [
      'operations', 'hr', 'onboarding', 'sales', 'crm', 'pipeline', 'customer',
      'support', 'ticket', 'process', 'workflow', 'automation', 'runbook',
    ],
    agentRoles: ['Intake Agent', 'Processing Agent', 'Review Agent', 'Approval Agent', 'Execution Agent', 'Reporting Agent'],
    workflowPattern: 'linear',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Classifier
// ─────────────────────────────────────────────────────────────────────────────

export class DomainClassifier {
  classify(answers: InterviewAnswer[]): ClassificationResult {
    const allText = answers.map((a) => a.answer).join(' ').toLowerCase()

    // Score each domain template
    const scores: Array<{ template: DomainTemplate; score: number }> = DOMAIN_TEMPLATES.map(
      (template) => ({
        template,
        score: template.keywords.filter((kw) => allText.includes(kw)).length,
      }),
    )

    scores.sort((a, b) => b.score - a.score)

    const best = scores[0]
    const runner = scores[1]
    const notes: string[] = []

    // Check explicit domain selection from q_domain
    const domainAnswer = answers.find((a) => a.questionId === 'q_domain')?.answer ?? ''
    const explicitDomain = this.parseExplicitDomain(domainAnswer)

    if (explicitDomain) {
      const template = DOMAIN_TEMPLATES.find((t) => t.domain === explicitDomain)
      if (template) {
        notes.push(`Domain explicitly selected: ${explicitDomain}`)
        return {
          domain: explicitDomain,
          confidence: 'high',
          suggestedAgentRoles: template.agentRoles,
          suggestedWorkflowPattern: template.workflowPattern,
          notes,
        }
      }
    }

    if (!best || best.score === 0) {
      notes.push('Could not confidently classify domain — defaulting to custom')
      return {
        domain: 'custom',
        confidence: 'low',
        suggestedAgentRoles: ['Intake Agent', 'Processing Agent', 'Review Agent', 'Output Agent'],
        suggestedWorkflowPattern: 'linear',
        notes,
      }
    }

    const confidence =
      best.score >= 3 && (!runner || best.score > runner.score * 1.5)
        ? 'high'
        : best.score >= 2
        ? 'medium'
        : 'low'

    if (confidence !== 'high') {
      notes.push(`Classification confidence is ${confidence}. Consider clarifying the domain.`)
    }

    return {
      domain: best.template.domain,
      confidence,
      suggestedAgentRoles: best.template.agentRoles,
      suggestedWorkflowPattern: best.template.workflowPattern,
      notes,
    }
  }

  private parseExplicitDomain(answer: string): SquadDomain | null {
    const lower = answer.toLowerCase().trim()
    const map: Record<string, SquadDomain> = {
      '1': 'software-development',
      'software': 'software-development',
      'development': 'software-development',
      '2': 'content-marketing',
      'content': 'content-marketing',
      'marketing': 'content-marketing',
      '3': 'social-media',
      'social': 'social-media',
      'instagram': 'social-media',
      '4': 'documentation',
      'docs': 'documentation',
      'documentation': 'documentation',
      '5': 'research',
      'research': 'research',
      '6': 'operations',
      'operations': 'operations',
      'hr': 'operations',
      'sales': 'operations',
      '7': 'custom',
      'other': 'custom',
      'custom': 'custom',
    }
    return map[lower] ?? null
  }
}

export function createDomainClassifier(): DomainClassifier {
  return new DomainClassifier()
}
