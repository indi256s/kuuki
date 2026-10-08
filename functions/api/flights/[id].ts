// GET /api/flights/:id (own) — read one. PATCH — update. DELETE — remove.
// Mutations require CSRF. Every query is scoped "id = ? AND user_id = ?" (no RLS in D1).
// PATCH/DELETE re-run the same service chain as create so stats/badges/advanced stats stay in sync.

import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../_lib/auth'
import { toOwnFlight, type FlightRow } from '../_lib/flights'
import { parseFlightBody } from '../_lib/flightValidation'
import { resolveFlightMetrics } from '../_services/flightMetrics'
import { dirtyUserStatement, repairUserDerivedState } from '../_services/derivedState'
import { LIFECYCLE_COLUMN_NAMES, lifecycleForEdit, lifecycleValues, takeRequestTimezone } from '../_services/lifecycle'
import { FLIGHT_COLUMNS } from './index'

const PATCH_CAS_COLUMNS = [
  'date', 'origin', 'destination', 'airline_iata', 'aircraft_icao', 'flight_number',
  'departure_time', 'arrival_time', 'departure_utc', 'arrival_utc', 'origin_tz', 'dest_tz',
  'distance_km', 'duration_minutes', 'duration_source', 'times_from_schedule', 'zones_overflown', 'source', 'enrichment_status',
  ...LIFECYCLE_COLUMN_NAMES,
] as const satisfies ReadonlyArray<keyof FlightRow>

function parseId(raw: string | undefined): number {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Flight not found', 'NOT_FOUND')
  return id
}

async function loadFlight(db: D1Database, id: number, userId: string): Promise<FlightRow> {
  const row = await db
    .prepare(`SELECT ${FLIGHT_COLUMNS} FROM flights WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first<FlightRow>()
  if (!row) throw new HttpError(404, 'Flight not found', 'NOT_FOUND')
  return row
}

export const onRequestGet: PagesFunction<Env, string, RequestData> = context =>
  readFlightRequest(context.request, context.env, context.data, context.params.id as string)

/** Actual Request/Response domain entry, shared by the Pages compatibility transport. */
export function readFlightRequest(request: Request, env: Env, data: RequestData, rawId: string): Promise<Response> {
  return runHandler(async () => {
    const user = requireUser(data)
    const id = parseId(rawId)
    const row = await loadFlight(env.DB, id, user.id)
    return json(toOwnFlight(row))
  })
}

export const onRequestPatch: PagesFunction<Env, string, RequestData> = context =>
  updateFlightRequest(context.request, context.env, context.data, context.params.id as string)

/** Actual Request/Response domain entry, shared by the Pages compatibility transport. */
export function updateFlightRequest(request: Request, env: Env, data: RequestData, rawId: string): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const id = parseId(rawId)

    const existing = await loadFlight(env.DB, id, user.id)
    const { body, timezone } = takeRequestTimezone(await readJson<unknown>(request))
    const patch = await parseFlightBody(env.DB, body, 'patch', existing)

    // Merge patch over the existing row: a provided key (even null) overrides; undefined keeps existing.
    const merge = <T>(key: keyof typeof patch, current: T): T => (patch[key] === undefined ? current : (patch[key] as T))

    const date = patch.date ?? existing.date
    const origin = patch.origin ?? existing.origin
    const destination = patch.destination ?? existing.destination
    const airlineIata = merge('airline_iata', existing.airline_iata)
    const aircraftIcao = merge('aircraft_icao', existing.aircraft_icao)
    const flightNumber = merge('flight_number', existing.flight_number)
    const departureTime = merge('departure_time', existing.departure_time)
    const arrivalTime = merge('arrival_time', existing.arrival_time)
    const timesFromSchedule = departureTime === existing.departure_time && arrivalTime === existing.arrival_time
      ? existing.times_from_schedule : 0
    const originTz = merge('origin_tz', existing.origin_tz)
    const destTz = merge('dest_tz', existing.dest_tz)
    const routeChanged = origin !== existing.origin || destination !== existing.destination
    const timeChanged = date !== existing.date || departureTime !== existing.departure_time || arrivalTime !== existing.arrival_time || originTz !== existing.origin_tz || destTz !== existing.dest_tz
    const mergedDistance = patch.distance_km !== undefined ? patch.distance_km : routeChanged ? null : existing.distance_km
    const source = patch.source ?? existing.source
    const enrichmentStatus = patch.enrichment_status ?? existing.enrichment_status

    // ADR 0001 §2: date and route edits move lifecycle (and the is_upcoming projection) with the same UPDATE.
    const lifecycle = lifecycleForEdit(existing, { date, origin, destination }, timezone)

    const metricsChanged = routeChanged || timeChanged || flightNumber !== existing.flight_number
    const metrics = metricsChanged ? await resolveFlightMetrics(env.DB, {
      date,
      origin,
      destination,
      airlineIata,
      flightNumber,
      departureTime,
      arrivalTime,
      originTz: patch.origin_tz === undefined && origin !== existing.origin ? null : originTz,
      destTz: patch.dest_tz === undefined && destination !== existing.destination ? null : destTz,
      clientDistanceKm: mergedDistance,
      excludeFlightId: id,
      timesFromSchedule: timesFromSchedule === 1,
    }) : {
      originTz: existing.origin_tz, destTz: existing.dest_tz,
      departureUtc: existing.departure_utc, arrivalUtc: existing.arrival_utc,
      distanceKm: existing.distance_km, durationMinutes: existing.duration_minutes,
      durationSource: existing.duration_source, zonesOverflown: existing.zones_overflown,
    }

    const [update] = await env.DB.batch([env.DB.prepare(
      `UPDATE flights SET
         date = ?, origin = ?, destination = ?, airline_iata = ?, aircraft_icao = ?, flight_number = ?,
         departure_time = ?, arrival_time = ?, departure_utc = ?, arrival_utc = ?, origin_tz = ?, dest_tz = ?,
         distance_km = ?, duration_minutes = ?, duration_source = ?, times_from_schedule = ?, zones_overflown = ?, source = ?, enrichment_status = ?,
         ${LIFECYCLE_COLUMN_NAMES.map(name => `${name} = ?`).join(', ')}
       WHERE id = ? AND user_id = ? AND ${PATCH_CAS_COLUMNS.map(name => `${name} IS ?`).join(' AND ')}`,
    )
      .bind(
        date,
        origin,
        destination,
        airlineIata,
        aircraftIcao,
        flightNumber,
        departureTime,
        arrivalTime,
        metrics.departureUtc,
        metrics.arrivalUtc,
        metrics.originTz,
        metrics.destTz,
        metrics.distanceKm,
        metrics.durationMinutes,
        metrics.durationSource,
        timesFromSchedule,
        metrics.zonesOverflown,
        source,
        enrichmentStatus,
        ...lifecycleValues(lifecycle),
        id,
        user.id,
        ...PATCH_CAS_COLUMNS.map(name => existing[name]),
      ), dirtyUserStatement(env.DB, user.id, true)])
    if (!update.meta.changes) {
      // Reject changes to any rewritten snapshot field; a concurrent deletion remains a 404.
      await loadFlight(env.DB, id, user.id)
      throw new HttpError(409, 'Flight changed while it was being edited; reload and retry', 'STATE_CONFLICT', { cause: 'flight_changed' })
    }
    const updated = await loadFlight(env.DB, id, user.id)
    const derived = await repairUserDerivedState(env.DB, user.id)
    return json({ ...toOwnFlight(updated), ...derived })
  })
}

export const onRequestDelete: PagesFunction<Env, string, RequestData> = context =>
  deleteFlightRequest(context.request, context.env, context.data, context.params.id as string)

/** Actual Request/Response domain entry, shared by the Pages compatibility transport. */
export function deleteFlightRequest(request: Request, env: Env, data: RequestData, rawId: string): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const id = parseId(rawId)

    const [deleted] = await env.DB.batch([
      env.DB.prepare('DELETE FROM flights WHERE id = ? AND user_id = ?').bind(id, user.id),
      dirtyUserStatement(env.DB, user.id, true),
    ])
    if (!deleted.meta.changes) throw new HttpError(404, 'Flight not found', 'NOT_FOUND')
    const derived = await repairUserDerivedState(env.DB, user.id)
    return json({ ok: true, ...derived })
  })
}
