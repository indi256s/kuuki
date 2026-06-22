// GET /api/flights/airlines — distinct airline IATA codes for the filter dropdown.

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const rows = await context.env.DB
      .prepare(
        'SELECT DISTINCT airline_iata FROM flights WHERE user_id = ? AND airline_iata IS NOT NULL ORDER BY airline_iata',
      )
      .bind(user.id)
      .all<{ airline_iata: string }>()
    return json(rows.results.map((r) => r.airline_iata))
  })
