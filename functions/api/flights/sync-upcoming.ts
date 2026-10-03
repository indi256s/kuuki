// POST /api/flights/sync-upcoming — flip past upcoming flights to completed, derive their visits
// (parity with the Postgres AFTER UPDATE visits trigger), then recompute derived stats.

import { runHandler, json } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { nowIso } from '../_lib/time'
import { dirtyUserStatement, repairUserDerivedState } from '../_services/derivedState'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)

    const today = nowIso().slice(0, 10)

    const [result] = await env.DB.batch([
      env.DB.prepare('UPDATE flights SET is_upcoming = 0 WHERE user_id = ? AND is_upcoming = 1 AND date <= ?').bind(user.id, today),
      dirtyUserStatement(env.DB, user.id, true),
    ])
    const synced = result.meta.changes ?? 0
    return json({ synced, ...(synced ? await repairUserDerivedState(env.DB, user.id) : {}) })
  })
