// GET /api/me/rankings — the requester's leaderboard_cache entries (empty for ineligible users).

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { toLeaderboardEntry, type LeaderboardCacheRow } from '../_lib/leaderboard'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const { results } = await context.env.DB.prepare(
      'SELECT * FROM leaderboard_cache WHERE user_id = ?',
    )
      .bind(user.id)
      .all<LeaderboardCacheRow>()
    return json(results.map(toLeaderboardEntry))
  })
