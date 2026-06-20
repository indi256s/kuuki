// GET /api/flights/:id (own) — read one. PATCH — update. DELETE — remove.
// Mutations require CSRF. Every query is scoped "id = ? AND user_id = ?" (no RLS in D1).
// PATCH/DELETE re-run the same service chain as create so stats/badges/advanced stats stay in sync.

import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../_lib/auth'
import { toOwnFlight, type FlightRow } from '../_lib/flights'
import { computeFlightDuration } from '../_services/flightDuration'
import {
  fillDistanceAndDuration,
  syncVisitsFromFlight,
  recomputeUserStats,
  updateAdvancedStatsUnlocks,
  evaluateBadges,
} from '../_services/stats'
import { refreshAdvancedStats } from '../_services/advancedStats'
import { FLIGHT_COLUMNS, isUpcomingFlight } from './index'

interface FlightPatch {
  date?: string
  origin?: string
  destination?: string
  airline_iata?: string | null
  aircraft_icao?: string | null
  flight_number?: string | null
  departure_time?: string | null
  arrival_time?: string | null
  origin_tz?: string | null
  dest_tz?: string | null
  distance_km?: number | null
  duration_minutes?: number | null
  source?: string
  enrichment_status?: string
}

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

/** Re-run the post-write service chain. visits sync is skipped for upcoming flights and on delete. */
async function runChain(db: D1Database, userId: string, visit: { origin: string; destination: string; date: string } | null): Promise<void> {
  if (visit) await syncVisitsFromFlight(db, userId, { ...visit, is_upcoming: 0 })
  await recomputeUserStats(db, userId)
  await updateAdvancedStatsUnlocks(db, userId)
  await evaluateBadges(db, userId)
  await refreshAdvancedStats(db, userId)
}

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const id = parseId(context.params.id as string)
    const row = await loadFlight(context.env.DB, id, user.id)
    return json(toOwnFlight(row))
  })

export const onRequestPatch: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)
    const id = parseId(context.params.id as string)

    const existing = await loadFlight(env.DB, id, user.id)
    const patch = (await readJson<FlightPatch>(request)) ?? {}

    // Merge patch over the existing row: a provided key (even null) overrides; undefined keeps existing.
    const merge = <T>(key: keyof FlightPatch, current: T): T => (patch[key] === undefined ? current : (patch[key] as T))

    const date = patch.date ?? existing.date
    const origin = patch.origin ?? existing.origin
    const destination = patch.destination ?? existing.destination
    const airlineIata = merge('airline_iata', existing.airline_iata)
    const aircraftIcao = merge('aircraft_icao', existing.aircraft_icao)
    const flightNumber = merge('flight_number', existing.flight_number)
    const departureTime = merge('departure_time', existing.departure_time)
    const arrivalTime = merge('arrival_time', existing.arrival_time)
    const originTz = merge('origin_tz', existing.origin_tz)
    const destTz = merge('dest_tz', existing.dest_tz)
    const mergedDistance = merge('distance_km', existing.distance_km)
    const mergedDuration = merge('duration_minutes', existing.duration_minutes)
    const source = patch.source ?? existing.source
    const enrichmentStatus = patch.enrichment_status ?? existing.enrichment_status

    // is_upcoming recomputed from the (possibly new) date.
    const isUpcoming = patch.date ? isUpcomingFlight(date) : !!existing.is_upcoming

    const { departureUtc, arrivalUtc, durationMinutes: tzDur } = computeFlightDuration({
      date,
      departureTime,
      arrivalTime,
      originTz,
      destTz,
      existingDurationMinutes: mergedDuration,
    })

    const { distanceKm, durationMinutes } = await fillDistanceAndDuration(env.DB, origin, destination, mergedDistance, tzDur)

    const updated = await env.DB.prepare(
      `UPDATE flights SET
         date = ?, origin = ?, destination = ?, airline_iata = ?, aircraft_icao = ?, flight_number = ?,
         departure_time = ?, arrival_time = ?, departure_utc = ?, arrival_utc = ?, origin_tz = ?, dest_tz = ?,
         distance_km = ?, duration_minutes = ?, source = ?, is_upcoming = ?, enrichment_status = ?
       WHERE id = ? AND user_id = ?
       RETURNING ${FLIGHT_COLUMNS}`,
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
        departureUtc,
        arrivalUtc,
        originTz,
        destTz,
        distanceKm,
        durationMinutes,
        source,
        isUpcoming ? 1 : 0,
        enrichmentStatus,
        id,
        user.id,
      )
      .first<FlightRow>()

    if (!updated) throw new HttpError(404, 'Flight not found', 'NOT_FOUND')

    await runChain(env.DB, user.id, isUpcoming ? null : { origin, destination, date })

    return json(toOwnFlight(updated))
  })

export const onRequestDelete: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)
    const id = parseId(context.params.id as string)

    const res = await env.DB.prepare('DELETE FROM flights WHERE id = ? AND user_id = ?').bind(id, user.id).run()
    if (!res.meta.changes) throw new HttpError(404, 'Flight not found', 'NOT_FOUND')

    // No syncVisitsFromFlight on delete — visits are cumulative and never decrement.
    await runChain(env.DB, user.id, null)

    return json({ ok: true })
  })
