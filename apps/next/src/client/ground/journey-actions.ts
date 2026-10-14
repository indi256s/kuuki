// The detail sheet's write steps without React: one command per action, a fresh operation key per attempt, and an
// outcome the UI can switch on. A command whose answer was lost keeps its key, so a retry replays the original write
// instead of making a second one (page-flow contract "Сохранение и восстановление").

import { ApiError } from '@kuuki/client/apiClient'
import type {
  GroundCommand,
  GroundJourneyDto,
  GroundMutationResult,
  GroundOperationStatus,
} from '@kuuki/shared/groundTravel'
import { readOperation, sendCommand } from './api'

export type SheetAction = 'cancel' | 'restore' | 'reopen' | 'delete'

export type PendingCommand = {
  action: SheetAction
  operationKey: string
  journeyId: string
  expectedVersion: number
}

export type Outcome =
  | { kind: 'saved'; result: GroundMutationResult }
  /** 409: the journey changed since it was loaded (or is no longer in the state the action needs). */
  | { kind: 'conflict' }
  /** 404 / 410: the journey is gone for this owner. */
  | { kind: 'gone' }
  /** The answer was lost (network, timeout, 5xx). The command may or may not have been written. */
  | { kind: 'unknown' }
  /** Any other refusal; nothing was written. */
  | { kind: 'rejected'; message: string }

export function startCommand(
  action: SheetAction,
  journey: Pick<GroundJourneyDto, 'id' | 'version'>,
): PendingCommand {
  return {
    action,
    operationKey: crypto.randomUUID(),
    journeyId: journey.id,
    expectedVersion: journey.version,
  }
}

const toCommand = (pending: PendingCommand): GroundCommand => ({
  action: pending.action,
  operationKey: pending.operationKey,
  journeyId: pending.journeyId,
  expectedVersion: pending.expectedVersion,
})

/** Sends (or re-sends, with the same key) one command and classifies the answer. Never throws. */
export async function runCommand(pending: PendingCommand, signal?: AbortSignal): Promise<Outcome> {
  try {
    return { kind: 'saved', result: await sendCommand(toCommand(pending), { signal }) }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 409) return { kind: 'conflict' }
      if (error.status === 404 || error.status === 410) return { kind: 'gone' }
      if (error.status >= 500 || error.status === 408 || error.status === 429)
        return { kind: 'unknown' }
      return { kind: 'rejected', message: error.message }
    }
    return { kind: 'unknown' }
  }
}

export type Resolution =
  | { kind: 'applied'; status: Extract<GroundOperationStatus, { status: 'saved' | 'deleted' }> }
  /** No receipt: the command was never written (or the receipt expired). */
  | { kind: 'not-recorded' }
  | { kind: 'failed' }

/** "Check result": asks the server what became of a command whose answer was lost. */
export async function resolveCommand(
  pending: PendingCommand,
  signal?: AbortSignal,
): Promise<Resolution> {
  try {
    const status = await readOperation(pending.operationKey, { signal })
    return status.status === 'unknown' ? { kind: 'not-recorded' } : { kind: 'applied', status }
  } catch {
    return { kind: 'failed' }
  }
}
