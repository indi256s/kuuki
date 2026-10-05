// POST /api/flights/sync-upcoming — move upcoming flights whose stored morning-after boundary has passed
// to awaiting (ADR 0001 §2), then publish derived state. Awaiting flights count as completed.

import { runHandler, json } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { repairUserDerivedState } from '../_services/derivedState'
import { applyDueTransitions } from '../_services/lifecycle'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)

    const { awaited } = await applyDueTransitions(env.DB, { userId: user.id })
    // A publication below the rollback floor leaves the evidence stamp stale; the first lifecycle-aware
    // session reconciles it here even while the cron is held (ADR 0001 §10).
    const stale = await env.DB.prepare('SELECT 1 AS stale FROM user_derived_state WHERE user_id = ? AND evidence_revision != published_revision')
      .bind(user.id).first()
    return json({ synced: awaited, ...(awaited || stale ? await repairUserDerivedState(env.DB, user.id) : {}) })
  })
