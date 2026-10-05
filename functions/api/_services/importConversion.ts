// Draft conversion (ADR 0001 §6 "Draft conversion", C5): `POST /api/import/batches/:id/confirm`.
//
// Receipt-first, then the shared `bulkCreate` with one conversion chain per item:
//   1. a conversion receipt by key and by draft answers a replay before any batch check, so it survives batch expiry
//      and deletion (receipts are tombstones kept 37 days);
//   2. a ledger row without a conversion receipt for the key means the key was used by something else;
//   3. otherwise the batch must exist and be unexpired;
//   4. ledger insert (guarded on the draft), flight insert, ledger link, draft flip and receipt run in one D1 batch,
//      each statement gated on this batch's own previous write, so an item is all-or-nothing;
//   5. every attempted item is classified from what the database now holds, never from the batch's own results.
import { HttpError } from '../_lib/http'
import { toOwnFlight, FLIGHT_COLUMNS, type FlightRow } from '../_lib/flights'
import { FLIGHT_BULK_CREATE_MAX } from '../../../packages/shared/src/flightValidation'
import { bulkCreate, conversionDigest, isIdempotencyKey, type BulkItemResult, type ConversionTarget } from './flightCreate'
import { repairUserDerivedState, type DerivedRepairResult } from './derivedState'
import { takeRequestTimezone } from './lifecycle'
import {
  batchExpired, batchNotFound, draftToFlightInput, isBatchExpired, ownedBatch, duplicatesFor,
  type DraftFields, type DraftRow,
} from './importDrafts'

export interface ConfirmItem { draftId: string; version: number; key: string }
export interface ConfirmRequest { timezone: string | null; items: ConfirmItem[] }

export type ConfirmResult =
  | { draftId: string; key: string; status: 'created' | 'replayed'; flight: ReturnType<typeof toOwnFlight> }
  | { draftId: string; key: string; status: 'error'; http_status: number; code: string; error: string; flightId?: number }

export interface ConfirmResponse {
  results: ConfirmResult[]
  batch: { id: string; status: string; sequence: number; reviewRowCount: number }
  derived: DerivedRepairResult | null
}

const invalid = (message: string, code = 'INVALID_ITEMS') => new HttpError(400, message, code)

export function parseConfirmRequest(raw: unknown): ConfirmRequest {
  const { body, timezone } = takeRequestTimezone(raw)
  const items = (body as { items?: unknown } | null)?.items
  if (!Array.isArray(items) || items.length === 0) throw invalid('items must be a non-empty array')
  if (items.length > FLIGHT_BULK_CREATE_MAX) throw new HttpError(413, `At most ${FLIGHT_BULK_CREATE_MAX} flights per request`, 'TOO_MANY_FLIGHTS')
  const drafts = new Set<string>()
  const keys = new Set<string>()
  const parsed = items.map<ConfirmItem>(entry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw invalid('Each item must be an object')
    const { draftId, version, key } = entry as Record<string, unknown>
    if (typeof draftId !== 'string' || !draftId || draftId.length > 64) throw invalid('draftId is required')
    if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) throw invalid('version must be a positive integer')
    if (!isIdempotencyKey(key)) throw new HttpError(400, 'Valid idempotency key required', 'IDEMPOTENCY_KEY_REQUIRED')
    if (drafts.has(draftId) || keys.has(key)) throw invalid('Each draft and key may appear once per request')
    drafts.add(draftId)
    keys.add(key)
    return { draftId, version, key }
  })
  return { timezone, items: parsed }
}

interface Receipt { operation_key: string; draft_id: string; batch_id: string; request_digest: string; flight_id: number }

const failure = (item: ConfirmItem, status: number, code: string, error: string, flightId?: number): ConfirmResult =>
  ({ draftId: item.draftId, key: item.key, status: 'error', http_status: status, code, error, ...(flightId === undefined ? {} : { flightId }) })

const conflict = (item: ConfirmItem) =>
  failure(item, 409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key already used for another request')
const alreadyConverted = (item: ConfirmItem, flightId: number) =>
  failure(item, 409, 'DRAFT_ALREADY_CONVERTED', 'This row was already converted', flightId)
const versionConflict = (item: ConfirmItem) =>
  failure(item, 409, 'DRAFT_VERSION_CONFLICT', 'This row changed elsewhere. Reload it and try again.')

function receiptsFor(db: D1Database, userId: string, items: ConfirmItem[]) {
  return db.prepare(
    `SELECT operation_key, draft_id, batch_id, request_digest, flight_id FROM import_conversion_receipts
     WHERE user_id = ? AND (operation_key IN (SELECT value FROM json_each(?)) OR draft_id IN (SELECT value FROM json_each(?)))`,
  ).bind(userId, JSON.stringify(items.map(item => item.key)), JSON.stringify(items.map(item => item.draftId)))
    .all<Receipt>().then(result => result.results)
}

function ledgerKeys(db: D1Database, userId: string, items: ConfirmItem[]) {
  return db.prepare('SELECT key FROM flight_idempotency WHERE user_id = ? AND key IN (SELECT value FROM json_each(?))')
    .bind(userId, JSON.stringify(items.map(item => item.key))).all<{ key: string }>()
    .then(result => new Set(result.results.map(row => row.key)))
}

async function flightsById(db: D1Database, userId: string, ids: number[]) {
  if (ids.length === 0) return new Map<number, FlightRow>()
  const rows = await db.prepare(`SELECT ${FLIGHT_COLUMNS} FROM flights WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))`)
    .bind(userId, JSON.stringify(ids)).all<FlightRow>()
  return new Map(rows.results.map(row => [row.id, row]))
}

/**
 * Advances the batch sequence and completes it once no `review` row is left, but only when one of `keys` now has a
 * receipt in this batch. Step 1 answered every key that already had one, so that receipt was written by this
 * transaction (or by a concurrent request with the same key, which at worst advances the sequence once more).
 * Runs after the item chains, in the same D1 batch.
 */
function completionStatement(db: D1Database, userId: string, batchId: string, keys: string[], instant: string): D1PreparedStatement {
  return db.prepare(
    `UPDATE import_batches SET sequence = sequence + 1, updated_at = ?,
       status = CASE WHEN status IN ('review', 'partial') AND NOT EXISTS
         (SELECT 1 FROM import_drafts WHERE batch_id = import_batches.id AND user_id = import_batches.user_id AND status = 'review')
         THEN 'completed' ELSE status END
     WHERE id = ? AND user_id = ?
       AND EXISTS (SELECT 1 FROM import_conversion_receipts
                   WHERE user_id = ? AND batch_id = ? AND operation_key IN (SELECT value FROM json_each(?)))`,
  ).bind(instant, batchId, userId, userId, batchId, JSON.stringify(keys))
}

export async function confirmBatch(
  db: D1Database, userId: string, batchId: string, request: ConfirmRequest, now: Date,
): Promise<ConfirmResponse> {
  const { items, timezone } = request
  const instant = now.toISOString()
  const digests = await Promise.all(items.map(item => conversionDigest(item.draftId, item.version)))
  const results: Array<ConfirmResult | undefined> = items.map(() => undefined)

  // 1. Receipt first: a replay never depends on the batch, the draft or a fresh version.
  const receipts = await receiptsFor(db, userId, items)
  const byKey = new Map(receipts.map(receipt => [receipt.operation_key, receipt]))
  const byDraft = new Map(receipts.map(receipt => [receipt.draft_id, receipt]))
  const replayed = new Map<number, number>() // item index -> flight id
  items.forEach((item, index) => {
    const known = byKey.get(item.key)
    if (known) {
      if (known.draft_id !== item.draftId || known.request_digest !== digests[index]) results[index] = conflict(item)
      else replayed.set(index, known.flight_id)
    } else if (byDraft.has(item.draftId)) results[index] = alreadyConverted(item, byDraft.get(item.draftId)!.flight_id)
  })
  const replayFlights = await flightsById(db, userId, [...replayed.values()])
  for (const [index, flightId] of replayed) {
    const row = replayFlights.get(flightId)
    results[index] = row
      ? { draftId: items[index].draftId, key: items[index].key, status: 'replayed', flight: toOwnFlight(row) }
      : failure(items[index], 410, 'CONVERTED_FLIGHT_DELETED', 'The converted flight was deleted', flightId)
  }

  // 2. Ledger pre-check: a key in the ledger with no conversion receipt belongs to something else.
  let pending = items.flatMap((item, index) => results[index] ? [] : [index])
  if (pending.length > 0) {
    const used = await ledgerKeys(db, userId, pending.map(index => items[index]))
    for (const index of pending) if (used.has(items[index].key)) results[index] = conflict(items[index])
    pending = pending.filter(index => !results[index])
  }

  let derived: DerivedRepairResult | null = null
  const attempted = new Set<number>()
  if (pending.length > 0) {
    // 3. The batch must exist and be unexpired. With replays in the same request the failure is per item so they are still delivered.
    const batch = await ownedBatch(db, userId, batchId)
    const refusal = !batch ? batchNotFound()
      : isBatchExpired(batch, now) ? batchExpired()
        : batch.status === 'processing' ? new HttpError(409, 'This import is still being processed', 'IMPORT_BATCH_PROCESSING')
          : null
    if (refusal) {
      if (results.every(result => !result)) throw refusal
      for (const index of pending) results[index] = failure(items[index], refusal.status, refusal.code!, refusal.message)
    } else {
      const drafts = await db.prepare(
        `SELECT id, version, status, fields_json, year_explicit, year_confirmed, duplicate_acknowledged, converted_flight_id
         FROM import_drafts WHERE user_id = ? AND batch_id = ? AND id IN (SELECT value FROM json_each(?))`,
      ).bind(userId, batchId, JSON.stringify(pending.map(index => items[index].draftId))).all<DraftRow>()
      const draftById = new Map(drafts.results.map(row => [row.id, row]))
      const reviewable = pending.filter(index => draftById.get(items[index].draftId)?.status === 'review')
      const duplicates = await duplicatesFor(db, userId, reviewable.map(index => draftById.get(items[index].draftId)!))

      const ready: number[] = []
      for (const index of pending) {
        const item = items[index]
        const draft = draftById.get(item.draftId)
        if (!draft) { results[index] = failure(item, 404, 'DRAFT_NOT_FOUND', 'Draft not found'); continue }
        // A moved version or a row past review writes nothing; step 5 tells "just converted elsewhere" from "stale".
        if (draft.status !== 'review' || draft.version !== item.version) attempted.add(index)
        else if (draft.year_explicit !== 1 && draft.year_confirmed !== 1) {
          results[index] = failure(item, 400, 'YEAR_NOT_CONFIRMED', 'Confirm the year of this flight before saving')
        } else if (duplicates.has(draft.id) && draft.duplicate_acknowledged !== 1) {
          results[index] = failure(item, 409, 'DUPLICATE_NOT_ACKNOWLEDGED', 'You already have a flight with this date and route', duplicates.get(draft.id))
        } else { ready.push(index); attempted.add(index) }
      }

      // 4. The shared create path: one validation (`parseFlightBodies`), one ledger scheme, one D1 batch. The batch
      // completion rides in the same transaction, so a conversion never commits without it (a receipt-only replay
      // would never get another chance to complete the batch).
      const outcome = ready.length === 0 ? null : await bulkCreate(
        db, userId,
        ready.map(index => ({ key: items[index].key, flight: draftToFlightInput(JSON.parse(draftById.get(items[index].draftId)!.fields_json) as DraftFields) })),
        {
          timezone,
          conversion: ready.map<ConversionTarget>(index => ({
            draftId: items[index].draftId, version: items[index].version, batchId, requestDigest: digests[index],
          })),
          trailing: [completionStatement(db, userId, batchId, ready.map(index => items[index].key), instant)],
        },
      )
      derived = outcome?.derived ?? null
      const created = new Set<number>()
      ready.forEach((index, position) => {
        const result: BulkItemResult = outcome!.results[position]
        // A validation refusal never reached the chain: the draft stays in review, correctable.
        if (result.status === 'error' && result.http_status === 400) {
          results[index] = failure(items[index], 400, result.code, result.error)
          attempted.delete(index)
        } else if (result.status === 'created') created.add(index)
      })

      // 5. Classify every attempted item from what the database holds now.
      const settled = [...attempted]
      const after = settled.length === 0 ? [] : await receiptsFor(db, userId, settled.map(index => items[index]))
      const afterKey = new Map(after.map(receipt => [receipt.operation_key, receipt]))
      const afterDraft = new Map(after.map(receipt => [receipt.draft_id, receipt]))
      const ledger = settled.length === 0 ? new Set<string>() : await ledgerKeys(db, userId, settled.map(index => items[index]))
      const flights = await flightsById(db, userId, after.map(receipt => receipt.flight_id))
      for (const index of settled) {
        const item = items[index]
        const receipt = afterKey.get(item.key)
        if (receipt) {
          if (receipt.draft_id !== item.draftId || receipt.request_digest !== digests[index]) results[index] = conflict(item)
          else {
            const row = flights.get(receipt.flight_id)
            results[index] = row
              ? { draftId: item.draftId, key: item.key, status: created.has(index) ? 'created' : 'replayed', flight: toOwnFlight(row) }
              : failure(item, 410, 'CONVERTED_FLIGHT_DELETED', 'The converted flight was deleted', receipt.flight_id)
          }
        } else if (afterDraft.has(item.draftId)) results[index] = alreadyConverted(item, afterDraft.get(item.draftId)!.flight_id)
        else if (ledger.has(item.key)) results[index] = conflict(item)
        else results[index] = versionConflict(item)
      }
    }
  }
  if (!derived && results.some(result => result?.status === 'replayed')) derived = await repairUserDerivedState(db, userId)

  const summary = await db.prepare(
    `SELECT b.status, b.sequence, (SELECT COUNT(*) FROM import_drafts d WHERE d.batch_id = b.id AND d.user_id = b.user_id AND d.status = 'review') AS review_rows
     FROM import_batches b WHERE b.id = ? AND b.user_id = ?`,
  ).bind(batchId, userId).first<{ status: string; sequence: number; review_rows: number }>()
  return {
    results: results as ConfirmResult[],
    batch: { id: batchId, status: summary?.status ?? 'deleted', sequence: summary?.sequence ?? 0, reviewRowCount: summary?.review_rows ?? 0 },
    derived,
  }
}
