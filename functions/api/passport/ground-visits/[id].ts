// DELETE /api/passport/ground-visits/:id — remove one ground visit (own only).

import { runHandler, json } from '../../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../../_lib/auth'

export const onRequestDelete: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env } = context
    requireCsrf(request)
    const user = requireUser(context.data)
    const id = context.params.id as string

    await env.DB
      .prepare('DELETE FROM ground_visits WHERE id = ? AND user_id = ?')
      .bind(id, user.id)
      .run()

    return json({ ok: true })
  })
