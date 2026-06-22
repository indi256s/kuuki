// POST /api/flights/sync-upcoming — flip past upcoming flights to completed, derive their visits
// (parity with the Postgres AFTER UPDATE visits trigger), then recompute derived stats.

import { runHandler, json } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { nowIso } from '../_lib/time'
import {
  syncVisitsFromFlight,
  recomputeUserStats,
  updateAdvancedStatsUnlocks,
  evaluateBadges,
} from '../_services/stats'
import { refreshAdvancedStats } from '../_services/advancedStats'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)

    const today = nowIso().slice(0, 10)

    const due = await env.DB
      .prepare('SELECT origin, destination, date FROM flights WHERE user_id = ? AND is_upcoming = 1 AND date <= ?')
      .bind(user.id, today)
      .all<{ origin: string; destination: string; date: string }>()

    if (due.results.length === 0) return json({ synced: 0 })

    await env.DB
      .prepare('UPDATE flights SET is_upcoming = 0 WHERE user_id = ? AND is_upcoming = 1 AND date <= ?')
      .bind(user.id, today)
      .run()

    for (const f of due.results) {
      await syncVisitsFromFlight(env.DB, user.id, {
        origin: f.origin,
        destination: f.destination,
        date: f.date,
        is_upcoming: 0,
      })
    }

    await recomputeUserStats(env.DB, user.id)
    await updateAdvancedStatsUnlocks(env.DB, user.id)
    await evaluateBadges(env.DB, user.id)
    await refreshAdvancedStats(env.DB, user.id)

    return json({ synced: due.results.length })
  })
