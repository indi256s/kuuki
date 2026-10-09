// GET /api/flights/aircraft — distinct aircraft ICAO codes for the filter dropdown.

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const rows = await context.env.DB.prepare(
      'SELECT DISTINCT aircraft_icao FROM flights WHERE user_id = ? AND aircraft_icao IS NOT NULL ORDER BY aircraft_icao',
    )
      .bind(user.id)
      .all<{ aircraft_icao: string }>()
    return json(rows.results.map((r) => r.aircraft_icao))
  })
