// GET /api/passport/claims — all country claims for the user (user_id stripped).

import { runHandler, json } from '../../_lib/http'
import { requireUser, type RequestData } from '../../_lib/auth'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const rows = await context.env.DB.prepare(
      'SELECT id, country_code, claimed_at FROM country_claims WHERE user_id = ? ORDER BY claimed_at DESC',
    )
      .bind(user.id)
      .all()
    return json(rows.results ?? [])
  })
