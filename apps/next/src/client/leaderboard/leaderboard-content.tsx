'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { useLocale } from '../preferences'
import { CategoryTabs, LeaderboardRows } from './leaderboard'
import { categoryName } from './categories'

type RankingContentProps = Pick<
  ComponentProps<typeof LeaderboardRows>,
  'entries' | 'own' | 'category' | 'locale'
> & {
  total: number
  updatedAt: string | null
  memberViewer: boolean
}

export function RankingContent({
  entries,
  own,
  category,
  locale: initialLocale,
  total,
  updatedAt,
  memberViewer,
}: RankingContentProps) {
  const locale = useLocale(initialLocale)
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
      {!memberViewer && (
        <p>
          <Link href="/signin">{ru ? 'Войдите' : 'Sign in'}</Link>
          {ru ? ', чтобы участвовать.' : ' to participate.'}
        </p>
      )}
    </section>
  )
}

export function LeaderboardHeading({
  category,
  locale: initialLocale,
}: Pick<RankingContentProps, 'category' | 'locale'>) {
  const locale = useLocale(initialLocale)
  return (
    <>
      <p className="eyebrow">{locale === 'ru' ? 'Сообщество' : 'The community'}</p>
      <h1>{locale === 'ru' ? 'Рейтинг' : 'Leaderboard'}</h1>
      <CategoryTabs category={category} locale={locale} />
    </>
  )
}
