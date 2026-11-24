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
  | { kind: 'conflict' }
  | { kind: 'gone' }
  | { kind: 'unknown' }
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
  | { kind: 'not-recorded' }
  | { kind: 'failed' }

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
