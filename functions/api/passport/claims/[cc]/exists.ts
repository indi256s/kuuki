// GET /api/passport/claims/:cc/exists — whether the user has claimed this country.

import { runHandler, json } from '../../../_lib/http'
import { requireUser, type RequestData } from '../../../_lib/auth'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const cc = context.params.cc as string
    const row = await context.env.DB
      .prepare('SELECT id FROM country_claims WHERE user_id = ? AND country_code = ? LIMIT 1')
      .bind(user.id, cc)
      .first()
    return json({ exists: !!row })
  })
