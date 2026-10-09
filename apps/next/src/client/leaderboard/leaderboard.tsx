'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Plane, Route, Globe, TowerControl, Building2, Medal } from 'lucide-react'
import type {
  readPublicLeaderboard,
  readOwnLeaderboardEligibility,
  readOwnLeaderboardRank,
  LeaderboardCategory,
} from '../../../../../functions/api/_services/publicLeaderboard'
import { notificationStorage } from '../profile/storage'
import { ProfileAvatar } from '../profile/avatar'
import { IdentitySnapshot } from '../activity'
import { categoryName, categoryUnit } from './categories'
import { formatCount, formatNumber, type Locale } from '../../lib/format'
import './leaderboard.css'

type Entry = Awaited<ReturnType<typeof readPublicLeaderboard>>['entries'][number]
type Own = {
  ownerId: string
  status: Awaited<ReturnType<typeof readOwnLeaderboardEligibility>>
  rank: Awaited<ReturnType<typeof readOwnLeaderboardRank>>
}
const icons = {
  flights: Plane,
  distance: Route,
  countries: Globe,
  cities: TowerControl,
  airlines: Building2,
}
export function CategoryTabs({
  category,
  locale,
}: {
  category: LeaderboardCategory
  locale: Locale
}) {
  const [announced, setAnnounced] = useState('')
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active)
        setAnnounced(
          `${locale === 'ru' ? 'Категория рейтинга' : 'Leaderboard category'}: ${categoryName(category, locale)}`,
        )
    })
    return () => {
      active = false
    }
  }, [category, locale])
  return (
    <>
      <p className="sr-only" role="status">
        {announced}
      </p>
      <nav
        aria-label={locale === 'ru' ? 'Категории рейтинга' : 'Leaderboard categories'}
        className="leaderboard-tabs"
      >
        {Object.entries(icons).map(([key, Icon]) => (
          <Link
            key={key}
            href={`/leaderboard?category=${key}`}
            aria-current={key === category ? 'page' : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            {categoryName(key, locale)}
          </Link>
        ))}
      </nav>
    </>
  )
}
function RankRow({
  entry,
  category,
  locale,
  own = false,
}: {
  entry: Entry
  category: LeaderboardCategory
  locale: Locale
  own?: boolean
}) {
  const unit = categoryUnit(category, entry.value, locale)
  const name =
    entry.display_name ||
    (entry.username ? `@${entry.username}` : locale === 'ru' ? 'Участник' : 'Member')
  return (
    <>
      <span
        className="leaderboard-place"
        data-medal={entry.rank <= 3 ? ['gold', 'silver', 'bronze'][entry.rank - 1] : undefined}
      >
        {entry.rank <= 3 && <Medal size={18} aria-hidden="true" />}
        <span>#{entry.rank}</span>
      </span>
      <ProfileAvatar id={entry.user_id} url={entry.avatar_url} name={name} size={36} />
      <span className="leaderboard-name">
        {entry.username ? (
          <Link href={`/fly/${encodeURIComponent(entry.username)}`}>{name}</Link>
        ) : (
          name
        )}
        {entry.username && entry.display_name && <small>@{entry.username}</small>}
        {own && <small>{locale === 'ru' ? 'Вы' : 'You'}</small>}
      </span>
      <span className="leaderboard-value">
        <strong>{formatNumber(locale, entry.value)}</strong>
        <small>{unit}</small>
      </span>
    </>
  )
}
const rankMemory = new Map<
  string,
  { rank: number; period: string; seen: string[]; delta: number }
>()
export function recordRank(
  ownerId: string,
  category: LeaderboardCategory,
  rank: number,
  period: string,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
) {
  const key = `kuuki:rank:${ownerId}:${category}`
  let previous = rankMemory.get(key)
  try {
    const raw = storage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as typeof previous
      if (
        parsed &&
        Number.isFinite(parsed.rank) &&
        Number.isFinite(parsed.delta) &&
        typeof parsed.period === 'string' &&
        Array.isArray(parsed.seen) &&
        parsed.seen.every((item) => typeof item === 'string')
      ) {
        // A failed write can leave readable storage behind this tab; another tab can publish a newer baseline.
        const newest =
          !previous || Date.parse(parsed.period) > Date.parse(previous.period) ? parsed : previous
        previous = { ...newest, seen: [...new Set([...(previous?.seen ?? []), ...parsed.seen])] }
      }
    }
  } catch {
    /* blocked/corrupt storage keeps the local baseline */
  }
  if (previous) {
    rankMemory.set(key, previous)
    // History and older tabs may replay a snapshot; it must not rewind the next comparison.
    if (
      period !== previous.period &&
      (previous.seen.includes(period) || Date.parse(period) < Date.parse(previous.period))
    )
      return { delta: 0, celebrate: false }
  }
  const identity = period
  const delta = previous
    ? previous.period !== period
      ? previous.rank - rank
      : previous.delta + previous.rank - rank
    : 0
  const celebrate = previous?.period !== period && delta > 0 && !previous?.seen.includes(identity)
  const next = { rank, period, delta, seen: [...new Set([...(previous?.seen ?? []), identity])] }
  rankMemory.set(key, next)
  try {
    storage.setItem(key, JSON.stringify(next))
  } catch {
    /* no repeated celebration in this tab */
  }
  return { delta, celebrate }
}
function YourPlace({
  own,
  category,
  locale,
}: {
  own: Own
  category: LeaderboardCategory
  locale: Locale
}) {
  const [change, setChange] = useState<{
    ownerId: string
    category: string
    period: string
    delta: number
    celebrate: boolean
  } | null>(null)
  const ru = locale === 'ru'
  useEffect(() => {
    let active = true
    const rank = own.rank
    queueMicrotask(() => {
      if (active && rank)
        setChange({
          ownerId: own.ownerId,
          category,
          period: rank.period,
          ...recordRank(own.ownerId, category, rank.entry.rank, rank.period, notificationStorage()),
        })
    })
    const reset = () => {
      active = false
      setChange(null)
    }
    window.addEventListener('kuuki:identity-reset', reset)
    return () => {
      active = false
      window.removeEventListener('kuuki:identity-reset', reset)
    }
  }, [own.ownerId, own.rank, category])
  const current =
    change?.ownerId === own.ownerId &&
    change.category === category &&
    change.period === own.rank?.period
      ? change
      : null
  let message
  if (own.status.pending)
    message = ru
      ? 'Ваши изменения ещё обрабатываются. Место обновится после публикации.'
      : 'Your changes are still being prepared. Your place will update after publication.'
  else if (!own.status.isPublic || !own.status.optedIn)
    message = (
      <>
        {ru
          ? 'Откройте профиль и включите участие в рейтинге.'
          : 'Make your profile public and enable leaderboard participation.'}{' '}
        <Link href="/settings">{ru ? 'Настройки' : 'Settings'}</Link>
      </>
    )
  else if (own.status.totalFlights === null)
    message = ru
      ? 'Статистика готовится. Место появится после публикации.'
      : 'Statistics are being prepared. Your place will appear after publication.'
  else if (own.status.totalFlights < 5)
    message = (
      <>
        {formatCount(locale, 5 - own.status.totalFlights, {
          en: { one: '{count} more flight to join.', other: '{count} more flights to join.' },
          ru: {
            one: 'До участия остался {count} перелёт.',
            few: 'До участия осталось {count} перелёта.',
            many: 'До участия осталось {count} перелётов.',
            other: 'До участия осталось {count} перелёта.',
          },
        })}
        <progress
          max={5}
          value={own.status.totalFlights}
          aria-label={ru ? 'Перелёты для участия' : 'Flights toward eligibility'}
        />
      </>
    )
  else if (own.rank)
    message = (
      <>
        {ru ? 'Ваше место' : 'Your place'}: #{own.rank.entry.rank}
        {current?.delta ? (
          <>
            {' '}
            ·{' '}
            {current.delta > 0
              ? ru
                ? 'Поднялись на'
                : 'Up by'
              : ru
                ? 'Опустились на'
                : 'Down by'}{' '}
            {Math.abs(current.delta)} ·{' '}
            {ru ? 'С предыдущей публикации' : 'Since the previous publication'}
          </>
        ) : null}
      </>
    )
  else
    message = ru
      ? 'Вы участвуете. Место появится после публикации рейтинга.'
      : 'You are eligible. Your place will appear when the rankings are published.'
  return (
    <IdentitySnapshot ownerId={own.ownerId}>
      <p
        className="leaderboard-eligibility"
        role="status"
        data-celebrate={current?.celebrate || undefined}
      >
        {message}
      </p>
    </IdentitySnapshot>
  )
}
export function LeaderboardRows({
  entries,
  category,
  locale,
  own,
}: {
  entries: Entry[]
  category: LeaderboardCategory
  locale: Locale
  own: Own | null
}) {
  const original = useRef<HTMLLIElement>(null)
  const [observation, setObservation] = useState<{ key: string; outside: boolean } | null>(null)
  const observationKey = `${category}:${own?.ownerId ?? ''}`
  const ownEntry = own?.rank?.entry ?? entries.find((entry) => entry.user_id === own?.ownerId)
  useEffect(() => {
    if (!ownEntry || !original.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) =>
      setObservation({ key: observationKey, outside: !entry.isIntersecting }),
    )
    observer.observe(original.current)
    return () => observer.disconnect()
  }, [entries, ownEntry, observationKey])
  const listed = entries.some((entry) => entry.user_id === own?.ownerId)
  const pinned =
    !!ownEntry && ((observation?.key === observationKey && observation.outside) || !listed)
  return (
    <>
      {own && <YourPlace own={own} category={category} locale={locale} />}
      <ol className="leaderboard-rows">
        {entries.map((entry) => (
          <li
            key={entry.user_id}
            ref={entry.user_id === own?.ownerId ? original : undefined}
            className={entry.user_id === own?.ownerId ? 'leaderboard-own' : ''}
            aria-hidden={entry.user_id === own?.ownerId && pinned ? true : undefined}
            inert={entry.user_id === own?.ownerId && pinned ? true : undefined}
          >
            <RankRow
              entry={entry}
              category={category}
              locale={locale}
              own={entry.user_id === own?.ownerId}
            />
          </li>
        ))}
      </ol>
      {pinned && own && ownEntry && (
        <IdentitySnapshot ownerId={own.ownerId}>
          <aside
            className="leaderboard-pin"
            aria-label={locale === 'ru' ? 'Ваше место в рейтинге' : 'Your leaderboard place'}
          >
            <RankRow entry={ownEntry} category={category} locale={locale} own />
          </aside>
        </IdentitySnapshot>
      )}
    </>
  )
}

export function LeaderboardLoading({ locale }: { locale: Locale }) {
  return (
    <div className="leaderboard-loading" aria-busy="true">
      <p role="status">{locale === 'ru' ? 'Загружаем рейтинг…' : 'Loading rankings…'}</p>
      <ol className="leaderboard-rows" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index}>
            <span className="rank-placeholder" />
            <span className="avatar-placeholder" />
            <span className="name-placeholder" />
            <span className="value-placeholder" />
          </li>
        ))}
      </ol>
    </div>
  )
}
