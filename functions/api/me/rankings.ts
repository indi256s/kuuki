// GET /api/me/rankings — the requester's leaderboard_cache entries (empty for ineligible users).

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import {
  derivedStateJoin,
  PUBLISHED_DERIVED_STATE,
  SKY_CATEGORY_SQL,
  toLeaderboardEntry,
  type LeaderboardCacheRow,
} from '../_lib/leaderboard'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const { results } = await context.env.DB.prepare(
      `SELECT lc.* FROM leaderboard_cache lc
       JOIN profiles p ON p.id = lc.user_id
       JOIN user_stats us ON us.user_id = lc.user_id
       ${derivedStateJoin('lc')}
       WHERE lc.user_id = ? AND lc.period = 'all' AND lc.category IN ${SKY_CATEGORY_SQL}
         AND p.is_public = 1 AND p.show_on_leaderboards = 1 AND us.total_flights >= 5
         AND ${PUBLISHED_DERIVED_STATE}`,
    )
      .bind(user.id)
      .all<LeaderboardCacheRow>()
    return json(results.map(toLeaderboardEntry))
  })
