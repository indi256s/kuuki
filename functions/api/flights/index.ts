// GET /api/flights — list (filters + sort + paging). POST /api/flights — create.
// Both own-scoped; the create also requires CSRF. Mirrors the live trigger chain (LOGIC_SPEC):
// duration → distance → insert → visits → recompute → unlocks → badges → advanced stats.

import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../_lib/auth'
import { toOwnFlight, type FlightRow } from '../_lib/flights'
import {
  parseFlightFilters,
  parsePagination,
  parseSort,
  buildFlightWhere,
  orderByClause,
} from '../_lib/flightQuery'
import { computeFlightDuration } from '../_services/flightDuration'
import {
  fillDistanceAndDuration,
  syncVisitsFromFlight,
  recomputeUserStats,
  updateAdvancedStatsUnlocks,
  evaluateBadges,
} from '../_services/stats'
import { refreshAdvancedStats } from '../_services/advancedStats'

// Explicit FlightRow column allowlist (never SELECT *) — drives both SELECT and INSERT/UPDATE RETURNING.
export const FLIGHT_COLUMNS =
  'id, user_id, date, origin, destination, airline_iata, aircraft_icao, flight_number, ' +
  'departure_time, arrival_time, departure_utc, arrival_utc, origin_tz, dest_tz, distance_km, ' +
  'duration_minutes, source, is_upcoming, enrichment_status, aircraft_lookup_attempts, created_at'

/** A flight is upcoming when its date is strictly after today (local midnight). Mirrors geo.isUpcomingFlight. */
export function isUpcomingFlight(date: string): boolean {
  const flightDate = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return flightDate > today
}

interface FlightBody {
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

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)

    const body = await readJson<FlightBody>(request)
    const date = body?.date?.trim()
    const origin = body?.origin?.trim()
    const destination = body?.destination?.trim()
    if (!date || !origin || !destination) {
      throw new HttpError(400, 'date, origin and destination are required', 'MISSING_FIELDS')
    }

    const source = body?.source ?? 'manual'
    const isUpcoming = isUpcomingFlight(date)
    const enrichmentStatus = body?.enrichment_status ?? (body?.aircraft_icao ? 'skipped' : 'pending')

    const { departureUtc, arrivalUtc, durationMinutes: tzDur } = computeFlightDuration({
      date,
      departureTime: body?.departure_time ?? null,
      arrivalTime: body?.arrival_time ?? null,
      originTz: body?.origin_tz ?? null,
      destTz: body?.dest_tz ?? null,
      existingDurationMinutes: body?.duration_minutes ?? null,
    })

    const { distanceKm, durationMinutes } = await fillDistanceAndDuration(
      env.DB,
      origin,
      destination,
      body?.distance_km ?? null,
      tzDur,
    )

    const created = await env.DB.prepare(
      `INSERT INTO flights (
         date, origin, destination, airline_iata, aircraft_icao, flight_number,
         departure_time, arrival_time, departure_utc, arrival_utc, origin_tz, dest_tz,
         distance_km, duration_minutes, source, is_upcoming, enrichment_status, user_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING ${FLIGHT_COLUMNS}`,
    )
      .bind(
        date,
        origin,
        destination,
        body?.airline_iata ?? null,
        body?.aircraft_icao ?? null,
        body?.flight_number ?? null,
        body?.departure_time ?? null,
        body?.arrival_time ?? null,
        departureUtc,
        arrivalUtc,
        body?.origin_tz ?? null,
        body?.dest_tz ?? null,
        distanceKm,
        durationMinutes,
        source,
        isUpcoming ? 1 : 0,
        enrichmentStatus,
        user.id,
      )
      .first<FlightRow>()

    if (!created) throw new HttpError(500, 'Failed to create flight', 'INSERT_FAILED')

    if (!isUpcoming) {
      await syncVisitsFromFlight(env.DB, user.id, { origin, destination, date, is_upcoming: 0 })
    }
    await recomputeUserStats(env.DB, user.id)
    await updateAdvancedStatsUnlocks(env.DB, user.id)
    await evaluateBadges(env.DB, user.id)
    await refreshAdvancedStats(env.DB, user.id)

    return json(toOwnFlight(created), { status: 201 })
  })
