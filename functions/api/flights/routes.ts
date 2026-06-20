// GET /api/flights/routes — lightweight route rows for the map.

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { toFlightRoute, type FlightRouteRow } from '../_lib/flights'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const rows = await context.env.DB
      .prepare(
        'SELECT id, origin, destination, airline_iata, date, is_upcoming FROM flights WHERE user_id = ? ORDER BY date DESC',
      )
      .bind(user.id)
      .all<FlightRouteRow>()
    return json(rows.results.map(toFlightRoute))
  })
