import type {
  IHostAdapter,
  InterviewTurnInput,
  InterviewTurnState,
} from '../../adapters/host/IHostAdapter.js'

export type InterviewBridgeState = {
  turnCount: number
  history: string[]
}

export type InterviewBridgeResult = {
  content: string
  activeModel: string
  status: 'continue' | 'complete'
}

export class InterviewHostBridgeService {
  async nextTurn(
    hostAdapter: IHostAdapter,
    input: InterviewTurnInput,
    state: InterviewBridgeState,
  ): Promise<InterviewBridgeResult> {
    const adapterState: InterviewTurnState = {
      turnCount: state.turnCount,
      history: state.history,
    }

    const turn = await hostAdapter.runInterviewTurn(input, adapterState)
    const activeModel = (await hostAdapter.getActiveModel()) ?? 'host-default'

    return {
      content: turn.content,
      activeModel,
      status: turn.status,
    }
  }
}
