// GET /api/leaderboard/total-users — count of distinct ranked users (any category; all share users).

import { runHandler, json } from '../_lib/http'
import type { RequestData } from '../_lib/auth'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const row = await context.env.DB
      .prepare("SELECT COUNT(DISTINCT user_id) AS total FROM leaderboard_cache WHERE category = 'flights'")
      .first<{ total: number }>()
    return json({ total: row?.total ?? 0 })
  })
