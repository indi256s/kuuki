// GET /api/leaderboard?category=&limit=&offset= — public ranked list read from leaderboard_cache.

import { runHandler, json, HttpError } from '../_lib/http'
import type { RequestData } from '../_lib/auth'
import { toLeaderboardEntry } from '../_lib/leaderboard'
import type { LeaderboardCacheRow } from '../_lib/leaderboard'

const CATEGORIES = ['flights', 'distance', 'countries', 'cities', 'airlines']

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const url = new URL(context.request.url)
    const category = url.searchParams.get('category') ?? ''
    if (!CATEGORIES.includes(category)) {
      throw new HttpError(400, 'Invalid category', 'INVALID_CATEGORY')
    }

    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200)
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

    const db = context.env.DB
    // Filter on the LIVE show_on_leaderboards flag at read time (security finding: the cache is
    // never refreshed in production — no cron — so an opted-out user otherwise stays visible).
    const { results } = await db
      .prepare(
        `SELECT lc.* FROM leaderboard_cache lc
         JOIN profiles p ON p.id = lc.user_id
         WHERE lc.category = ? AND p.show_on_leaderboards = 1
         ORDER BY lc.rank ASC LIMIT ? OFFSET ?`,
      )
      .bind(category, limit, offset)
      .all<LeaderboardCacheRow>()

    const countRow = await db
      .prepare(
        `SELECT COUNT(*) AS total FROM leaderboard_cache lc
         JOIN profiles p ON p.id = lc.user_id
         WHERE lc.category = ? AND p.show_on_leaderboards = 1`,
      )
      .bind(category)
      .first<{ total: number }>()

    return json({ entries: (results ?? []).map(toLeaderboardEntry), total: countRow?.total ?? 0 })
  })
