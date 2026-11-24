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
  | { kind: 'unknown' }
  | { kind: 'conflict'; current: GroundJourneyDto | null }
  | { kind: 'gone' }
  | { kind: 'rejected'; message: string }
  | { kind: 'aborted' }

export interface SaveDeps {
  send(command: GroundCommand, signal: AbortSignal): Promise<GroundMutationResult>
  read(id: string, signal: AbortSignal): Promise<GroundJourneyDto>
  operation(key: string, signal: AbortSignal): Promise<GroundOperationStatus>
}

const sessionChanged = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'

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

export type RereadOutcome =
  | { kind: 'read'; current: GroundJourneyDto }
  | { kind: 'gone' }
  | { kind: 'failed' }
  | { kind: 'aborted' }

export async function rereadSaved(
  id: string,
  deps: Pick<SaveDeps, 'read'>,
  signal: AbortSignal,
): Promise<RereadOutcome> {
  try {
    return { kind: 'read', current: await deps.read(id, signal) }
  } catch (error) {
    if (sessionChanged(error)) return { kind: 'aborted' }
    if (error instanceof ApiError && (error.status === 404 || error.status === 410))
      return { kind: 'gone' }
    return { kind: 'failed' }
  }
}

export interface Attempt {
  key: string
  signature: string
}

const signatureOf = (body: CommandBody) => JSON.stringify(body)

export function commandFor(
  body: CommandBody,
  previous: Attempt | null,
  newKey: () => string,
): { command: GroundCommand; attempt: Attempt } {
  const signature = signatureOf(body)
  const key = previous && previous.signature === signature ? previous.key : newKey()
  return { command: { ...body, operationKey: key } as GroundCommand, attempt: { key, signature } }
}

export type SaveState =
  | { phase: 'idle' }
  | { phase: 'saving'; command: GroundCommand }
  | {
      phase: 'unknown'
      command: GroundCommand
      checking: boolean
      notFound: boolean
      checkFailed: boolean
    }
  | {
      phase: 'conflict'
      command: GroundCommand
      current: GroundJourneyDto | null
      reread: 'idle' | 'reading' | 'failed'
    }
  | { phase: 'gone' }
  | { phase: 'rejected'; message: string }

export type SaveEvent =
  | { type: 'start'; command: GroundCommand }
  | { type: 'outcome'; outcome: SaveOutcome; command: GroundCommand }
  | { type: 'check-start' }
  | { type: 'check-done'; outcome: CheckOutcome }
  | { type: 'dismiss' }
  | { type: 'conflict-read'; current: GroundJourneyDto }
  | { type: 'reread-start' }
  | { type: 'reread-done'; failed: boolean }

export function saveReducer(state: SaveState, event: SaveEvent): SaveState {
  switch (event.type) {
    case 'start':
      return { phase: 'saving', command: event.command }
    case 'outcome': {
      const { outcome, command } = event
      if (outcome.kind === 'unknown')
        return { phase: 'unknown', command, checking: false, notFound: false, checkFailed: false }
      if (outcome.kind === 'conflict')
        return { phase: 'conflict', command, current: outcome.current, reread: 'idle' }
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
    case 'conflict-read':
      return state.phase === 'conflict'
        ? { ...state, current: event.current, reread: 'idle' }
        : state
    case 'reread-start':
      return state.phase === 'conflict' ? { ...state, reread: 'reading' } : state
    case 'reread-done':
      return state.phase === 'conflict'
        ? { ...state, reread: event.failed ? 'failed' : 'idle' }
        : state
  }
}
