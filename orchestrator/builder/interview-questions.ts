/**
 * Interview Questions Bank
 *
 * Structured questions used by the Squad Builder to discover
 * the user's intent, domain, workflow, and constraints before
 * generating a squad definition.
 */

import type { InterviewQuestion } from '../core/types.js'

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  // ── Objective ──────────────────────────────────────────────────────────────
  {
    id: 'q_objective',
    category: 'objective',
    required: true,
    question: 'What is the primary objective of this squad? What problem does it solve?',
    hint: 'e.g. "Automate publishing of Instagram content, from idea to post"',
  },
  {
    id: 'q_domain',
    category: 'domain',
    required: true,
    question:
      'What domain does this squad operate in?\n  1. Software Development\n  2. Content Marketing\n  3. Social Media\n  4. Documentation\n  5. Research\n  6. Operations / HR / Sales\n  7. Other (describe)',
    hint: 'Enter the number or describe freely',
  },
  {
    id: 'q_description',
    category: 'objective',
    required: true,
    question: 'Describe the squad in 2–3 sentences. What does it do end-to-end?',
  },

  // ── I/O ───────────────────────────────────────────────────────────────────
  {
    id: 'q_inputs',
    category: 'io',
    required: true,
    question: 'What are the typical INPUTS for this squad? (e.g. a task description, a brief, a JIRA ticket, a keyword)',
  },
  {
    id: 'q_outputs',
    category: 'io',
    required: true,
    question: 'What are the expected OUTPUTS? (e.g. a PR, a published post, a documented spec, a report)',
  },

  // ── Steps ─────────────────────────────────────────────────────────────────
  {
    id: 'q_steps',
    category: 'steps',
    required: true,
    question: 'What are the main steps in this process TODAY (even if manual)?\nList them in order, e.g. "1. Research, 2. Write, 3. Review, 4. Publish"',
  },
  {
    id: 'q_loop_steps',
    category: 'steps',
    required: false,
    question: 'Are there any steps that loop or iterate? (e.g. "Review → Revise → Review again")',
    hint: 'Leave blank if steps are strictly sequential',
  },

  // ── Approvals ─────────────────────────────────────────────────────────────
  {
    id: 'q_approvals',
    category: 'approvals',
    required: true,
    question: 'Which steps REQUIRE human approval or sign-off before moving forward?',
    hint: 'e.g. "Publishing always needs approval. Commit never does."',
  },
  {
    id: 'q_human_in_loop',
    category: 'approvals',
    required: true,
    question: 'What is NEVER allowed to be fully automated? What must always involve a human?',
    hint: 'e.g. "Never auto-publish. Never deploy to production without confirmation."',
  },

  // ── Tools ─────────────────────────────────────────────────────────────────
  {
    id: 'q_tools',
    category: 'tools',
    required: false,
    question: 'What tools or systems are involved? (e.g. GitHub, Vercel, Instagram, Google Docs, Slack, Notion)',
    hint: 'List any APIs, platforms, or services this squad will interact with',
  },

  // ── Policies ──────────────────────────────────────────────────────────────
  {
    id: 'q_policies',
    category: 'policies',
    required: false,
    question: 'Are there any rules, brand guidelines, compliance requirements, or policies that must be respected?',
    hint: 'e.g. "Must follow brand voice guidelines. No profanity. Legal review required for contracts."',
  },
  {
    id: 'q_prohibited',
    category: 'policies',
    required: false,
    question: 'What actions are strictly PROHIBITED for this squad to take automatically?',
    hint: 'e.g. "No auto-merge of PRs. No posting without brand review."',
  },

  // ── Risks ─────────────────────────────────────────────────────────────────
  {
    id: 'q_risks',
    category: 'risks',
    required: false,
    question: 'What are the most critical risks if something goes wrong in this workflow?',
    hint: 'e.g. "Wrong post published. Broken deploy. PII exposed in public doc."',
  },

  // ── Context ───────────────────────────────────────────────────────────────
  {
    id: 'q_context_files',
    category: 'context',
    required: false,
    question: 'What documentation already exists for this domain?\n(e.g. brand guide, design system, spec templates, playbooks)',
  },
  {
    id: 'q_squad_name',
    category: 'objective',
    required: true,
    question: 'What should this squad be called? (used as the squad ID and folder name)',
    hint: 'e.g. "instagram-content", "software-dev", "technical-docs"',
  },
]

export function getRequiredQuestions(): InterviewQuestion[] {
  return INTERVIEW_QUESTIONS.filter((q) => q.required)
}

export function getQuestionById(id: string): InterviewQuestion | undefined {
  return INTERVIEW_QUESTIONS.find((q) => q.id === id)
}

export function getQuestionsByCategory(
  category: InterviewQuestion['category'],
): InterviewQuestion[] {
  return INTERVIEW_QUESTIONS.filter((q) => q.category === category)
}
