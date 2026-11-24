import { api, ApiError, getAuthGeneration } from '@kuuki/client/apiClient'
import type {
  ConfirmOutcome,
  ConfirmRequest,
} from '../../../../../functions/api/_services/confirmation'
import { trackPrivateOperation } from '../activity'
import type { AwaitingQueue } from '../awaiting'
import type { JournalFlight } from './model'

export const CONFIRM_BATCH = 100
const MAX_CONFLICT_RETRIES = 2

export type PendingFlight = Pick<JournalFlight, 'id' | 'lifecycle_state'>

export type PendingPartition = { awaiting: number[]; upcoming: number[]; notAwaiting: number[] }

export function partitionPending(flights: readonly PendingFlight[]): PendingPartition {
  const out: PendingPartition = { awaiting: [], upcoming: [], notAwaiting: [] }
  for (const flight of flights) {
    if (flight.lifecycle_state === 'awaiting') out.awaiting.push(flight.id)
    else if (flight.lifecycle_state === 'upcoming') out.upcoming.push(flight.id)
    else out.notAwaiting.push(flight.id)
  }
  return out
}

export type ConfirmTransport = {
  readQueue: (signal: AbortSignal) => Promise<AwaitingQueue>
  confirm: (request: ConfirmRequest, signal: AbortSignal) => Promise<ConfirmOutcome>
}

const defaultTransport: ConfirmTransport = {
  readQueue: (signal) => api.get<AwaitingQueue>('/api/me/awaiting', undefined, { signal }),
  confirm: (request, signal) =>
    api.post<ConfirmOutcome>('/api/flights/confirm', request, { signal }),
}

export type ConfirmFlightsOptions = {
  flights: readonly PendingFlight[]
  queue?: AwaitingQueue | null
  arrivalTransit?: ReadonlyMap<number, boolean>
  signal?: AbortSignal
  transport?: ConfirmTransport
}

export type ConfirmFlightsOutcome =
  | 'confirmed'
  | 'nothing'
  | 'partial'
  | 'rejected'
  | 'unknown'
  | 'stale'

export type ConfirmFlightsResult = {
  outcome: ConfirmFlightsOutcome
  confirmed: number[]
  skipped: {
    upcoming: number[]
    notAwaiting: number[]
    noToken: number[]
  }
  failed: number[]
  derivedState: 'ready' | 'pending' | null
  newlyStampedCountries: string[] | null
  error: { status: number | null; code: string | null } | null
}

const lost = (cause: unknown) =>
  !(cause instanceof ApiError) || cause.status === 408 || cause.status >= 500
const conflict = (cause: unknown) => cause instanceof ApiError && cause.status === 409

export async function confirmFlights({
  flights,
  queue: given = null,
  arrivalTransit,
  signal,
  transport = defaultTransport,
}: ConfirmFlightsOptions): Promise<ConfirmFlightsResult> {
  const parts = partitionPending(flights)
  const result: ConfirmFlightsResult = {
    outcome: 'nothing',
    confirmed: [],
    skipped: { upcoming: parts.upcoming, notAwaiting: [...parts.notAwaiting], noToken: [] },
    failed: [],
    derivedState: null,
    newlyStampedCountries: [],
    error: null,
  }
  const stale = (): ConfirmFlightsResult => ({ ...result, outcome: 'stale' })
  if (parts.awaiting.length === 0) return { ...result, newlyStampedCountries: null }

  const generation = getAuthGeneration()
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) return stale()
  signal?.addEventListener('abort', abort, { once: true })
  const release = trackPrivateOperation(controller)
  const current = () => !controller.signal.aborted && generation === getAuthGeneration()

  const remaining = [...parts.awaiting]
  let queue: AwaitingQueue | null = given
  let fresh = false
  let conflicts = 0
  let failure: unknown = null
  try {
    for (;;) {
      if (!remaining.length) break
      if (!queue) {
        try {
          queue = await transport.readQueue(controller.signal)
        } catch {
          if (!current()) return stale()
          break
        }
        if (!current()) return stale()
        fresh = true
      }
      const tokens = new Map(
        queue.awaitingFlights.map((entry) => [entry.flight.id, entry.candidateToken]),
      )
      const batch = remaining.filter((id) => tokens.has(id)).slice(0, CONFIRM_BATCH)
      if (!batch.length) {
        if (fresh) break
        queue = null
        continue
      }
      const request: ConfirmRequest = {
        operationId: crypto.randomUUID(),
        items: batch.map((flightId) => {
          const transit = arrivalTransit?.get(flightId)
          return {
            flightId,
            candidateToken: tokens.get(flightId)!,
            ...(transit === undefined ? {} : { arrivalTransit: transit }),
          }
        }),
      }
      let outcome: ConfirmOutcome
      try {
        try {
          outcome = await transport.confirm(request, controller.signal)
        } catch (cause) {
          if (!current()) return stale()
          if (!lost(cause)) throw cause
          outcome = await transport.confirm(request, controller.signal)
        }
      } catch (cause) {
        if (!current()) return stale()
        if (conflict(cause) && conflicts < MAX_CONFLICT_RETRIES) {
          conflicts += 1
          queue = null
          fresh = false
          continue
        }
        failure = cause
        break
      }
      if (!current()) return stale()
      conflicts = 0
      const done = new Set(outcome.results.map((row) => row.flightId))
      result.confirmed.push(...batch.filter((id) => done.has(id)))
      for (let index = remaining.length - 1; index >= 0; index--)
        if (batch.includes(remaining[index]!)) remaining.splice(index, 1)
      result.derivedState =
        result.derivedState === 'pending' || outcome.derivedState === 'pending'
          ? 'pending'
          : 'ready'
      result.newlyStampedCountries =
        outcome.newlyStampedCountries && result.newlyStampedCountries
          ? [...new Set([...result.newlyStampedCountries, ...outcome.newlyStampedCountries])]
          : null
      fresh = false
    }
  } finally {
    signal?.removeEventListener('abort', abort)
    release()
  }

  if (failure) {
    result.failed = remaining
    result.error = {
      status: failure instanceof ApiError ? failure.status : null,
      code: failure instanceof ApiError ? (failure.code ?? null) : null,
    }
    result.outcome = result.confirmed.length ? 'partial' : lost(failure) ? 'unknown' : 'rejected'
  } else {
    const complete =
      fresh && queue !== null && queue.awaitingFlights.length >= queue.awaitingFlightCount
    if (complete) result.skipped.notAwaiting.push(...remaining)
    else result.skipped.noToken = remaining
    result.outcome = result.confirmed.length ? 'confirmed' : 'nothing'
  }
  if (!result.confirmed.length) result.newlyStampedCountries = null
  return result
}
