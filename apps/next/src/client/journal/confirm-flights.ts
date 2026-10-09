// "I flew" for any set of Journal flights (spec "Selection and bulk actions", D1, D5). Shared by the bulk bar and the
// review-mode sheet (ticket 12). Extracted from `reads/journal-queue.tsx`, which ticket 17 retires.
//
// API
// - `partitionPending(flights)` splits flights by the lifecycle the client last saw: `awaiting` (can be confirmed or
//   marked "Did not fly"), `upcoming` and `notAwaiting` (already logged). Pure; use it for labels and counts.
// - `confirmFlights({ flights, queue?, arrivalTransit?, signal?, transport? })` confirms the awaiting ones:
//   1. Upcoming and logged flights are skipped and reported, never sent.
//   2. Candidate tokens come from the awaiting queue (`GET /api/me/awaiting`, the first 100 awaiting flights). The
//      queue the caller already holds (`useAwaiting().data`) is tried first; it is read again when it lacks tokens for
//      the remaining flights, after each committed batch (the next 100 appear), and after a 409 (see 4).
//   3. `POST /api/flights/confirm` takes at most 100 items and is all or nothing, so the flights go in batches of up
//      to 100, one after another, each with its own `operationId`.
//   4. A 409 (`STATE_CONFLICT`: some flight is no longer awaiting; `CANDIDATES_CHANGED`: a token is stale) committed
//      nothing: the queue is read again and the batch rebuilt, at most twice in a row. Flights that left the queue
//      are then reported in `skipped.notAwaiting` (the queue is complete) or `skipped.noToken` (it is not).
//   5. A lost answer (network, 408, 5xx) may have committed: the same request is replayed once (the server answers a
//      known `operationId` from its receipt). Still lost: outcome `unknown`. Any other 4xx: `rejected`.
//   6. A response that arrives after sign-out or an owner switch (auth generation changed) or after `signal` aborts
//      is dropped: outcome `stale`, nothing else is reported. The request is registered with
//      `trackPrivateOperation`, so an identity reset aborts it.
//   It never waits for publication; the result carries `derivedState` and the caller refreshes its reads.
// - "Did not fly" is not a server call here. Spec D1: it is the 6 s deferred delete (`useDeferredDelete`) of
//   `partitionPending(flights).awaiting`.
import { api, ApiError, getAuthGeneration } from '@kuuki/client/apiClient'
import type {
  ConfirmOutcome,
  ConfirmRequest,
} from '../../../../../functions/api/_services/confirmation'
import { trackPrivateOperation } from '../activity'
import type { AwaitingQueue } from '../awaiting'
import type { JournalFlight } from './model'

/** `MAX_CONFIRM_ITEMS` (= `QUEUE_PAGE_LIMIT`) in `functions/api/_services/confirmation.ts`. */
export const CONFIRM_BATCH = 100
const MAX_CONFLICT_RETRIES = 2

export type PendingFlight = Pick<JournalFlight, 'id' | 'lifecycle_state'>

export type PendingPartition = { awaiting: number[]; upcoming: number[]; notAwaiting: number[] }

/** Splits flight ids by lifecycle, keeping their order. */
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
  /** The flights the member picked, with the lifecycle the client last saw. */
  flights: readonly PendingFlight[]
  /** The awaiting queue already loaded, if any. */
  queue?: AwaitingQueue | null
  /** "Left the airport" per flight; a flight not in the map takes the queue's effective default. */
  arrivalTransit?: ReadonlyMap<number, boolean>
  signal?: AbortSignal
  /** Test seam; defaults to the API client. */
  transport?: ConfirmTransport
}

/**
 * - `confirmed`: every awaiting flight was confirmed, or the ones not confirmed were skipped (see `skipped`).
 * - `nothing`: nothing was confirmed and nothing failed (no awaiting flights, or none of them could be sent).
 * - `partial`: some batches committed, then one was rejected or lost (`failed` holds the rest).
 * - `rejected`: the server refused before anything committed. Nothing changed.
 * - `unknown`: the only answer was lost: the flights in `failed` may or may not be confirmed.
 * - `stale`: aborted or the session changed. Drop the result.
 */
export type ConfirmFlightsOutcome =
  | 'confirmed'
  | 'nothing'
  | 'partial'
  | 'rejected'
  | 'unknown'
  | 'stale'

export type ConfirmFlightsResult = {
  outcome: ConfirmFlightsOutcome
  /** Ids the server confirmed, in the order they were sent. */
  confirmed: number[]
  skipped: {
    /** Upcoming in the client's list. */
    upcoming: number[]
    /** Logged in the client's list, or gone from a complete awaiting queue (confirmed elsewhere, auto-confirmed, deleted). */
    notAwaiting: number[]
    /** Awaiting but without a candidate token: beyond the queue's first 100, or the queue could not be read. */
    noToken: number[]
  }
  /** Awaiting flights a rejected or lost batch left unconfirmed (or possibly confirmed, for `unknown`). */
  failed: number[]
  /** `pending` when any committed batch is still being published; null when nothing committed. */
  derivedState: 'ready' | 'pending' | null
  /** Countries the confirmed flights pressed, when every batch could tell; otherwise null. */
  newlyStampedCountries: string[] | null
  /** The status and code of the failure behind `partial`, `rejected` or `unknown`. */
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
  /** Whether `queue` was read after the last change this run made. */
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
          break // No tokens to be had: the rest are reported as noToken.
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
          // The answer was lost, not refused: replay the same operation once and let its receipt say what happened.
          outcome = await transport.confirm(request, controller.signal)
        }
      } catch (cause) {
        if (!current()) return stale()
        if (conflict(cause) && conflicts < MAX_CONFLICT_RETRIES) {
          // All or nothing: this batch committed nothing. Read the queue again and rebuild it.
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
      // The confirmed flights left the queue and the next ones may have entered it.
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
    // Left over without a token. A complete queue (every awaiting flight listed) proves they are no longer awaiting.
    const complete =
      fresh && queue !== null && queue.awaitingFlights.length >= queue.awaitingFlightCount
    if (complete) result.skipped.notAwaiting.push(...remaining)
    else result.skipped.noToken = remaining
    result.outcome = result.confirmed.length ? 'confirmed' : 'nothing'
  }
  if (!result.confirmed.length) result.newlyStampedCountries = null
  return result
}
