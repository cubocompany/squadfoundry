import { describe, it, expect } from 'vitest'
import { createSquadBuilder, SquadBuilder } from '../../orchestrator/builder/squad-builder.js'
import { createDomainClassifier } from '../../orchestrator/builder/domain-classifier.js'
import type { InterviewAnswer } from '../../orchestrator/core/types.js'

function makeAnswers(overrides: Partial<Record<string, string>> = {}): InterviewAnswer[] {
  const defaults: Record<string, string> = {
    q_objective: 'Automate software feature delivery',
    q_domain: '1',
    q_description: 'A squad that takes a task, writes code, reviews it, tests, and deploys.',
    q_inputs: 'Task description or GitHub issue',
    q_outputs: 'Deployed feature and PR link',
    q_steps: '1. Requirements, 2. Code, 3. Review, 4. Test, 5. Deploy',
    q_approvals: 'Deploy always needs human approval',
    q_human_in_loop: 'Never auto-deploy to production',
    q_tools: 'GitHub, Vercel',
    q_squad_name: 'my-software-squad',
    ...overrides,
  }
  return Object.entries(defaults).map(([questionId, answer]) => ({ questionId, answer }))
}

describe('SquadBuilder', () => {
  it('creates a SquadBuilder instance', () => {
    const builder = createSquadBuilder()
    expect(builder).toBeInstanceOf(SquadBuilder)
  })

  it('returns interview questions', () => {
    const builder = createSquadBuilder()
    const questions = builder.getQuestions()
    expect(questions.length).toBeGreaterThan(0)
    expect(questions.every((q) => q.id && q.question)).toBe(true)
  })

  it('validates answers — detects missing required fields', () => {
    const builder = createSquadBuilder()
    const missing = builder.validateAnswers([])
    expect(missing.length).toBeGreaterThan(0)
  })

  it('validates answers — passes with complete required answers', () => {
    const builder = createSquadBuilder()
    const answers = makeAnswers()
    const missing = builder.validateAnswers(answers)
    expect(missing).toHaveLength(0)
  })

  it('generates a squad definition from answers', () => {
    const builder = createSquadBuilder()
    const answers = makeAnswers()
    const result = builder.conductInterview(answers)

    expect(result.squadDefinition).toBeDefined()
    expect(result.squadDefinition.id).toBe('my-software-squad')
    expect(result.squadDefinition.domain).toBe('software-development')
    expect(result.squadDefinition.agents.length).toBeGreaterThan(0)
    expect(result.squadDefinition.workflow.steps.length).toBeGreaterThan(0)
  })

  it('generates all required files', () => {
    const builder = createSquadBuilder()
    const result = builder.conductInterview(makeAnswers())

    const paths = result.generatedFiles.map((f) => f.path)
    expect(paths.some((p) => p.includes('SQUAD.md'))).toBe(true)
    expect(paths.some((p) => p.includes('WORKFLOW.md'))).toBe(true)
    expect(paths.some((p) => p.includes('AGENTS.md'))).toBe(true)
    expect(paths.some((p) => p.includes('POLICIES.md'))).toBe(true)
    expect(paths.some((p) => p.includes('squad.json'))).toBe(true)
  })

  it('generates a social media squad when domain is 3', () => {
    const builder = createSquadBuilder()
    const answers = makeAnswers({
      q_domain: '3',
      q_objective: 'Create and publish Instagram content',
      q_squad_name: 'insta-squad',
    })
    const result = builder.conductInterview(answers)
    expect(result.squadDefinition.domain).toBe('social-media')
  })

  it('includes publish guardrail for social media squads', () => {
    const builder = createSquadBuilder()
    const answers = makeAnswers({
      q_domain: '3',
      q_steps: '1. Write, 2. Review, 3. Approve, 4. Publish',
      q_squad_name: 'insta-sq',
    })
    const result = builder.conductInterview(answers)
    const guardrailKeys = result.squadDefinition.policy.guardrails.map((g) => g.ruleKey)
    expect(guardrailKeys).toContain('require_approval_before_publish')
  })

  it('generates interview prompt string', () => {
    const builder = createSquadBuilder()
    const prompt = builder.generateInterviewPrompt()
    expect(prompt).toContain('Squad Design Interview')
    expect(prompt.length).toBeGreaterThan(100)
  })
})

describe('DomainClassifier', () => {
  it('classifies software development domain', () => {
    const classifier = createDomainClassifier()
    const answers: InterviewAnswer[] = [
      { questionId: 'q_domain', answer: '1' },
      { questionId: 'q_objective', answer: 'Build and deploy software features with code review' },
    ]
    const result = classifier.classify(answers)
    expect(result.domain).toBe('software-development')
  })

  it('classifies social media domain', () => {
    const classifier = createDomainClassifier()
    const answers: InterviewAnswer[] = [
      { questionId: 'q_domain', answer: 'instagram' },
      { questionId: 'q_objective', answer: 'Create and publish Instagram posts' },
    ]
    const result = classifier.classify(answers)
    expect(result.domain).toBe('social-media')
  })

  it('falls back to custom for unrecognized domain', () => {
    const classifier = createDomainClassifier()
    const answers: InterviewAnswer[] = [
      { questionId: 'q_domain', answer: 'other' },
      { questionId: 'q_objective', answer: 'Something completely unique' },
    ]
    const result = classifier.classify(answers)
    expect(result.domain).toBe('custom')
  })

  it('suggests agents for each domain', () => {
    const classifier = createDomainClassifier()
    const result = classifier.classify([
      { questionId: 'q_domain', answer: 'documentation' },
    ])
    expect(result.suggestedAgentRoles.length).toBeGreaterThan(0)
  })
})
