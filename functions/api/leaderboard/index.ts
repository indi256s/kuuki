import { runHandler, json, HttpError } from '../_lib/http'
import {
  isLeaderboardPeriod,
  leaderboardCategories,
  readPublicLeaderboard,
  type LeaderboardCategory,
} from '../_services/publicLeaderboard'

export const onRequestGet: PagesFunction<Env> = (context) =>
  runHandler(async () => {
    const params = new URL(context.request.url).searchParams
    const category = params.get('category') ?? ''
    if (!leaderboardCategories.includes(category as LeaderboardCategory)) {
      throw new HttpError(400, 'Invalid category', 'INVALID_CATEGORY')
    }
    const period = params.get('period') ?? 'all'
    if (!isLeaderboardPeriod(period)) {
      throw new HttpError(400, 'Invalid period', 'INVALID_PERIOD')
    }
    const limit = Number(params.get('limit')) || 50
    const offset = Number(params.get('offset')) || 0
    return json(
      await readPublicLeaderboard(
        context.env.DB,
        category as LeaderboardCategory,
        limit,
        offset,
        period,
      ),
    )
  })
