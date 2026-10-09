// GET /api/flights/ids — all flight ids matching the same filters as the list (for bulk selection).

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { parseFlightFilters, buildFlightWhere } from '../_lib/flightQuery'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const params = new URL(context.request.url).searchParams
    const filters = parseFlightFilters(params)
    const { where, binds } = buildFlightWhere(user.id, filters)
    const rows = await context.env.DB.prepare(`SELECT id FROM flights WHERE ${where}`)
      .bind(...binds)
      .all<{ id: number }>()
    return json({ ids: rows.results.map((r) => r.id) })
  })
