/**
 * Squad Foundry — Explicit State Machine
 *
 * Manages valid job state transitions. All transitions are declared explicitly —
 * no implicit or magical state changes. Each transition can carry a guard function
 * that must return true for the transition to proceed.
 *
 * Squads can extend the base transitions with custom ones via registerTransition().
 */

import type { JobStatus, JobDefinition, GuardrailResult } from './types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Transition Events
// ─────────────────────────────────────────────────────────────────────────────

export type TransitionEvent =
  | 'START_CONTEXT_LOADING'
  | 'CONTEXT_LOADED'
  | 'START_SQUAD_DESIGN'
  | 'SQUAD_DESIGN_COMPLETE'
  | 'CREATE_JOB'
  | 'REQUEST_USER_INPUT'
  | 'USER_INPUT_RECEIVED'
  | 'MARK_READY'
  | 'START_STEP'
  | 'STEP_COMPLETE'
  | 'STEP_NEEDS_APPROVAL'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'
  | 'GUARDRAIL_BLOCKED'
  | 'GUARDRAIL_CLEARED'
  | 'FAIL'
  | 'COMPLETE'
  | string // custom squad events

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GuardFn = (job: JobDefinition) => GuardResult

export interface GuardResult {
  allowed: boolean
  reason?: string
  guardrailResults?: GuardrailResult[]
}

export interface TransitionDef {
  from: JobStatus | JobStatus[]
  event: TransitionEvent
  to: JobStatus
  guard?: GuardFn
  description: string
}

export interface TransitionResult {
  success: boolean
  previousStatus: JobStatus
  newStatus: JobStatus
  event: TransitionEvent
  reason?: string
  guardrailResults?: GuardrailResult[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Base Transitions
// ─────────────────────────────────────────────────────────────────────────────

const BASE_TRANSITIONS: TransitionDef[] = [
  {
    from: 'INTAKE_PENDING',
    event: 'START_CONTEXT_LOADING',
    to: 'CONTEXT_LOADING',
    description: 'Begin loading context files from filesystem',
  },
  {
    from: 'CONTEXT_LOADING',
    event: 'CONTEXT_LOADED',
    to: 'SQUAD_DESIGNING',
    description: 'Context loaded — begin squad design interview',
  },
  {
    from: 'CONTEXT_LOADING',
    event: 'CREATE_JOB',
    to: 'JOB_CREATED',
    description: 'Context loaded for existing squad — create job directly',
  },
  {
    from: 'SQUAD_DESIGNING',
    event: 'SQUAD_DESIGN_COMPLETE',
    to: 'SQUAD_READY',
    description: 'Squad definition generated and approved',
  },
  {
    from: 'SQUAD_DESIGNING',
    event: 'REQUEST_USER_INPUT',
    to: 'WAITING_USER_INPUT',
    description: 'Need more information from user during design',
  },
  {
    from: 'SQUAD_READY',
    event: 'CREATE_JOB',
    to: 'JOB_CREATED',
    description: 'Squad ready — create a new job',
  },
  {
    from: 'JOB_CREATED',
    event: 'MARK_READY',
    to: 'READY_FOR_EXECUTION',
    description: 'Job initialized and all preconditions met',
  },
  {
    from: 'JOB_CREATED',
    event: 'REQUEST_USER_INPUT',
    to: 'WAITING_USER_INPUT',
    description: 'Job created but needs user clarification before starting',
  },
  {
    from: 'WAITING_USER_INPUT',
    event: 'USER_INPUT_RECEIVED',
    to: 'READY_FOR_EXECUTION',
    description: 'User provided required input — ready to proceed',
  },
  {
    from: 'READY_FOR_EXECUTION',
    event: 'START_STEP',
    to: 'RUNNING_STEP',
    description: 'Beginning execution of the next workflow step',
  },
  {
    from: 'RUNNING_STEP',
    event: 'STEP_COMPLETE',
    to: 'READY_FOR_EXECUTION',
    description: 'Step completed — ready for next step',
  },
  {
    from: 'RUNNING_STEP',
    event: 'STEP_NEEDS_APPROVAL',
    to: 'WAITING_APPROVAL',
    description: 'Step output requires human approval before proceeding',
  },
  {
    from: 'RUNNING_STEP',
    event: 'GUARDRAIL_BLOCKED',
    to: 'BLOCKED',
    description: 'A guardrail blocked this step from continuing',
  },
  {
    from: 'RUNNING_STEP',
    event: 'REQUEST_USER_INPUT',
    to: 'WAITING_USER_INPUT',
    description: 'Agent needs user clarification during execution',
  },
  {
    from: 'RUNNING_STEP',
    event: 'FAIL',
    to: 'FAILED',
    description: 'Step failed critically',
  },
  {
    from: 'WAITING_APPROVAL',
    event: 'APPROVAL_GRANTED',
    to: 'READY_FOR_EXECUTION',
    description: 'Human approved — continue workflow',
  },
  {
    from: 'WAITING_APPROVAL',
    event: 'APPROVAL_REJECTED',
    to: 'BLOCKED',
    description: 'Human rejected — block workflow',
  },
  {
    from: 'BLOCKED',
    event: 'GUARDRAIL_CLEARED',
    to: 'READY_FOR_EXECUTION',
    description: 'Blocking condition resolved — resume',
  },
  {
    from: 'BLOCKED',
    event: 'FAIL',
    to: 'FAILED',
    description: 'Block was unresolvable — fail job',
  },
  {
    from: ['READY_FOR_EXECUTION', 'RUNNING_STEP'],
    event: 'COMPLETE',
    to: 'COMPLETED',
    description: 'All steps done — job complete',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// State Machine
// ─────────────────────────────────────────────────────────────────────────────

export class StateMachine {
  private transitions: TransitionDef[] = [...BASE_TRANSITIONS]

  /**
   * Register a custom transition (e.g., for squad-specific states).
   */
  registerTransition(transition: TransitionDef): void {
    this.transitions.push(transition)
  }

  /**
   * Attempt a state transition. Returns a result with success/failure and reason.
   */
  transition(
    job: JobDefinition,
    event: TransitionEvent,
  ): TransitionResult {
    const currentStatus = job.status
    const previousStatus = currentStatus

    // Find a matching transition
    const match = this.transitions.find((t) => {
      const fromStates = Array.isArray(t.from) ? t.from : [t.from]
      return fromStates.includes(currentStatus) && t.event === event
    })

    if (!match) {
      return {
        success: false,
        previousStatus,
        newStatus: currentStatus,
        event,
        reason: `No transition found for state '${currentStatus}' + event '${event}'`,
      }
    }

    // Run guard if present
    if (match.guard) {
      const guardResult = match.guard(job)
      if (!guardResult.allowed) {
        return {
          success: false,
          previousStatus,
          newStatus: currentStatus,
          event,
          reason: guardResult.reason ?? 'Guard function blocked transition',
          guardrailResults: guardResult.guardrailResults,
        }
      }
    }

    return {
      success: true,
      previousStatus,
      newStatus: match.to,
      event,
    }
  }

  /**
   * Get all valid events from a given status.
   */
  validEventsFrom(status: JobStatus): TransitionEvent[] {
    return this.transitions
      .filter((t) => {
        const fromStates = Array.isArray(t.from) ? t.from : [t.from]
        return fromStates.includes(status)
      })
      .map((t) => t.event)
  }

  /**
   * Check whether a job is in a terminal state.
   */
  isTerminal(status: JobStatus): boolean {
    return status === 'COMPLETED' || status === 'FAILED'
  }

  /**
   * Check whether a given transition is defined (ignoring guards).
   */
  canTransition(fromStatus: JobStatus, event: TransitionEvent): boolean {
    return this.transitions.some((t) => {
      const fromStates = Array.isArray(t.from) ? t.from : [t.from]
      return fromStates.includes(fromStatus) && t.event === event
    })
  }

  /**
   * Get all registered transitions (for diagnostics).
   */
  getAllTransitions(): Readonly<TransitionDef[]> {
    return this.transitions
  }
}

/**
 * Singleton factory — one machine per process.
 * Squads register custom transitions on startup.
 */
export function createStateMachine(): StateMachine {
  return new StateMachine()
}
