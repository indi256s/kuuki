// GET /api/me/stats — the requester's pre-computed user_stats row, or null if none yet.

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { toUserStats, type UserStatsRow } from '../_lib/stats'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const row = await context.env.DB.prepare('SELECT * FROM user_stats WHERE user_id = ?')
      .bind(user.id)
      .first<UserStatsRow>()
    return json(row ? toUserStats(row) : null)
  })
