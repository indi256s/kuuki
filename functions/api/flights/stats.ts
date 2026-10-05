// GET /api/flights/stats — dashboard FlightStats. Reads the precomputed user_stats row for accuracy
// (real countries/airports/airlines counts), counts upcoming flights live. Zeros if no stats row.

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const db = context.env.DB

    const stats = await db
      .prepare(
        `SELECT total_flights, total_distance_km, countries_count, airlines_count, airports_count
         FROM user_stats WHERE user_id = ?`,
      )
      .bind(user.id)
      .first<{
        total_flights: number
        total_distance_km: number
        countries_count: number
        airlines_count: number
        airports_count: number
      }>()

    const up = await db
      .prepare("SELECT COUNT(*) AS n FROM flights WHERE user_id = ? AND lifecycle_state = 'upcoming'")
      .bind(user.id)
      .first<{ n: number }>()

    return json({
      totalFlights: stats?.total_flights ?? 0,
      totalDistance: stats?.total_distance_km ?? 0,
      countriesVisited: stats?.countries_count ?? 0,
      airlinesFlown: stats?.airlines_count ?? 0,
      uniqueAirports: stats?.airports_count ?? 0,
      upcomingFlights: up?.n ?? 0,
    })
  })
