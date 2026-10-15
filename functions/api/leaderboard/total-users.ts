// GET /api/leaderboard/total-users — count of distinct ranked users (any category; all share users).

import { runHandler, json } from '../_lib/http'
import type { RequestData } from '../_lib/auth'
import { derivedStateJoin, PUBLISHED_DERIVED_STATE, SKY_MIN_FLIGHTS } from '../_lib/leaderboard'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const row =
      await context.env.DB.prepare(`SELECT COUNT(DISTINCT lc.user_id) AS total FROM leaderboard_cache lc
         JOIN profiles p ON p.id = lc.user_id
         JOIN user_stats us ON us.user_id = lc.user_id
         ${derivedStateJoin('lc')}
         WHERE lc.category = 'flights' AND lc.period = 'all' AND p.is_public = 1 AND p.show_on_leaderboards = 1 AND us.total_flights >= ${SKY_MIN_FLIGHTS}
           AND ${PUBLISHED_DERIVED_STATE}`).first<{ total: number }>()
    return json({ total: row?.total ?? 0 })
  })
