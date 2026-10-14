// The save flow of a ground journey as a small state machine. A write that returns no usable answer is
// "unknown", never "failed": the frozen command keeps its operation key, so Check result reads the receipt and
// Retry original save replays the very same write. A new create id or key is never a way around it.

import { ApiError } from '@kuuki/client/apiClient'
import type {
  GroundCommand,
  GroundJourneyDto,
  GroundMutationResult,
  GroundOperationStatus,
} from '@kuuki/shared/groundTravel'
import type { CommandBody } from './model'

export type SaveOutcome =
  | { kind: 'saved'; result: GroundMutationResult }
  /** No answer: network loss, timeout or a server error. The write may or may not have committed. */
  | { kind: 'unknown' }
  /** The journey moved on (409). `current` is the saved version when it could be read. */
  | { kind: 'conflict'; current: GroundJourneyDto | null }
  | { kind: 'gone' }
  | { kind: 'rejected'; message: string }
  /** The session changed under the request; the page is leaving, nothing to show. */
  | { kind: 'aborted' }

export interface SaveDeps {
  send(command: GroundCommand, signal: AbortSignal): Promise<GroundMutationResult>
  read(id: string, signal: AbortSignal): Promise<GroundJourneyDto>
  operation(key: string, signal: AbortSignal): Promise<GroundOperationStatus>
}

const sessionChanged = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'

/** Sorts a transport error into the outcome the form can act on. */
export async function classifyFailure(
  error: unknown,
  command: GroundCommand,
  deps: Pick<SaveDeps, 'read'>,
  signal: AbortSignal,
): Promise<SaveOutcome> {
  if (sessionChanged(error)) return { kind: 'aborted' }
  if (error instanceof ApiError) {
    if (error.status === 410) return { kind: 'gone' }
    if (error.status === 409) {
      const embedded = (error.body as { current?: GroundJourneyDto | null } | undefined)?.current
      if (embedded) return { kind: 'conflict', current: embedded }
      try {
        return { kind: 'conflict', current: await deps.read(command.journeyId, signal) }
      } catch {
        return { kind: 'conflict', current: null }
      }
    }
    if (error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429)
      return { kind: 'rejected', message: error.message }
  }
  // Timeouts, network errors, 408/429 and 5xx: the answer is missing, not negative.
  return { kind: 'unknown' }
}

export async function attemptSave(
  command: GroundCommand,
  deps: SaveDeps,
  signal: AbortSignal,
): Promise<SaveOutcome> {
  try {
    return { kind: 'saved', result: await deps.send(command, signal) }
  } catch (error) {
    return classifyFailure(error, command, deps, signal)
  }
}

export type CheckOutcome =
  | { kind: 'saved'; result: Omit<GroundMutationResult, 'replayed'> & { replayed?: boolean } }
  /** No receipt: never written, expired, or another owner's. Retrying the original is safe. */
  | { kind: 'not-found' }
  | { kind: 'failed' }
  | { kind: 'aborted' }

export async function checkSave(
  command: GroundCommand,
  deps: SaveDeps,
  signal: AbortSignal,
): Promise<CheckOutcome> {
  try {
    const status = await deps.operation(command.operationKey, signal)
    if (status.status === 'unknown') return { kind: 'not-found' }
    const { status: _status, ...result } = status
    return { kind: 'saved', result: { ...result, outcome: status.status } }
  } catch (error) {
    return sessionChanged(error) ? { kind: 'aborted' } : { kind: 'failed' }
  }
}

// ---------------------------------------------------------------------------
// Operation keys
// ---------------------------------------------------------------------------

export interface Attempt {
  key: string
  /** The command body the key was issued for. */
  signature: string
}

const signatureOf = (body: CommandBody) => JSON.stringify(body)

/**
 * The same payload keeps the same operation key across resubmits (double click, retry after an error); a changed
 * payload is a different request and gets a new one. The server rejects a reused key with a different payload.
 */
export function commandFor(
  body: CommandBody,
  previous: Attempt | null,
  newKey: () => string,
): { command: GroundCommand; attempt: Attempt } {
  const signature = signatureOf(body)
  const key = previous && previous.signature === signature ? previous.key : newKey()
  return { command: { ...body, operationKey: key } as GroundCommand, attempt: { key, signature } }
}

// ---------------------------------------------------------------------------
// UI state
// ---------------------------------------------------------------------------

export type SaveState =
  | { phase: 'idle' }
  | { phase: 'saving'; command: GroundCommand }
  | {
      phase: 'unknown'
      /** The frozen request: shown, re-sent or checked as is; later edits never replace it. */
      command: GroundCommand
      checking: boolean
      /** The receipt lookup found nothing, so the original write can be retried. */
      notFound: boolean
      checkFailed: boolean
    }
  | { phase: 'conflict'; command: GroundCommand; current: GroundJourneyDto | null }
  | { phase: 'gone' }
  | { phase: 'rejected'; message: string }

export type SaveEvent =
  | { type: 'start'; command: GroundCommand }
  | { type: 'outcome'; outcome: SaveOutcome; command: GroundCommand }
  | { type: 'check-start' }
  | { type: 'check-done'; outcome: CheckOutcome }
  | { type: 'dismiss' }

/** `saved` and `aborted` are handled by the caller (navigate / nothing); the reducer returns to idle for them. */
export function saveReducer(state: SaveState, event: SaveEvent): SaveState {
  switch (event.type) {
    case 'start':
      return { phase: 'saving', command: event.command }
    case 'outcome': {
      const { outcome, command } = event
      if (outcome.kind === 'unknown')
        return { phase: 'unknown', command, checking: false, notFound: false, checkFailed: false }
      if (outcome.kind === 'conflict')
        return { phase: 'conflict', command, current: outcome.current }
      if (outcome.kind === 'gone') return { phase: 'gone' }
      if (outcome.kind === 'rejected') return { phase: 'rejected', message: outcome.message }
      return { phase: 'idle' }
    }
    case 'check-start':
      return state.phase === 'unknown'
        ? { ...state, checking: true, notFound: false, checkFailed: false }
        : state
    case 'check-done':
      if (state.phase !== 'unknown') return state
      if (event.outcome.kind === 'saved' || event.outcome.kind === 'aborted')
        return { phase: 'idle' }
      return {
        ...state,
        checking: false,
        notFound: event.outcome.kind === 'not-found',
        checkFailed: event.outcome.kind === 'failed',
      }
    case 'dismiss':
      return { phase: 'idle' }
  }
}
