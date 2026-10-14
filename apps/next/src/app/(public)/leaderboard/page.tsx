import { Suspense } from 'react'
import { getLeaderboard, getOwnLeaderboardEligibility } from '../../../server/public'
import { getOptionalPublicViewer } from '../../../server/identity'
import { getRequestLocale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'
import {
  leaderboardCategories,
  type LeaderboardCategory,
} from '../../../../../../functions/api/_services/publicLeaderboard'
import { LeaderboardLoading } from '../../../client/leaderboard/leaderboard'
import { LeaderboardHeading, RankingContent } from '../../../client/leaderboard/leaderboard-content'
import '../../../client/leaderboard/leaderboard.css'

export const generateMetadata = () => pageMetadata('Leaderboard', 'Рейтинг')
export async function Ranking({ category }: { category: LeaderboardCategory }) {
  const [{ entries, total, updatedAt }, identity, locale] = await Promise.all([
    getLeaderboard(category),
    getOptionalPublicViewer(),
    getRequestLocale(),
  ])
  const own = identity ? await getOwnLeaderboardEligibility(category) : null
  return (
    <RankingContent
      entries={entries}
      own={own}
      category={category}
      locale={locale}
      total={total}
      updatedAt={updatedAt}
      memberViewer={Boolean(identity)}
    />
  )
}
export default async function Leaderboard({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const [query, locale] = await Promise.all([searchParams, getRequestLocale()])
  const category = leaderboardCategories.includes(query.category as LeaderboardCategory)
    ? (query.category as LeaderboardCategory)
    : 'flights'
  return (
    <div className="editorial-leaderboard">
      <LeaderboardHeading category={category} locale={locale} />
      <Suspense key={category} fallback={<LeaderboardLoading locale={locale} />}>
        <Ranking category={category} />
      </Suspense>
    </div>
  )
}
