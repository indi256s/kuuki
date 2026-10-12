// The synchronous import batch writer (ADR 0001 §6, controller ruling R3): one provider call in the request,
// then the batch and all its drafts in one fenced D1 batch. Idempotent on the submission operation id.
//
// Nothing about the source is persisted: the content lives in this call's memory only, `raw_text` is dropped and
// the provider response never leaves `extractFlights`.
import { jobStub } from './importRuntime'
import { HttpError } from '../_lib/http'
import { extractFlights } from '../import/_extract'
import { parseStructuredText } from '../import/_text'
import type { ExtractedFlight, ParseRequest } from '../import/_shared'
import { isCalendarDate } from '../../../packages/shared/src/flightValidation'
import {
  MAX_DRAFTS_DETERMINISTIC,
  MAX_DRAFTS_MODEL,
  batchByOperation,
  createProcessingBatch,
  ownedBatch,
  draftFieldsOf,
  persistDraftRows,
  readBatchSnapshot,
  refusalFor,
  type BatchFence,
  type BatchSnapshot,
  type DraftRowInput,
  type FinalState,
} from './importDrafts'

export interface ImportSubmission {
  userId: string
  operationId: string
  sourceLabel: string | null
  /** Quick Add online fallback: every draft of this batch carries the `flown_required` marker. */
  requireFlownConfirmation?: boolean
}

/** Boarding-pass legs the browser decoded: already normalized draft rows that skip extraction and the job. */
export interface LocalLegs {
  sourceType: 'pdf' | 'image'
  rows: DraftRowInput[]
  incomplete: boolean
}

const SCORE_KEYS = [
  'date',
  'origin',
  'destination',
  'airline_iata',
  'flight_number',
  'aircraft_icao',
  'departure_time',
  'arrival_time',
] as const

export function rowOf(
  flight: ExtractedFlight,
  { flownRequired = false }: { flownRequired?: boolean } = {},
): DraftRowInput {
  const yearExplicit = flight.field_confidence?.date_year_explicit === true
  const scores: Record<string, number> = {}
  for (const key of SCORE_KEYS) {
    const value = flight.field_confidence?.[key]
    if (typeof value === 'number' && Number.isFinite(value))
      scores[key] = Math.min(1, Math.max(0, value))
  }
  const fields = draftFieldsOf(flight)
  if (flownRequired) fields.flown_required = true
  return {
    fields,
    confidence:
      typeof flight.confidence === 'number' && Number.isFinite(flight.confidence)
        ? Math.min(1, Math.max(0, flight.confidence))
        : null,
    fieldConfidence: Object.keys(scores).length ? scores : null,
    yearExplicit,
    // Uncertain required facts wait for the member's decision.
    selected:
      (flight.verification === undefined || flight.verification === 'verified') &&
      yearExplicit &&
      isCalendarDate(flight.date) &&
      Boolean(flight.origin && flight.destination) &&
      flight.airline_was_placeholder !== true &&
      flight.review_required !== true &&
      flight.confidence >= 0.7 &&
      !['date', 'origin', 'destination', 'airline_iata'].some(
        (key) => scores[key] !== undefined && scores[key] < 0.7,
      ),
  }
}

async function stillWaitingForStart(db: D1Database, fence: BatchFence) {
  const batch = await ownedBatch(db, fence.userId, fence.batchId)
  return (
    batch?.status === 'processing' &&
    batch.generation === fence.generation &&
    batch.stage === 'accepted'
  )
}

const discarded = () => new HttpError(410, 'This import was discarded', 'IMPORT_BATCH_DISCARDED')

/**
 * Replay, refuse at a limit, or extract and persist. `created` is false for a replayed submission. Local legs are
 * persisted synchronously with no provider call and no job, so they need neither a credential nor `IMPORT_JOBS`.
 */
export async function submitImport(
  env: Env,
  source: ParseRequest | LocalLegs,
  { userId, operationId, sourceLabel, requireFlownConfirmation }: ImportSubmission,
  now: Date,
): Promise<{ created: boolean; snapshot: BatchSnapshot }> {
  const db = env.DB
  const parse = 'rows' in source ? null : source
  const accept = async (fence: BatchFence) => {
    if (!env.IMPORT_JOBS || !parse) return
    try {
      const response = await jobStub(env.IMPORT_JOBS, fence).fetch(
        'https://import.internal/start',
        {
          method: 'POST',
          body: JSON.stringify({ fence, source: parse, requireFlownConfirmation }),
        },
      )
      // A refused handshake is not an outage when the batch has moved on: the original job may have finished or been
      // cancelled between this request's read and its handshake. D1 is the authority, so only a batch still waiting
      // for its first start counts as a failed dispatch.
      if (!response.ok && (await stillWaitingForStart(db, fence)))
        throw new HttpError(503, 'Import service unavailable', 'IMPORT_SERVICE_UNAVAILABLE')
    } catch {
      await persistDraftRows(db, fence, [], {
        status: 'failed',
        errorCode: 'IMPORT_SERVICE_UNAVAILABLE',
      })
      throw new HttpError(503, 'Import service unavailable', 'IMPORT_SERVICE_UNAVAILABLE')
    }
  }
  const replay = async () => {
    const existing = await batchByOperation(db, userId, operationId)
    if (!existing) return null
    // An insert can become visible before its first dispatcher has established ownership.
    // Repeating the handshake is safe: the DO serializes starts and calls the provider once.
    if (env.IMPORT_JOBS && existing.status === 'processing' && existing.stage === 'accepted') {
      await accept({ userId, batchId: existing.id, generation: existing.generation })
    }
    const snapshot = await readBatchSnapshot(db, userId, existing.id, now)
    if (!snapshot) throw discarded()
    return { created: false, snapshot }
  }
  const replayed = await replay()
  if (replayed) return replayed
  if (
    parse &&
    !env.IMPORT_JOBS &&
    !env.GEMINI_API_KEY &&
    !(parse.type === 'text' && parseStructuredText(parse.content))
  )
    throw new HttpError(503, 'Import service unavailable', 'IMPORT_SERVICE_UNAVAILABLE')

  const batchId = crypto.randomUUID()
  if (
    !(await createProcessingBatch(
      db,
      {
        id: batchId,
        userId,
        sourceType: 'rows' in source ? source.sourceType : source.type,
        sourceLabel,
        operationId,
      },
      now,
    ))
  ) {
    const raced = await replay() // another request of the same submission won the insert
    if (raced) return raced
    throw await refusalFor(db, userId, now)
  }
  const fence: BatchFence = { userId, batchId, generation: 1 }

  if (env.IMPORT_JOBS && parse) {
    await accept(fence)
    const snapshot = await readBatchSnapshot(db, userId, batchId, new Date())
    if (!snapshot) throw discarded()
    return { created: true, snapshot }
  }
  let rows: DraftRowInput[] = []
  let final: FinalState
  const limit =
    parse?.type === 'text' && parseStructuredText(parse.content)
      ? MAX_DRAFTS_DETERMINISTIC
      : MAX_DRAFTS_MODEL
  if ('rows' in source) {
    rows = source.rows
    final = source.incomplete
      ? { status: 'partial', errorCode: 'ROWS_REJECTED' }
      : { status: 'review', errorCode: null }
  } else
    try {
      const result = await extractFlights(env, source)
      rows = result.flights.map((flight) =>
        rowOf(flight, { flownRequired: requireFlownConfirmation }),
      )
      if (result.flights.length === 0) final = { status: 'failed', errorCode: 'NO_FLIGHTS_FOUND' }
      else if (result.flights.length > limit)
        final = { status: 'partial', errorCode: 'ROWS_TRUNCATED' }
      else if (result.rejected?.length) final = { status: 'partial', errorCode: 'ROWS_REJECTED' }
      else final = { status: 'review', errorCode: null }
    } catch (error) {
      rows = []
      if (!(error instanceof HttpError))
        console.error(JSON.stringify({ event: 'import_job_error', code: 'INTERNAL' }))
      final = {
        status: 'failed',
        errorCode: error instanceof HttpError && error.code ? error.code : 'INTERNAL',
      }
    }
  await persistDraftRows(db, fence, rows, final, new Date(), { limit })
  const snapshot = await readBatchSnapshot(db, userId, batchId, new Date())
  if (!snapshot) throw discarded()
  return { created: true, snapshot }
}
