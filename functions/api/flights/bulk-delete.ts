// POST /api/flights/bulk-delete — delete the given own flights, then recompute derived stats.
// D1 caps bound variables per statement, so ids are chunked into batched DELETEs.

import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { dirtyUserStatement, repairUserDerivedState } from '../_services/derivedState'

interface Body {
  ids?: number[]
}

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)

    const body = await readJson<Body>(request)
    if (!Array.isArray(body?.ids) || body.ids.some(id => !Number.isInteger(id) || id <= 0) || body.ids.length > 10_000) {
      throw new HttpError(400, 'Invalid flight ids', 'INVALID_IDS')
    }
    const ids = [...new Set(body.ids)]
    if (ids.length === 0) return json({ deleted: 0 })

    const [result] = await env.DB.batch([
      env.DB.prepare('DELETE FROM flights WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))').bind(user.id, JSON.stringify(ids)),
      dirtyUserStatement(env.DB, user.id, true),
    ])
    const deleted = result.meta.changes ?? 0
    return json({ deleted, ...(deleted ? await repairUserDerivedState(env.DB, user.id) : {}) })
  })
