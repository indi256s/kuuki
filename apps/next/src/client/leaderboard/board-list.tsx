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
import { entryName, handleOf } from './model'

const PAGE = 50
/** The API's page cap; a re-read of the shown prefix never asks for more. */
const MAX_PAGE = 200

/** A live read of the board: rows plus the total and publication they came from. */
type Expansion = { entries: LeaderboardEntry[]; total: number; updatedAt: string | null }

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
  const [more, setMore] = useState<(Expansion & { done: boolean }) | null>(null)
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
  // Expanded, the list is the live read alone: appending it to the server-rendered head would mix two boards.
  const loaded = more ? more.entries : slice.top
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
  // The gap sits on the row to beat; when that row is on the podium or outside the list (a tie that spans the
  // neighbourhood), it moves to the viewer's own row so it is never lost.
  const listed = new Set([...rows, ...extras].map((entry) => entry.user_id))
  const gapOwner = next && (listed.has(next.entry.user_id) ? next.entry.user_id : userId)
  const gapFor = (entry: LeaderboardEntry): Gap | undefined =>
    next && entry.user_id === gapOwner
      ? {
          name: handleOf(next.entry),
          gap: `${formatNumber(locale, next.gap)} ${categoryUnit(category, next.gap, locale)}`,
        }
      : undefined
  const leadIn =
    showGap && extras.length
      ? ru
        ? `Места с ${extras[0].rank} по ${extras.at(-1)?.rank}`
        : `Places ${extras[0].rank} to ${extras.at(-1)?.rank}`
      : undefined

  const read = async (offset: number, limit: number) => {
    const response = await fetch(
      `/api/leaderboard?category=${category}&period=${period}&offset=${offset}&limit=${limit}`,
    )
    if (!response.ok) throw new Error('unavailable')
    return (await response.json()) as Expansion
  }

  // The first expansion reads from the top. Later pages append only while the board is unchanged (same total and
  // publication); otherwise the shown prefix is read again, so an opt-out or a rebuild never skips or mixes places.
  const showAll = async () => {
    setLoading(true)
    setFailed(false)
    try {
      let next: Expansion
      if (!more) next = await read(0, PAGE)
      else {
        const page = await read(more.entries.length, PAGE)
        next =
          page.total === more.total && page.updatedAt === more.updatedAt
            ? { ...page, entries: [...more.entries, ...page.entries] }
            : await read(0, Math.min(more.entries.length + PAGE, MAX_PAGE))
      }
      if (!alive.current) return
      const known = new Set(loaded.map((entry) => entry.user_id))
      focusFrom.current = next.entries.find((entry) => !known.has(entry.user_id))?.user_id ?? null
      // A read that brings nothing new ends the expansion, whatever the total says.
      setMore({ ...next, done: next.entries.length <= (more?.entries.length ?? 0) })
    } catch {
      if (alive.current) setFailed(true)
    } finally {
      if (alive.current) setLoading(false)
    }
  }

  const canLoad = !more?.done && (more?.total ?? slice.total) > loaded.length
  // A board whose loaded rows all sit on the podium (ten tied at #1) still offers the rest.
  if (!rows.length && !extras.length && !canLoad) return null
  return (
    <section className="leaderboard-board" aria-labelledby="leaderboard-board-title">
      <h2 id="leaderboard-board-title" className="leaderboard-board-title">
        {ru ? (isGroundCategory(category) ? 'Отправления' : 'Вылеты') : 'Departures'}
      </h2>
      <ol className="leaderboard-rows" ref={list} hidden={!rows.length && !extras.length}>
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
      {canLoad && (
        <Button variant="ghost" onClick={showAll} loading={loading}>
          {expanded ? (ru ? 'Показать ещё' : 'Show more') : ru ? 'Показать всех' : 'Show all'}
        </Button>
      )}
    </section>
  )
}
