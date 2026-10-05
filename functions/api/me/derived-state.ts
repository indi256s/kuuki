// GET /api/me/derived-state — owner-only status for bounded stats refetch.
import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { isDerivedReady, stateOf } from '../_services/derivedState'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const row = await stateOf(context.env.DB, user.id)
    if (!row) {
      return json({ derived_state: 'ready', revision: 0, published_revision: 0 })
    }
    const derived_state = isDerivedReady(row)
      ? 'ready'
      : row.last_error ? 'error' : 'pending'
    return json({
      derived_state,
      revision: row.revision,
      published_revision: row.published_revision,
      ...(row.last_error ? { last_error: row.last_error } : {}),
    })
  })
