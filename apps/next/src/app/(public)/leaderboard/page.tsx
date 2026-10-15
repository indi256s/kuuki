import { Suspense } from 'react'
import { getLeaderboardBoard } from '../../../server/public'
import { getRequestLocale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'
import { LEADERBOARD_CATEGORIES } from '../../../../../../functions/api/_lib/leaderboard'
import type { LeaderboardCategory } from '../../../../../../functions/api/_services/publicLeaderboard'
import { LeaderboardBoard, LeaderboardLoading } from '../../../client/leaderboard/leaderboard'
import '../../../client/leaderboard/leaderboard.css'

type Query = { category?: string; period?: string }

export const generateMetadata = () => pageMetadata('Leaderboard', 'Рейтинг')

/** The one read behind the page. Category and period are client state, so nothing here is keyed on them. */
export async function LeaderboardData({ searchParams }: { searchParams: Promise<Query> }) {
  const [payload, locale, query] = await Promise.all([
    getLeaderboardBoard(),
    getRequestLocale(),
    searchParams,
  ])
  const category = LEADERBOARD_CATEGORIES.includes(query.category as LeaderboardCategory)
    ? (query.category as LeaderboardCategory)
    : 'flights'
  const period = query.period === payload.year ? payload.year : 'all'
  return (
    <LeaderboardBoard
      payload={payload}
      locale={locale}
      initialCategory={category}
      initialPeriod={period}
    />
  )
}

export default async function Leaderboard({ searchParams }: { searchParams: Promise<Query> }) {
  const locale = await getRequestLocale()
  return (
    <div className="editorial-leaderboard">
      <Suspense fallback={<LeaderboardLoading locale={locale} />}>
        <LeaderboardData searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
