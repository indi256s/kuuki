import { HttpError } from '../_lib/http'
import { sha256Hex } from '../_lib/crypto'
import { FLIGHT_COLUMNS, toOwnFlight, type FlightRow } from '../_lib/flights'
import { parseFlightBodies } from '../_lib/flightValidation'
import { explicitDuration, resolveFlightMetrics, type ExplicitInstants } from './flightMetrics'
import {
  dirtyUserStatement,
  repairUserDerivedState,
  type DerivedRepairResult,
} from './derivedState'
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

export interface ConversionTarget {
  draftId: string
  version: number
  batchId: string
  requestDigest: string
}

export interface HistoryTarget {
  rowId: string
  version: number
  runId: string
  generation: number
  acknowledged: boolean
  requestDigest: string
  timing: (ExplicitInstants & { fromSchedule: boolean }) | null
}

type CreateGuard = Pick<ConversionTarget, 'draftId' | 'version'> | HistoryTarget
const isHistoryGuard = (guard: CreateGuard | undefined): guard is HistoryTarget =>
  !!guard && 'rowId' in guard

export const conversionDigest = (draftId: string, version: number) =>
  sha256Hex(JSON.stringify({ kind: 'import_conversion', draftId, version }))

export async function createFlightStatements(
  db: D1Database,
  userId: string,
  key: string,
  input: FlightInput,
  timezone: string | null = null,
  guard?: CreateGuard,
): Promise<{ digest: string; statements: D1PreparedStatement[] }> {
  const date = input.date!
  const origin = input.origin!
  const destination = input.destination!
  const digest = await digestInput(input)
  const passportVisitId = input.passport_visit_id

  const source = input.source ?? 'manual'
  const lifecycle = lifecycleForCreate(date, timezone)
  const enrichmentStatus = input.enrichment_status ?? (input.aircraft_icao ? 'skipped' : 'pending')
  const timing = isHistoryGuard(guard) ? guard.timing : null
  const utcExplicit = explicitDuration(timing) === null ? 0 : 1

  const {
    originTz,
    destTz,
    departureUtc,
    arrivalUtc,
    distanceKm,
    durationMinutes,
    durationSource,
    zonesOverflown,
  } = await resolveFlightMetrics(db, {
    date,
    origin,
    destination,
    airlineIata: input.airline_iata ?? null,
    flightNumber: input.flight_number ?? null,
    departureTime: input.departure_time ?? null,
    arrivalTime: input.arrival_time ?? null,
    originTz: input.origin_tz ?? null,
    destTz: input.dest_tz ?? null,
    clientDistanceKm: input.distance_km ?? null,
    timesFromSchedule: timing?.fromSchedule ?? false,
    explicit: timing,
  })

  const ledger = isHistoryGuard(guard)
    ? db
        .prepare(
          `INSERT INTO flight_idempotency (user_id, key, payload_digest, flight_id, created_at)
       SELECT ?, ?, ?, NULL, ?
       WHERE EXISTS (SELECT 1 FROM history_import_rows r JOIN history_import_runs h ON h.id = r.run_id
         WHERE r.id = ? AND r.user_id = ? AND r.version = ? AND r.state = 'ready' AND r.action = 'create'
           AND h.id = ? AND h.user_id = r.user_id AND h.generation = ? AND h.status IN ('review','completed'))
         AND (? = 1 OR NOT EXISTS
           (SELECT 1 FROM flights f WHERE f.user_id = ? AND f.date = ? AND f.origin = ? AND f.destination = ?))
       ON CONFLICT (user_id, key) DO NOTHING`,
        )
        .bind(
          userId,
          key,
          digest,
          nowIso(),
          guard.rowId,
          userId,
          guard.version,
          guard.runId,
          guard.generation,
          guard.acknowledged ? 1 : 0,
          userId,
          date,
          origin,
          destination,
        )
    : guard
      ? db
          .prepare(
            `INSERT INTO flight_idempotency (user_id, key, payload_digest, flight_id, created_at)
       SELECT ?, ?, ?, NULL, ?
       WHERE EXISTS (SELECT 1 FROM import_drafts d WHERE id = ? AND user_id = ? AND version = ? AND status = 'review'
         AND (d.duplicate_acknowledged = 1 OR NOT EXISTS
           (SELECT 1 FROM flights f WHERE f.user_id = d.user_id AND f.date = ? AND f.origin = ? AND f.destination = ?)))
       ON CONFLICT (user_id, key) DO NOTHING`,
          )
          .bind(
            userId,
            key,
            digest,
            nowIso(),
            guard.draftId,
            userId,
            guard.version,
            date,
            origin,
            destination,
          )
      : db
          .prepare(
            `INSERT INTO flight_idempotency (user_id, key, payload_digest, flight_id, created_at)
         SELECT ?, ?, ?, NULL, ? WHERE ? IS NULL OR EXISTS (
           SELECT 1 FROM ground_visits v JOIN airports_reference a ON a.iata = ?
           WHERE v.id = ? AND v.user_id = ? AND v.entry_method = 'air'
             AND v.country_code = a.country_code AND v.linked_flight_id IS NULL
         ) ON CONFLICT (user_id, key) DO NOTHING`,
          )
          .bind(
            userId,
            key,
            digest,
            new Date().toISOString(),
            passportVisitId ?? null,
            destination,
            passportVisitId ?? null,
            userId,
          )

  const statements = [
    ledger,
    db
      .prepare(
        `INSERT INTO flights (
       date, origin, destination, airline_iata, aircraft_icao, flight_number,
       departure_time, arrival_time, departure_utc, arrival_utc, origin_tz, dest_tz,
       distance_km, duration_minutes, duration_source, times_from_schedule, utc_explicit, zones_overflown, source, enrichment_status, user_id, ${LIFECYCLE_COLUMN_NAMES.join(', ')}
     ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${LIFECYCLE_COLUMN_NAMES.map(() => '?').join(', ')} WHERE changes() = 1`,
      )
      .bind(
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
        originTz,
        destTz,
        distanceKm,
        durationMinutes,
        durationSource,
        timing?.fromSchedule ? 1 : 0,
        utcExplicit,
        zonesOverflown,
        source,
        enrichmentStatus,
        userId,
        ...lifecycleValues(lifecycle),
      ),
    db
      .prepare(
        'UPDATE flight_idempotency SET flight_id = last_insert_rowid() WHERE user_id = ? AND key = ? AND flight_id IS NULL AND changes() = 1',
      )
      .bind(userId, key),
  ]
  if (passportVisitId)
    statements.push(
      db
        .prepare(`UPDATE ground_visits SET linked_flight_id = last_insert_rowid()
      WHERE id = ? AND user_id = ? AND changes() = 1`)
        .bind(passportVisitId, userId),
    )
  return { digest, statements }
}

function conversionStatements(
  db: D1Database,
  userId: string,
  key: string,
  target: ConversionTarget,
): D1PreparedStatement[] {
  const now = nowIso()
  return [
    db
      .prepare(
        `UPDATE import_drafts SET status = 'converted', version = version + 1, converted_flight_id = last_insert_rowid(), updated_at = ?
       WHERE id = ? AND user_id = ? AND version = ? AND status = 'review' AND changes() = 1`,
      )
      .bind(now, target.draftId, userId, target.version),
    db
      .prepare(
        `INSERT INTO import_conversion_receipts (user_id, operation_key, draft_id, batch_id, request_digest, flight_id, created_at)
       SELECT ?, ?, ?, ?, ?, converted_flight_id, ? FROM import_drafts WHERE id = ? AND user_id = ? AND changes() = 1
       ON CONFLICT DO NOTHING`,
      )
      .bind(
        userId,
        key,
        target.draftId,
        target.batchId,
        target.requestDigest,
        now,
        target.draftId,
        userId,
      ),
  ]
}

function historyStatements(
  db: D1Database,
  userId: string,
  key: string,
  target: HistoryTarget,
): D1PreparedStatement[] {
  const now = nowIso()
  return [
    db
      .prepare(
        `UPDATE history_import_rows SET state = 'created', flight_id = last_insert_rowid(), version = version + 1,
         operation_key = ?, request_digest = ?, committed_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND version = ? AND state = 'ready' AND changes() = 1`,
      )
      .bind(key, target.requestDigest, now, now, target.rowId, userId, target.version),
  ]
}

export type BulkItemResult =
  | {
      key: string | null
      status: 'created' | 'replayed'
      flight: ReturnType<typeof toOwnFlight>
      newly_stamped_countries: string[] | null
    }
  | { key: string | null; status: 'error'; http_status: number; code: string; error: string }

export function itemFailure(
  key: string | null,
  status: number,
  code: string,
  error: string,
): BulkItemResult {
  return { key, status: 'error', http_status: status, code, error }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export interface BulkCreateOptions {
  timezone: string | null
  conversion?: Array<ConversionTarget | null | undefined>
  history?: Array<HistoryTarget | null | undefined>
  trailing?: D1PreparedStatement[]
}

export async function bulkCreate(
  db: D1Database,
  userId: string,
  items: unknown[],
  { timezone, conversion, history, trailing = [] }: BulkCreateOptions,
): Promise<{ results: BulkItemResult[]; derived: DerivedRepairResult | null }> {
  const parsed = await parseFlightBodies(
    db,
    items.map((item) => (isRecord(item) ? item.flight : undefined)),
  )
  const results: BulkItemResult[] = []
  const accepted: Array<{
    index: number
    key: string
    digest: string
    first: number
    passportVisit: boolean
  }> = []
  const statements: D1PreparedStatement[] = []
  for (const [index, item] of items.entries()) {
    const key = isRecord(item) && isIdempotencyKey(item.key) ? item.key : null
    const input = parsed[index]
    const target = conversion?.[index] ?? undefined
    const historyTarget = history?.[index] ?? undefined
    if (!key)
      results.push(
        itemFailure(null, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'Valid idempotency key required'),
      )
    else if (input instanceof HttpError)
      results.push(itemFailure(key, input.status, input.code ?? 'INVALID_FLIGHT', input.message))
    else if (input.passport_visit_id && (target || historyTarget))
      results.push(
        itemFailure(
          key,
          400,
          'INVALID_FLIGHT',
          'Passport visits cannot be combined with import draft conversion',
        ),
      )
    else {
      const created = await createFlightStatements(
        db,
        userId,
        key,
        input,
        timezone,
        historyTarget ?? target,
      )
      accepted.push({
        index,
        key,
        digest: created.digest,
        first: statements.length,
        passportVisit: !!input.passport_visit_id,
      })
      statements.push(
        ...created.statements,
        ...(target ? conversionStatements(db, userId, key, target) : []),
        ...(historyTarget ? historyStatements(db, userId, key, historyTarget) : []),
      )
      results.push(itemFailure(key, 500, 'RECEIPT_MISSING', 'Flight receipt missing'))
    }
  }
  if (accepted.length === 0) return { results, derived: null }

  const pressedBefore = await readPressedBefore(db, userId)
  const batch = await db.batch([...statements, ...trailing, dirtyUserStatement(db, userId)])
  const ledgers = await db
    .prepare(
      'SELECT key, payload_digest, flight_id FROM flight_idempotency WHERE user_id = ? AND key IN (SELECT value FROM json_each(?))',
    )
    .bind(userId, JSON.stringify(accepted.map((item) => item.key)))
    .all<{ key: string; payload_digest: string; flight_id: number | null }>()
  const ledgerByKey = new Map(ledgers.results.map((row) => [row.key, row]))
  const ids = ledgers.results.flatMap((row) => (row.flight_id == null ? [] : [row.flight_id]))
  const rows = await db
    .prepare(
      `SELECT ${FLIGHT_COLUMNS} FROM flights WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))`,
    )
    .bind(userId, JSON.stringify(ids))
    .all<FlightRow>()
  const rowById = new Map(rows.results.map((row) => [row.id, row]))

  const fresh: FlightRow[] = []
  for (const { index, key, digest, first, passportVisit } of accepted) {
    const ledger = ledgerByKey.get(key)
    const row = ledger?.flight_id == null ? undefined : rowById.get(ledger.flight_id)
    if (!ledger) {
      if (passportVisit)
        results[index] = itemFailure(
          key,
          409,
          'PASSPORT_VISIT_CONFLICT',
          'Passport visit is unavailable for this arrival',
        )
      continue
    }
    if (ledger.payload_digest !== digest)
      results[index] = itemFailure(
        key,
        409,
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key already used for another flight',
      )
    else if (!row)
      results[index] = itemFailure(key, 410, 'IDEMPOTENCY_GONE', 'Original flight was deleted')
    else {
      const created = (batch[first].meta.changes ?? 0) > 0
      if (created) fresh.push(row)
      results[index] = {
        key,
        status: created ? 'created' : 'replayed',
        flight: toOwnFlight(row),
        newly_stamped_countries: null,
      }
    }
  }
  const derived = await repairUserDerivedState(db, userId)
  const stamps = await stampsForCreated(db, userId, pressedBefore, derived, fresh)
  for (const result of results) {
    if (result.status === 'created') result.newly_stamped_countries = stamps(result.flight.id)
  }
  return { results, derived }
}
