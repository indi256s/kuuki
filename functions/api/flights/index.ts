// GET /api/flights — list (filters + sort + paging). POST /api/flights — create.
// Both own-scoped; the create also requires CSRF. Mirrors the live trigger chain (LOGIC_SPEC):
// duration → distance → insert → visits → recompute → unlocks → badges → advanced stats.

import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../_lib/auth'
import { sha256Hex } from '../_lib/crypto'
import { toOwnFlight, type FlightRow } from '../_lib/flights'
import { parseFlightBody } from '../_lib/flightValidation'
import type { FlightInput } from '../../../packages/shared/src/flightValidation'
import {
  parseFlightFilters,
  parsePagination,
  parseSort,
  buildFlightWhere,
  orderByClause,
} from '../_lib/flightQuery'
import { computeFlightDuration } from '../_services/flightDuration'
import { fillDistanceAndDuration } from '../_services/stats'
import { dirtyUserStatement, repairUserDerivedState } from '../_services/derivedState'

// Explicit FlightRow column allowlist (never SELECT *) — drives both SELECT and INSERT/UPDATE RETURNING.
export const FLIGHT_COLUMNS =
  'id, user_id, date, origin, destination, airline_iata, aircraft_icao, flight_number, ' +
  'departure_time, arrival_time, departure_utc, arrival_utc, origin_tz, dest_tz, distance_km, ' +
  'duration_minutes, source, is_upcoming, enrichment_status, aircraft_lookup_attempts, created_at'

/** Use the UTC calendar day, consistently with sync-upcoming in the Workers runtime. */
export function isUpcomingFlight(date: string): boolean {
  return date > new Date().toISOString().slice(0, 10)
}

export function isIdempotencyKey(key: unknown): key is string {
  return typeof key === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(key)
}

export function digestInput(input: object): Promise<string> {
  const sorted = Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)))
  return sha256Hex(JSON.stringify(sorted))
}

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    const user = requireUser(data)
    const params = new URL(request.url).searchParams
    const filters = parseFlightFilters(params)
    const { limit, offset } = parsePagination(params, 20)
    const sort = parseSort(params)
    const { where, binds } = buildFlightWhere(user.id, filters)

    const list = await env.DB.prepare(
      `SELECT ${FLIGHT_COLUMNS} FROM flights WHERE ${where} ${orderByClause(sort)} LIMIT ? OFFSET ?`,
    )
      .bind(...binds, limit, offset)
      .all<FlightRow>()

    const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM flights WHERE ${where}`)
      .bind(...binds)
      .first<{ total: number }>()

    return json({ flights: list.results.map(toOwnFlight), total: count?.total ?? 0 })
  })

/** Ledger insert, conditional flight insert and ledger link for one create; batch them with a dirty mark. */
export async function createFlightStatements(db: D1Database, userId: string, key: string, input: FlightInput): Promise<{ digest: string; statements: D1PreparedStatement[] }> {
  const date = input.date!
  const origin = input.origin!
  const destination = input.destination!
  const digest = await digestInput(input)

  const source = input.source ?? 'manual'
  const isUpcoming = isUpcomingFlight(date)
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

  const statements = [
    db.prepare(
      'INSERT INTO flight_idempotency (user_id, key, payload_digest, flight_id, created_at) VALUES (?, ?, ?, NULL, ?) ON CONFLICT (user_id, key) DO NOTHING',
    ).bind(userId, key, digest, new Date().toISOString()),
    db.prepare(
      `INSERT INTO flights (
       date, origin, destination, airline_iata, aircraft_icao, flight_number,
       departure_time, arrival_time, departure_utc, arrival_utc, origin_tz, dest_tz,
       distance_km, duration_minutes, source, is_upcoming, enrichment_status, user_id
     ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`,
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
      isUpcoming ? 1 : 0,
      enrichmentStatus,
      userId,
    ),
    db.prepare(
      'UPDATE flight_idempotency SET flight_id = last_insert_rowid() WHERE user_id = ? AND key = ? AND flight_id IS NULL AND changes() = 1',
    ).bind(userId, key),
  ]
  return { digest, statements }
}

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)

    const key = request.headers.get('Idempotency-Key')
    if (!isIdempotencyKey(key)) throw new HttpError(400, 'Valid Idempotency-Key required', 'IDEMPOTENCY_KEY_REQUIRED')
    const body = await readJson<unknown>(request)
    const input = await parseFlightBody(env.DB, body, 'create')
    const { digest, statements } = await createFlightStatements(env.DB, user.id, key, input)
    const batch = await env.DB.batch([...statements, dirtyUserStatement(env.DB, user.id, true)])
    const ledger = await env.DB.prepare('SELECT payload_digest, flight_id FROM flight_idempotency WHERE user_id = ? AND key = ?')
      .bind(user.id, key).first<{ payload_digest: string; flight_id: number | null }>()
    if (!ledger) throw new HttpError(500, 'Flight receipt missing', 'RECEIPT_MISSING')
    if (ledger.payload_digest !== digest) throw new HttpError(409, 'Idempotency key already used for another flight', 'IDEMPOTENCY_CONFLICT')
    const row = ledger.flight_id == null ? null : await env.DB.prepare(`SELECT ${FLIGHT_COLUMNS} FROM flights WHERE id = ? AND user_id = ?`)
      .bind(ledger.flight_id, user.id).first<FlightRow>()
    if (!row) throw new HttpError(410, 'Original flight was deleted', 'IDEMPOTENCY_GONE')
    const created = (batch[0].meta.changes ?? 0) > 0
    const derived = await repairUserDerivedState(env.DB, user.id)
    return json({ ...toOwnFlight(row), ...derived }, { status: created ? 201 : 200 })
  })
