// GET /api/me/rankings — the requester's leaderboard_cache entries (empty for ineligible users).

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { toLeaderboardEntry, type LeaderboardCacheRow } from '../_lib/leaderboard'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const { results } = await context.env.DB.prepare(
      `SELECT lc.* FROM leaderboard_cache lc
       JOIN profiles p ON p.id = lc.user_id
       JOIN user_stats us ON us.user_id = lc.user_id
       LEFT JOIN user_derived_state ds ON ds.user_id = lc.user_id
       WHERE lc.user_id = ? AND p.show_on_leaderboards = 1 AND us.total_flights >= 5
         AND (ds.user_id IS NULL OR ds.revision = ds.published_revision)`,
    )
      .bind(user.id)
      .all<LeaderboardCacheRow>()
    return json(results.map(toLeaderboardEntry))
  })
