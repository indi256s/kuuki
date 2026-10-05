// The synchronous import batch writer (ADR 0001 §6, controller ruling R3): one provider call in the request,
// then the batch and all its drafts in one fenced D1 batch. Idempotent on the submission operation id.
//
// Nothing about the source is persisted: the content lives in this call's memory only, `raw_text` is dropped and
// the provider response never leaves `extractFlights`.
import { jobStub } from './importRuntime'
import { HttpError } from '../_lib/http'
import { extractFlights } from '../import/_extract'
import type { ExtractedFlight, ParseRequest } from '../import/_shared'
import {
  MAX_DRAFTS_PER_BATCH, batchByOperation, createProcessingBatch, ownedBatch, draftFieldsOf, persistDraftRows, readBatchSnapshot, refusalFor,
  type BatchFence, type BatchSnapshot, type DraftRowInput, type FinalState,
} from './importDrafts'

export interface ImportSubmission {
  userId: string
  operationId: string
  sourceLabel: string | null
}

const SCORE_KEYS = ['date', 'origin', 'destination', 'airline_iata', 'flight_number', 'aircraft_icao', 'departure_time', 'arrival_time'] as const

export function rowOf(flight: ExtractedFlight): DraftRowInput {
  const yearExplicit = flight.field_confidence?.date_year_explicit === true
  const scores: Record<string, number> = {}
  for (const key of SCORE_KEYS) {
    const value = flight.field_confidence?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) scores[key] = Math.min(1, Math.max(0, value))
  }
  return {
    fields: draftFieldsOf(flight),
    confidence: typeof flight.confidence === 'number' && Number.isFinite(flight.confidence) ? Math.min(1, Math.max(0, flight.confidence)) : null,
    fieldConfidence: Object.keys(scores).length ? scores : null,
    yearExplicit,
    // Same default as the browser draft: an unknown year or a placeholder airline waits for the member's decision.
    selected: yearExplicit && flight.airline_was_placeholder !== true,
  }
}

async function stillWaitingForStart(db: D1Database, fence: BatchFence) {
  const batch = await ownedBatch(db, fence.userId, fence.batchId)
  return batch?.status === 'processing' && batch.generation === fence.generation && batch.stage === 'accepted'
}

const discarded = () => new HttpError(410, 'This import was discarded', 'IMPORT_BATCH_DISCARDED')

/** Replay, refuse at a limit, or extract and persist. `created` is false for a replayed submission. */
export async function submitImport(
  env: Env, source: ParseRequest, { userId, operationId, sourceLabel }: ImportSubmission, now: Date,
): Promise<{ created: boolean; snapshot: BatchSnapshot }> {
  const db = env.DB
  const accept = async (fence: BatchFence) => {
    if (!env.IMPORT_JOBS) return
    try {
      const response = await jobStub(env.IMPORT_JOBS, fence).fetch('https://import.internal/start', {
        method: 'POST', body: JSON.stringify({ fence, source }),
      })
      // A refused handshake is not an outage when the batch has moved on: the original job may have finished or been
      // cancelled between this request's read and its handshake. D1 is the authority, so only a batch still waiting
      // for its first start counts as a failed dispatch.
      if (!response.ok && await stillWaitingForStart(db, fence)) throw new HttpError(503, 'Import service unavailable', 'IMPORT_SERVICE_UNAVAILABLE')
    } catch {
      await persistDraftRows(db, fence, [], { status: 'failed', errorCode: 'IMPORT_SERVICE_UNAVAILABLE' })
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
  if (!env.IMPORT_JOBS && !env.GEMINI_API_KEY) throw new HttpError(500, 'Gemini API key not configured')

  const batchId = crypto.randomUUID()
  if (!await createProcessingBatch(db, { id: batchId, userId, sourceType: source.type, sourceLabel, operationId }, now)) {
    const raced = await replay() // another request of the same submission won the insert
    if (raced) return raced
    throw await refusalFor(db, userId, now)
  }
  const fence: BatchFence = { userId, batchId, generation: 1 }

  if (env.IMPORT_JOBS) {
    await accept(fence)
    const snapshot = await readBatchSnapshot(db, userId, batchId, new Date())
    if (!snapshot) throw discarded()
    return { created: true, snapshot }
  }
  let rows: DraftRowInput[] = []
  let final: FinalState
  try {
    const result = await extractFlights(env, source)
    rows = result.flights.slice(0, MAX_DRAFTS_PER_BATCH).map(rowOf)
    if (result.flights.length === 0) final = { status: 'failed', errorCode: 'NO_FLIGHTS_FOUND' }
    else if (result.flights.length > MAX_DRAFTS_PER_BATCH) final = { status: 'partial', errorCode: 'ROWS_TRUNCATED' }
    else if (result.rejected?.length) final = { status: 'partial', errorCode: 'ROWS_REJECTED' }
    else final = { status: 'review', errorCode: null }
  } catch (error) {
    rows = []
    if (!(error instanceof HttpError)) console.error(JSON.stringify({ event: 'import_job_error', code: 'INTERNAL' }))
    final = { status: 'failed', errorCode: error instanceof HttpError && error.code ? error.code : 'INTERNAL' }
  }
  await persistDraftRows(db, fence, rows, final, new Date())
  const snapshot = await readBatchSnapshot(db, userId, batchId, new Date())
  if (!snapshot) throw discarded()
  return { created: true, snapshot }
}
