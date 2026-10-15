// GET /api/me/rankings — the requester's leaderboard_cache entries (empty for ineligible users).

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { readProfileLeaderboardRankings } from '../_services/publicLeaderboard'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    return json(await readProfileLeaderboardRankings(context.env.DB, user.id))
  })
