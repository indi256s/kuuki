// GET /api/flights/all — every flight (no paging), newest first. Used by export.

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { toOwnFlight, type FlightRow } from '../_lib/flights'
import { FLIGHT_COLUMNS } from './index'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const rows = await context.env.DB.prepare(
      `SELECT ${FLIGHT_COLUMNS} FROM flights WHERE user_id = ? ORDER BY date DESC`,
    )
      .bind(user.id)
      .all<FlightRow>()
    return json(rows.results.map(toOwnFlight))
  })
