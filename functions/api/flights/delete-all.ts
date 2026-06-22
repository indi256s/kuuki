// POST /api/flights/delete-all — delete every own flight, then recompute derived stats.

import { runHandler, json } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { rebuildVisitsForUser, recomputeUserStats, updateAdvancedStatsUnlocks, evaluateBadges } from '../_services/stats'
import { refreshAdvancedStats } from '../_services/advancedStats'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)

    const res = await env.DB.prepare('DELETE FROM flights WHERE user_id = ?').bind(user.id).run()
    const deleted = res.meta.changes ?? 0

    // Rebuild visits (empty now) so geo counts reset to zero (security finding #6).
    await rebuildVisitsForUser(env.DB, user.id)
    await recomputeUserStats(env.DB, user.id)
    await updateAdvancedStatsUnlocks(env.DB, user.id)
    await evaluateBadges(env.DB, user.id)
    await refreshAdvancedStats(env.DB, user.id)

    return json({ deleted })
  })
