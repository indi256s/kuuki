// DELETE /api/passport/ground-visits/:id — remove one ground visit (own only).

import { runHandler, json } from '../../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../../_lib/auth'
import { dirtyUserStatement, repairUserDerivedState } from '../../_services/derivedState'

export const onRequestDelete: PagesFunction<Env, string, RequestData> = context =>
  deleteGroundVisitRequest(context.request, context.env, context.data, context.params.id as string)

/** Request/Response entry keeps compatibility transport separate from domain writes. */
export function deleteGroundVisitRequest(request: Request, env: Env, data: RequestData, rawId: string): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const id = rawId

    const [result] = await env.DB.batch([
      env.DB.prepare('DELETE FROM ground_visits WHERE id = ? AND user_id = ?').bind(id, user.id),
      dirtyUserStatement(env.DB, user.id, true),
    ])

    return json({ ok: true, ...(result.meta.changes ? await repairUserDerivedState(env.DB, user.id) : {}) })
  })
}
