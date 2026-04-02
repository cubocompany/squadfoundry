import { describe, it, expect, beforeEach } from 'vitest'
import { createStateMachine, StateMachine } from '../../orchestrator/core/state-machine.js'
import type { JobDefinition } from '../../orchestrator/core/types.js'

function makeJob(status: JobDefinition['status']): JobDefinition {
  return {
    id: 'test-job',
    squadId: 'test-squad',
    status,
    objective: 'test',
    initialInput: 'test input',
    loadedContext: {
      docs: [],
      specs: [],
      playbooks: [],
      policies: [],
      templates: [],
      custom: [],
    },
    artifacts: [],
    approvals: [],
    currentStepId: null,
    currentAgentId: null,
    history: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('StateMachine', () => {
  let sm: StateMachine

  beforeEach(() => {
    sm = createStateMachine()
  })

  it('transitions from INTAKE_PENDING to CONTEXT_LOADING', () => {
    const job = makeJob('INTAKE_PENDING')
    const result = sm.transition(job, 'START_CONTEXT_LOADING')
    expect(result.success).toBe(true)
    expect(result.newStatus).toBe('CONTEXT_LOADING')
  })

  it('transitions from CONTEXT_LOADING to JOB_CREATED', () => {
    const job = makeJob('CONTEXT_LOADING')
    const result = sm.transition(job, 'CREATE_JOB')
    expect(result.success).toBe(true)
    expect(result.newStatus).toBe('JOB_CREATED')
  })

  it('transitions from JOB_CREATED to READY_FOR_EXECUTION', () => {
    const job = makeJob('JOB_CREATED')
    const result = sm.transition(job, 'MARK_READY')
    expect(result.success).toBe(true)
    expect(result.newStatus).toBe('READY_FOR_EXECUTION')
  })

  it('transitions from READY_FOR_EXECUTION to RUNNING_STEP', () => {
    const job = makeJob('READY_FOR_EXECUTION')
    const result = sm.transition(job, 'START_STEP')
    expect(result.success).toBe(true)
    expect(result.newStatus).toBe('RUNNING_STEP')
  })

  it('transitions from RUNNING_STEP to WAITING_APPROVAL', () => {
    const job = makeJob('RUNNING_STEP')
    const result = sm.transition(job, 'STEP_NEEDS_APPROVAL')
    expect(result.success).toBe(true)
    expect(result.newStatus).toBe('WAITING_APPROVAL')
  })

  it('transitions from WAITING_APPROVAL to READY_FOR_EXECUTION on grant', () => {
    const job = makeJob('WAITING_APPROVAL')
    const result = sm.transition(job, 'APPROVAL_GRANTED')
    expect(result.success).toBe(true)
    expect(result.newStatus).toBe('READY_FOR_EXECUTION')
  })

  it('transitions from WAITING_APPROVAL to BLOCKED on rejection', () => {
    const job = makeJob('WAITING_APPROVAL')
    const result = sm.transition(job, 'APPROVAL_REJECTED')
    expect(result.success).toBe(true)
    expect(result.newStatus).toBe('BLOCKED')
  })

  it('rejects invalid transitions', () => {
    const job = makeJob('COMPLETED')
    const result = sm.transition(job, 'START_STEP')
    expect(result.success).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it('blocks via guard function', () => {
    sm.registerTransition({
      from: 'READY_FOR_EXECUTION',
      event: 'CUSTOM_GUARDED_START',
      to: 'RUNNING_STEP',
      guard: () => ({ allowed: false, reason: 'Guard blocked' }),
      description: 'Guarded start',
    })
    const job = makeJob('READY_FOR_EXECUTION')
    const result = sm.transition(job, 'CUSTOM_GUARDED_START')
    expect(result.success).toBe(false)
    expect(result.reason).toBe('Guard blocked')
  })

  it('identifies terminal states correctly', () => {
    expect(sm.isTerminal('COMPLETED')).toBe(true)
    expect(sm.isTerminal('FAILED')).toBe(true)
    expect(sm.isTerminal('RUNNING_STEP')).toBe(false)
    expect(sm.isTerminal('WAITING_APPROVAL')).toBe(false)
  })

  it('lists valid events from a given status', () => {
    const events = sm.validEventsFrom('READY_FOR_EXECUTION')
    expect(events).toContain('START_STEP')
    expect(events).toContain('COMPLETE')
  })

  it('allows registering and using custom transitions', () => {
    sm.registerTransition({
      from: 'RUNNING_STEP',
      event: 'CUSTOM_EVENT',
      to: 'BLOCKED',
      description: 'Custom squad-specific transition',
    })
    const job = makeJob('RUNNING_STEP')
    const result = sm.transition(job, 'CUSTOM_EVENT')
    expect(result.success).toBe(true)
    expect(result.newStatus).toBe('BLOCKED')
  })

  it('transitions through a full happy path', () => {
    const states = [
      ['INTAKE_PENDING', 'START_CONTEXT_LOADING', 'CONTEXT_LOADING'],
      ['CONTEXT_LOADING', 'CREATE_JOB', 'JOB_CREATED'],
      ['JOB_CREATED', 'MARK_READY', 'READY_FOR_EXECUTION'],
      ['READY_FOR_EXECUTION', 'START_STEP', 'RUNNING_STEP'],
      ['RUNNING_STEP', 'STEP_COMPLETE', 'READY_FOR_EXECUTION'],
      ['READY_FOR_EXECUTION', 'COMPLETE', 'COMPLETED'],
    ] as const

    for (const [from, event, expectedTo] of states) {
      const job = makeJob(from as JobDefinition['status'])
      const result = sm.transition(job, event)
      expect(result.success, `Expected ${from} + ${event} → ${expectedTo}`).toBe(true)
      expect(result.newStatus).toBe(expectedTo)
    }
  })
})
