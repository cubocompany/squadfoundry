/**
 * SquadBuilder
 *
 * High-level orchestrator for the squad design interview.
 * Coordinates: questions → answers → classification → generation → file output.
 *
 * SquadBuilder is designed to run in two modes:
 * 1. Programmatic: call conductInterview(answers[]) with pre-filled answers
 * 2. Interactive CLI: use with the CLI entrypoint which prompts the user
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { InterviewAnswer, SquadBuildResult } from '../core/types.js'
import { INTERVIEW_QUESTIONS } from './interview-questions.js'
import { DomainClassifier, createDomainClassifier } from './domain-classifier.js'
import { SquadGenerator, createSquadGenerator } from './squad-generator.js'
import { ContextLoader } from '../context/context-loader.js'

export interface SquadBuilderOptions {
  /** Root path for context discovery */
  contextRootPath?: string
  /** Output directory for generated squad files */
  outputDir?: string
  classifier?: DomainClassifier
  generator?: SquadGenerator
}

export class SquadBuilder {
  private contextRootPath: string
  private outputDir: string
  private classifier: DomainClassifier
  private generator: SquadGenerator

  constructor(options: SquadBuilderOptions = {}) {
    this.contextRootPath = options.contextRootPath ?? process.cwd()
    this.outputDir = options.outputDir ?? process.cwd()
    this.classifier = options.classifier ?? createDomainClassifier()
    this.generator = options.generator ?? createSquadGenerator()
  }

  /**
   * Return all interview questions (for display in CLI or agent conversation).
   */
  getQuestions() {
    return INTERVIEW_QUESTIONS
  }

  /**
   * Conduct the interview programmatically with a pre-built answer set.
   * Returns the squad build result without writing files.
   */
  conductInterview(answers: InterviewAnswer[]): SquadBuildResult {
    const classification = this.classifier.classify(answers)
    return this.generator.generate(answers, classification)
  }

  /**
   * Build a squad from answers and write all generated files to disk.
   */
  async build(answers: InterviewAnswer[]): Promise<SquadBuildResult> {
    // Load existing context and add to answers if context files found
    const contextLoader = new ContextLoader({ rootPath: this.contextRootPath })
    const summary = await contextLoader.summarize()

    const enrichedAnswers = [...answers]
    if (summary.hasProjectMd) {
      enrichedAnswers.push({
        questionId: '_context_project_md',
        answer: 'PROJECT.md found and loaded',
      })
    }
    if (summary.hasTasksMd) {
      enrichedAnswers.push({
        questionId: '_context_tasks_md',
        answer: 'TASKS.md found and loaded',
      })
    }

    const result = this.conductInterview(enrichedAnswers)

    // Write generated files to disk
    for (const file of result.generatedFiles) {
      const fullPath = join(this.outputDir, file.path)
      mkdirSync(dirname(fullPath), { recursive: true })
      writeFileSync(fullPath, file.content, 'utf-8')
      console.log(`[SquadBuilder] Written: ${file.path}`)
    }

    return result
  }

  /**
   * Validate that all required questions have answers.
   * Returns an array of missing question IDs.
   */
  validateAnswers(answers: InterviewAnswer[]): string[] {
    const required = INTERVIEW_QUESTIONS.filter((q) => q.required)
    const answeredIds = new Set(answers.map((a) => a.questionId))
    return required
      .filter((q) => !answeredIds.has(q.id) || !answers.find((a) => a.questionId === q.id)?.answer?.trim())
      .map((q) => q.id)
  }

  /**
   * Generate a formatted prompt string for the orquestrador to use
   * when interviewing the user in an agent conversation context.
   */
  generateInterviewPrompt(): string {
    const questions = INTERVIEW_QUESTIONS.filter((q) => q.required)
    const lines = [
      '# Squad Design Interview',
      '',
      'I will ask you a series of questions to design your squad.',
      'Answer as completely as you can — I will fill in reasonable defaults where needed.',
      '',
      ...questions.flatMap((q, i) => [
        `**${i + 1}. ${q.question}**`,
        q.hint ? `   _Hint: ${q.hint}_` : '',
        '',
      ]),
    ]
    return lines.filter((l) => l !== null).join('\n')
  }
}

export function createSquadBuilder(options?: SquadBuilderOptions): SquadBuilder {
  return new SquadBuilder(options)
}
