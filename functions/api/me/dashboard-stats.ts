// GET /api/me/dashboard-stats — composes the dashboard fast-path read for the requester.
//
// The frontend's useDashboardStats hook (fast/unfiltered path) reads three things: the
// pre-computed user_stats row, the next 5 upcoming flights, and every completed flight's
// (origin, destination, airline_iata, aircraft_icao) — the last is fed to @kuuki/data
// lookups CLIENT-SIDE to derive visitedCountries + favorites (country/continent resolution
// lives in the bundled reference data, not in D1). We return all three so the client keeps
// computing those exactly as before. percentiles are left null on this path (the hook does
// the same; they come from rankings when opted in).

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { toUserStats, type UserStatsRow } from '../_lib/stats'

interface UpcomingRow {
  id: number
  date: string
  origin: string
  destination: string
  airline_iata: string | null
  flight_number: string | null
}

interface CompletedFlightRow {
  origin: string
  destination: string
  distance_km: number | null
  duration_minutes: number | null
  airline_iata: string | null
  aircraft_icao: string | null
}

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const db = context.env.DB

    const stats = await db.prepare('SELECT * FROM user_stats WHERE user_id = ?')
      .bind(user.id)
      .first<UserStatsRow>()

    const upcoming = await db
      .prepare(
        `SELECT id, date, origin, destination, airline_iata, flight_number
         FROM flights
         WHERE user_id = ? AND lifecycle_state = 'upcoming'
         ORDER BY date ASC
         LIMIT 5`,
      )
      .bind(user.id)
      .all<UpcomingRow>()

    const completed = await db
      .prepare(
        `SELECT origin, destination, distance_km, duration_minutes, airline_iata, aircraft_icao
         FROM flights
         WHERE user_id = ? AND lifecycle_state IN ('awaiting', 'logged')`,
      )
      .bind(user.id)
      .all<CompletedFlightRow>()

    return json({
      stats: stats ? toUserStats(stats) : null,
      upcomingFlights: upcoming.results,
      completedFlights: completed.results,
    })
  })
