// GET /api/flights/years — distinct flight years (numbers), newest first.

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const rows = await context.env.DB.prepare(
      'SELECT DISTINCT substr(date, 1, 4) AS y FROM flights WHERE user_id = ? ORDER BY y DESC',
    )
      .bind(user.id)
      .all<{ y: string }>()
    return json(rows.results.map((r) => Number(r.y)))
  })
