// POST /api/flights/delete-all — delete every own flight, then recompute derived stats.

import { runHandler, json } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { dirtyUserStatement, repairUserDerivedState } from '../_services/derivedState'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)

    const [result] = await env.DB.batch([
      env.DB.prepare('DELETE FROM flights WHERE user_id = ?').bind(user.id),
      dirtyUserStatement(env.DB, user.id, true),
    ])
    const deleted = result.meta.changes ?? 0
    return json({ deleted, ...(deleted ? await repairUserDerivedState(env.DB, user.id) : {}) })
  })
