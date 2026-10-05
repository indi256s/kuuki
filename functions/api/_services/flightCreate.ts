// Shared flight creation (ADR 0001 §6 "Shared services"). `POST /api/flights`, `POST /api/flights/bulk` and import
// draft conversion all create flights here, so there is exactly one validation path (`parseFlightBodies`) and one
// ledger/receipt scheme. No internal HTTP round trip.
//
// A plain create is: ledger insert, conditional flight insert, ledger link. A draft conversion adds a guard to the
// first statement and two statements after the link (the draft flip and the conversion receipt), so every statement
// is gated on this batch's own previous write and the chain is all-or-nothing per item (see `conversionStatements`).
import { HttpError } from '../_lib/http'
import { sha256Hex } from '../_lib/crypto'
import { FLIGHT_COLUMNS, toOwnFlight, type FlightRow } from '../_lib/flights'
import { parseFlightBodies } from '../_lib/flightValidation'
import { computeFlightDuration } from './flightDuration'
import { fillDistanceAndDuration } from './stats'
import { dirtyUserStatement, repairUserDerivedState, type DerivedRepairResult } from './derivedState'
import { LIFECYCLE_COLUMN_NAMES, lifecycleForCreate, lifecycleValues } from './lifecycle'
import { nowIso } from '../_lib/time'
import { readPressedBefore, stampsForCreated } from './newlyStamped'
import type { FlightInput } from '../../../packages/shared/src/flightValidation'

export function isIdempotencyKey(key: unknown): key is string {
  return typeof key === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(key)
}

export function digestInput(input: object): Promise<string> {
  const sorted = Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)))
  return sha256Hex(JSON.stringify(sorted))
}

/** The draft a flight is being created from. Present only for import conversion. */
export interface ConversionTarget {
  draftId: string
  /** The draft version the member reviewed; the chain converts only that version. */
  version: number
  batchId: string
  /** Identity of the conversion request, recomputable without the draft (see `conversionDigest`). */
  requestDigest: string
}

/** What a conversion receipt pins: the draft and the version the member reviewed. It must not need the draft row. */
export const conversionDigest = (draftId: string, version: number) =>
  sha256Hex(JSON.stringify({ kind: 'import_conversion', draftId, version }))

/**
 * Ledger insert, conditional flight insert and ledger link for one create; batch them with a dirty mark.
 * `timezone` is request context (ADR 0001 §1): it picks the lifecycle state and deadlines but is outside
 * `FlightInput`, so it never enters the idempotency digest.
 *
 * With `guard`, the ledger insert is `INSERT … SELECT … WHERE EXISTS (the draft at that version, still in review)`,
 * so a stale or already converted draft writes nothing at all (ADR 0001 §6 step 4).
 */
export async function createFlightStatements(
  db: D1Database, userId: string, key: string, input: FlightInput, timezone: string | null = null,
  guard?: Pick<ConversionTarget, 'draftId' | 'version'>,
): Promise<{ digest: string; statements: D1PreparedStatement[] }> {
  const date = input.date!
  const origin = input.origin!
  const destination = input.destination!
  const digest = await digestInput(input)

  const source = input.source ?? 'manual'
  const lifecycle = lifecycleForCreate(date, timezone)
  const enrichmentStatus = input.enrichment_status ?? (input.aircraft_icao ? 'skipped' : 'pending')

  const { departureUtc, arrivalUtc, durationMinutes: tzDur } = computeFlightDuration({
    date,
    departureTime: input.departure_time ?? null,
    arrivalTime: input.arrival_time ?? null,
    originTz: input.origin_tz ?? null,
    destTz: input.dest_tz ?? null,
    existingDurationMinutes: input.duration_minutes ?? null,
  })

  const { distanceKm, durationMinutes } = await fillDistanceAndDuration(
    db,
    origin,
    destination,
    input.distance_km ?? null,
    tzDur,
  )

  const ledger = guard
    ? db.prepare(
      `INSERT INTO flight_idempotency (user_id, key, payload_digest, flight_id, created_at)
       SELECT ?, ?, ?, NULL, ?
       WHERE EXISTS (SELECT 1 FROM import_drafts WHERE id = ? AND user_id = ? AND version = ? AND status = 'review')
       ON CONFLICT (user_id, key) DO NOTHING`,
    ).bind(userId, key, digest, nowIso(), guard.draftId, userId, guard.version)
    : db.prepare(
      'INSERT INTO flight_idempotency (user_id, key, payload_digest, flight_id, created_at) VALUES (?, ?, ?, NULL, ?) ON CONFLICT (user_id, key) DO NOTHING',
    ).bind(userId, key, digest, new Date().toISOString())

  const statements = [
    ledger,
    db.prepare(
      `INSERT INTO flights (
       date, origin, destination, airline_iata, aircraft_icao, flight_number,
       departure_time, arrival_time, departure_utc, arrival_utc, origin_tz, dest_tz,
       distance_km, duration_minutes, source, enrichment_status, user_id, ${LIFECYCLE_COLUMN_NAMES.join(', ')}
     ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${LIFECYCLE_COLUMN_NAMES.map(() => '?').join(', ')} WHERE changes() = 1`,
    ).bind(
      date,
      origin,
      destination,
      input.airline_iata ?? null,
      input.aircraft_icao ?? null,
      input.flight_number ?? null,
      input.departure_time ?? null,
      input.arrival_time ?? null,
      departureUtc,
      arrivalUtc,
      input.origin_tz ?? null,
      input.dest_tz ?? null,
      distanceKm,
      durationMinutes,
      source,
      enrichmentStatus,
      userId,
      ...lifecycleValues(lifecycle),
    ),
    db.prepare(
      'UPDATE flight_idempotency SET flight_id = last_insert_rowid() WHERE user_id = ? AND key = ? AND flight_id IS NULL AND changes() = 1',
    ).bind(userId, key),
  ]
  return { digest, statements }
}

/**
 * The two statements that follow the ledger link of a conversion (ADR 0001 §6 step 4):
 *  - flip the draft, still gated on the version and `changes() = 1` from the link. A ledger `UPDATE` does not change
 *    `last_insert_rowid()`, so it is still the flight this batch inserted;
 *  - the receipt, whose flight id comes only from the draft this batch converted. The no-target `ON CONFLICT` covers
 *    both the key and the draft uniqueness; neither conflict is reachable after the guards above.
 */
function conversionStatements(db: D1Database, userId: string, key: string, target: ConversionTarget): D1PreparedStatement[] {
  const now = nowIso()
  return [
    db.prepare(
      `UPDATE import_drafts SET status = 'converted', version = version + 1, converted_flight_id = last_insert_rowid(), updated_at = ?
       WHERE id = ? AND user_id = ? AND version = ? AND status = 'review' AND changes() = 1`,
    ).bind(now, target.draftId, userId, target.version),
    db.prepare(
      `INSERT INTO import_conversion_receipts (user_id, operation_key, draft_id, batch_id, request_digest, flight_id, created_at)
       SELECT ?, ?, ?, ?, ?, converted_flight_id, ? FROM import_drafts WHERE id = ? AND user_id = ? AND changes() = 1
       ON CONFLICT DO NOTHING`,
    ).bind(userId, key, target.draftId, target.batchId, target.requestDigest, now, target.draftId, userId),
  ]
}

export type BulkItemResult =
  | {
    key: string | null; status: 'created' | 'replayed'; flight: ReturnType<typeof toOwnFlight>
    /** ADR 0001 §5: countries this item newly pressed; null on `replayed`, pending publication or an unknown before-set. */
    newly_stamped_countries: string[] | null
  }
  | { key: string | null; status: 'error'; http_status: number; code: string; error: string }

export function itemFailure(key: string | null, status: number, code: string, error: string): BulkItemResult {
  return { key, status: 'error', http_status: status, code, error }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export interface BulkCreateOptions {
  timezone: string | null
  /** Positional with `items`: a target turns that item into a draft conversion. */
  conversion?: Array<ConversionTarget | null | undefined>
  /** Statements that commit in the same D1 batch, after every item chain (conversion's batch completion). */
  trailing?: D1PreparedStatement[]
}

/**
 * Create up to FLIGHT_BULK_CREATE_MAX flights, each under its own idempotency key. Items validate independently;
 * accepted flights and their receipts commit in one D1 batch with one dirty mark, then derived state is repaired
 * once. Results are positional: created / replayed / error. `derived` is null when nothing was accepted.
 *
 * For a conversion item `created` means this batch inserted the flight and converted the draft. Anything else must
 * be classified by the caller from the conversion receipts (a `replayed` result only says the key had a ledger row).
 */
export async function bulkCreate(
  db: D1Database, userId: string, items: unknown[], { timezone, conversion, trailing = [] }: BulkCreateOptions,
): Promise<{ results: BulkItemResult[]; derived: DerivedRepairResult | null }> {
  const parsed = await parseFlightBodies(db, items.map(item => isRecord(item) ? item.flight : undefined))
  const results: BulkItemResult[] = []
  const accepted: Array<{ index: number; key: string; digest: string; first: number }> = []
  const statements: D1PreparedStatement[] = []
  for (const [index, item] of items.entries()) {
    const key = isRecord(item) && isIdempotencyKey(item.key) ? item.key : null
    const input = parsed[index]
    const target = conversion?.[index] ?? undefined
    if (!key) results.push(itemFailure(null, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'Valid idempotency key required'))
    else if (input instanceof HttpError) results.push(itemFailure(key, input.status, input.code ?? 'INVALID_FLIGHT', input.message))
    else {
      const created = await createFlightStatements(db, userId, key, input, timezone, target)
      accepted.push({ index, key, digest: created.digest, first: statements.length })
      statements.push(...created.statements, ...(target ? conversionStatements(db, userId, key, target) : []))
      results.push(itemFailure(key, 500, 'RECEIPT_MISSING', 'Flight receipt missing')) // replaced once the ledger is read
    }
  }
  if (accepted.length === 0) return { results, derived: null }

  const pressedBefore = await readPressedBefore(db, userId)
  // Unconditional dirty mark: changes() only sees the last item, and a pure replay just repairs again.
  const batch = await db.batch([...statements, ...trailing, dirtyUserStatement(db, userId)])
  const ledgers = await db.prepare(
    'SELECT key, payload_digest, flight_id FROM flight_idempotency WHERE user_id = ? AND key IN (SELECT value FROM json_each(?))',
  ).bind(userId, JSON.stringify(accepted.map(item => item.key))).all<{ key: string; payload_digest: string; flight_id: number | null }>()
  const ledgerByKey = new Map(ledgers.results.map(row => [row.key, row]))
  const ids = ledgers.results.flatMap(row => row.flight_id == null ? [] : [row.flight_id])
  const rows = await db.prepare(`SELECT ${FLIGHT_COLUMNS} FROM flights WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))`)
    .bind(userId, JSON.stringify(ids)).all<FlightRow>()
  const rowById = new Map(rows.results.map(row => [row.id, row]))

  const fresh: FlightRow[] = []
  for (const { index, key, digest, first } of accepted) {
    const ledger = ledgerByKey.get(key)
    const row = ledger?.flight_id == null ? undefined : rowById.get(ledger.flight_id)
    if (!ledger) continue
    if (ledger.payload_digest !== digest) results[index] = itemFailure(key, 409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key already used for another flight')
    else if (!row) results[index] = itemFailure(key, 410, 'IDEMPOTENCY_GONE', 'Original flight was deleted')
    else {
      const created = (batch[first].meta.changes ?? 0) > 0
      if (created) fresh.push(row)
      results[index] = { key, status: created ? 'created' : 'replayed', flight: toOwnFlight(row), newly_stamped_countries: null }
    }
  }
  const derived = await repairUserDerivedState(db, userId)
  const stamps = await stampsForCreated(db, userId, pressedBefore, derived, fresh)
  for (const result of results) {
    if (result.status === 'created') result.newly_stamped_countries = stamps(result.flight.id)
  }
  return { results, derived }
}
