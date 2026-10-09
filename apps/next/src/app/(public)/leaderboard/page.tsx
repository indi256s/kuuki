import Link from 'next/link'
import { Suspense } from 'react'
import { getLeaderboard, getOwnLeaderboardEligibility } from '../../../server/public'
import { getOptionalPublicViewer } from '../../../server/identity'
import { getRequestLocale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'
import {
  leaderboardCategories,
  type LeaderboardCategory,
} from '../../../../../../functions/api/_services/publicLeaderboard'
import {
  CategoryTabs,
  LeaderboardRows,
  LeaderboardLoading,
} from '../../../client/leaderboard/leaderboard'
import { categoryName } from '../../../client/leaderboard/categories'
import '../../../client/leaderboard/leaderboard.css'

export const generateMetadata = () => pageMetadata('Leaderboard', 'Рейтинг')
export async function Ranking({ category }: { category: LeaderboardCategory }) {
  const [{ entries, total, updatedAt }, identity, locale] = await Promise.all([
    getLeaderboard(category),
    getOptionalPublicViewer(),
    getRequestLocale(),
  ])
  const own = identity ? await getOwnLeaderboardEligibility(category) : null
  const ru = locale === 'ru'
  const published =
    updatedAt && Number.isFinite(Date.parse(updatedAt))
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(updatedAt),
        )
      : null
  return (
    <section aria-label={ru ? 'Места в рейтинге' : 'Leaderboard places'}>
      <p className="leaderboard-caption">
        {ru
          ? `Рейтинг: ${categoryName(category, locale).toLowerCase()}. Для участия нужно от 5 перелётов.`
          : `Ranked by ${categoryName(category, locale).toLowerCase()}. At least 5 flights required.`}
      </p>
      {published && (
        <p className="leaderboard-caption">
          {ru ? `Опубликовано: ${published}` : `Published: ${published}`}
        </p>
      )}
      <LeaderboardRows entries={entries} own={own} category={category} locale={locale} />
      {!entries.length && (
        <p>
          {ru
            ? 'Опубликованного рейтинга в этой категории пока нет.'
            : 'No published ranking is available in this category yet.'}
        </p>
      )}
      {total > entries.length && (
        <p>
          {ru
            ? `Показано ${entries.length} из ${total}.`
            : `Showing ${entries.length} of ${total} members.`}
        </p>
      )}
      {!identity && (
        <p>
          <Link href="/signin">{ru ? 'Войдите' : 'Sign in'}</Link>
          {ru ? ', чтобы участвовать.' : ' to participate.'}
        </p>
      )}
    </section>
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
      <p className="eyebrow">{locale === 'ru' ? 'Сообщество' : 'The community'}</p>
      <h1>{locale === 'ru' ? 'Рейтинг' : 'Leaderboard'}</h1>
      <CategoryTabs category={category} locale={locale} />
      <Suspense key={category} fallback={<LeaderboardLoading locale={locale} />}>
        <Ranking category={category} />
      </Suspense>
    </div>
  )
}
