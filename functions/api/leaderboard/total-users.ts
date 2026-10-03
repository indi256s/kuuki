// GET /api/leaderboard/total-users — count of distinct ranked users (any category; all share users).

import { runHandler, json } from '../_lib/http'
import type { RequestData } from '../_lib/auth'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const row = await context.env.DB
      .prepare(`SELECT COUNT(DISTINCT lc.user_id) AS total FROM leaderboard_cache lc
         JOIN profiles p ON p.id = lc.user_id
         JOIN user_stats us ON us.user_id = lc.user_id
         LEFT JOIN user_derived_state ds ON ds.user_id = lc.user_id
         WHERE lc.category = 'flights' AND p.show_on_leaderboards = 1 AND us.total_flights >= 5
           AND (ds.user_id IS NULL OR ds.revision = ds.published_revision)`)
      .first<{ total: number }>()
    return json({ total: row?.total ?? 0 })
  })
