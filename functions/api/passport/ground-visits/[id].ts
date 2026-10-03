// DELETE /api/passport/ground-visits/:id — remove one ground visit (own only).

import { runHandler, json } from '../../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../../_lib/auth'
import { dirtyUserStatement, repairUserDerivedState } from '../../_services/derivedState'

export const onRequestDelete: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env } = context
    requireCsrf(request)
    const user = requireUser(context.data)
    const id = context.params.id as string

    const [result] = await env.DB.batch([
      env.DB.prepare('DELETE FROM ground_visits WHERE id = ? AND user_id = ?').bind(id, user.id),
      dirtyUserStatement(env.DB, user.id, true),
    ])

    return json({ ok: true, ...(result.meta.changes ? await repairUserDerivedState(env.DB, user.id) : {}) })
  })
