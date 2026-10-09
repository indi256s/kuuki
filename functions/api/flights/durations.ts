// GET /api/flights/durations — completed flights with aircraft + duration, for the durations chart.
// Matches useFlightDurations: FlightDuration { aircraft_icao, duration_minutes }, both non-null.

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const rows = await context.env.DB.prepare(
      `SELECT aircraft_icao, duration_minutes FROM flights
         WHERE user_id = ? AND aircraft_icao IS NOT NULL AND duration_minutes IS NOT NULL
           AND lifecycle_state IN ('awaiting', 'logged')`,
    )
      .bind(user.id)
      .all<{ aircraft_icao: string; duration_minutes: number }>()
    return json(rows.results)
  })
