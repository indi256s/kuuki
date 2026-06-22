// POST /api/flights/bulk-delete — delete the given own flights, then recompute derived stats.
// D1 caps bound variables per statement, so ids are chunked into batched DELETEs.

import { runHandler, readJson, json } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { rebuildVisitsForUser, recomputeUserStats, updateAdvancedStatsUnlocks, evaluateBadges } from '../_services/stats'
import { refreshAdvancedStats } from '../_services/advancedStats'

interface Body {
  ids?: number[]
}

const CHUNK = 90

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)

    const body = await readJson<Body>(request)
    const ids = (body?.ids ?? []).filter((id) => Number.isFinite(id))
    if (ids.length === 0) return json({ deleted: 0 })

    let deleted = 0
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      const placeholders = chunk.map(() => '?').join(', ')
      const res = await env.DB
        .prepare(`DELETE FROM flights WHERE user_id = ? AND id IN (${placeholders})`)
        .bind(user.id, ...chunk)
        .run()
      deleted += res.meta.changes ?? 0
    }

    // Rebuild visits from remaining flights so geo counts decrement (security finding #6).
    await rebuildVisitsForUser(env.DB, user.id)
    await recomputeUserStats(env.DB, user.id)
    await updateAdvancedStatsUnlocks(env.DB, user.id)
    await evaluateBadges(env.DB, user.id)
    await refreshAdvancedStats(env.DB, user.id)

    return json({ deleted })
  })
