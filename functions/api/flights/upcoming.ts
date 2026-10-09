// GET /api/flights/upcoming?limit=3 — soonest upcoming flights for the dashboard.

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { toOwnFlight, type FlightRow } from '../_lib/flights'
import { FLIGHT_COLUMNS } from './index'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const raw = Number(new URL(context.request.url).searchParams.get('limit'))
    const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 200) : 3
    const rows = await context.env.DB.prepare(
      `SELECT ${FLIGHT_COLUMNS} FROM flights WHERE user_id = ? AND lifecycle_state = 'upcoming' ORDER BY date ASC LIMIT ?`,
    )
      .bind(user.id, limit)
      .all<FlightRow>()
    return json(rows.results.map(toOwnFlight))
  })
