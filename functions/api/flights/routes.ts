// GET /api/flights/routes — lightweight route rows for the map.

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { toFlightRoute, type FlightRouteRow } from '../_lib/flights'
import { parseFlightFilters, buildFlightWhere } from '../_lib/flightQuery'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const { where, binds } = buildFlightWhere(user.id, parseFlightFilters(new URL(context.request.url).searchParams))
    const rows = await context.env.DB
      .prepare(
        `SELECT id, origin, destination, airline_iata, date, is_upcoming FROM flights WHERE ${where} ORDER BY date DESC`,
      )
      .bind(...binds)
      .all<FlightRouteRow>()
    return json(rows.results.map(toFlightRoute))
  })
