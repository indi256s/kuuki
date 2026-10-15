'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  isGroundCategory,
  type LeaderboardCategory,
} from '../../../../../functions/api/_lib/leaderboard'
import {
  SHOW_EVERYONE_UP_TO,
  type LeaderboardBoardSlice,
  type LeaderboardEntry,
  type ViewerPlace,
} from '../../../../../functions/api/_services/publicLeaderboard'
import { formatNumber, type Locale } from '../../lib/format'
import { ProfileAvatar } from '../profile/avatar'
import { Button } from '../ui/button'
import { categoryUnit } from './categories'
import { entryName } from './model'

const PAGE = 50

type Gap = { name: string; gap: string }

function Row({
  entry,
  category,
  locale,
  own,
  leadIn,
  gap,
}: {
  entry: LeaderboardEntry
  category: LeaderboardCategory
  locale: Locale
  own: boolean
  leadIn?: string
  gap?: Gap
}) {
  const ru = locale === 'ru'
  const name = entryName(entry, locale)
  return (
    <li
      value={entry.rank}
      className="leaderboard-row"
      data-own={own || undefined}
      data-row={entry.user_id}
    >
      <span className="leaderboard-place">
        {leadIn && (
          <>
            <span className="sr-only">{leadIn}</span>{' '}
          </>
        )}
        #{entry.rank}
      </span>
      <ProfileAvatar id={entry.user_id} url={entry.avatar_url} name={name} size={36} />
      <span className="leaderboard-name">
        {entry.username ? (
          <Link href={`/fly/${encodeURIComponent(entry.username)}`}>{name}</Link>
        ) : (
          <span>{name}</span>
        )}
        {entry.username && entry.display_name && <small>@{entry.username}</small>}
        {own && <small className="leaderboard-you">{ru ? 'Вы' : 'You'}</small>}
        {gap && (
          <small className="leaderboard-gap-line">
            {ru ? `до @${gap.name} ${gap.gap}` : `${gap.gap} to @${gap.name}`}
          </small>
        )}
      </span>
      <span className="leaderboard-value">
        <strong>{formatNumber(locale, entry.value)}</strong>
        <small>{categoryUnit(category, entry.value, locale)}</small>
      </span>
    </li>
  )
}

/** Rows from #4: everyone on a small board; otherwise the top ten, then the viewer's neighbourhood. Keyed by category and period, so expansion resets with them. */
export function BoardList({
  slice,
  place,
  category,
  locale,
  userId,
  period,
}: {
  slice: LeaderboardBoardSlice
  place: ViewerPlace | null
  category: LeaderboardCategory
  locale: Locale
  userId: string | null
  period: string
}) {
  const ru = locale === 'ru'
  const list = useRef<HTMLOListElement>(null)
  const alive = useRef(true)
  const focusFrom = useRef<string | null>(null)
  const [more, setMore] = useState<LeaderboardEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    const id = focusFrom.current
    if (!id || !more) return
    focusFrom.current = null
    const row = [...(list.current?.querySelectorAll<HTMLElement>('[data-row]') ?? [])].find(
      (element) => element.dataset.row === id,
    )
    const target = row?.querySelector<HTMLElement>('a') ?? row
    if (row && target === row) row.tabIndex = -1
    target?.focus()
  }, [more])

  const expanded = more !== null
  const loaded = [...slice.top, ...(more ?? [])]
  const rows = loaded.filter((entry) => entry.rank > 3)
  let extras: LeaderboardEntry[] = []
  let showGap = false
  if (!expanded && slice.total > SHOW_EVERYONE_UP_TO && place?.state === 'ranked') {
    const shown = new Set(slice.top.map((entry) => entry.user_id))
    extras = place.neighbours.filter((entry) => !shown.has(entry.user_id))
    const last = slice.top.at(-1)
    if (extras.length && last) {
      const sharers = slice.top.filter((entry) => entry.rank === last.rank).length
      showGap = extras[0].rank !== last.rank + sharers
    }
  }
  const next = place?.state === 'ranked' ? place.next : null
  const gapFor = (entry: LeaderboardEntry): Gap | undefined =>
    next && next.entry.user_id === entry.user_id
      ? {
          name: entry.username ?? entry.display_name ?? '',
          gap: `${formatNumber(locale, next.gap)} ${categoryUnit(category, next.gap, locale)}`,
        }
      : undefined
  const leadIn =
    showGap && extras.length
      ? ru
        ? `Места с ${extras[0].rank} по ${extras.at(-1)?.rank}`
        : `Places ${extras[0].rank} to ${extras.at(-1)?.rank}`
      : undefined

  const showAll = async () => {
    setLoading(true)
    setFailed(false)
    const offset = loaded.length
    try {
      const response = await fetch(
        `/api/leaderboard?category=${category}&period=${period}&offset=${offset}&limit=${PAGE}`,
      )
      if (!response.ok) throw new Error('unavailable')
      const body = (await response.json()) as { entries: LeaderboardEntry[] }
      if (!alive.current) return
      const known = new Set(loaded.map((entry) => entry.user_id))
      const fresh = body.entries.filter((entry) => !known.has(entry.user_id))
      focusFrom.current = fresh[0]?.user_id ?? null
      setMore([...(more ?? []), ...fresh])
    } catch {
      if (alive.current) setFailed(true)
    } finally {
      if (alive.current) setLoading(false)
    }
  }

  if (!rows.length && !extras.length) return null
  return (
    <section className="leaderboard-board" aria-labelledby="leaderboard-board-title">
      <h2 id="leaderboard-board-title" className="leaderboard-board-title">
        {ru ? (isGroundCategory(category) ? 'Отправления' : 'Вылеты') : 'Departures'}
      </h2>
      <ol className="leaderboard-rows" ref={list}>
        {rows.map((entry) => (
          <Row
            key={entry.user_id}
            entry={entry}
            category={category}
            locale={locale}
            own={entry.user_id === userId}
            gap={gapFor(entry)}
          />
        ))}
        {showGap && (
          <li className="leaderboard-gap" aria-hidden="true">
            · · ·
          </li>
        )}
        {extras.map((entry, index) => (
          <Row
            key={entry.user_id}
            entry={entry}
            category={category}
            locale={locale}
            own={entry.user_id === userId}
            leadIn={index === 0 ? leadIn : undefined}
            gap={gapFor(entry)}
          />
        ))}
      </ol>
      {failed && (
        <p className="leaderboard-error" role="status">
          {ru
            ? 'Не удалось загрузить остальные места. Повторите попытку.'
            : 'Couldn’t load more places. Try again.'}
        </p>
      )}
      {slice.total > loaded.length && (
        <Button variant="ghost" onClick={showAll} loading={loading}>
          {expanded ? (ru ? 'Показать ещё' : 'Show more') : ru ? 'Показать всех' : 'Show all'}
        </Button>
      )}
    </section>
  )
}
