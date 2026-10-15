'use client'

import Link from 'next/link'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  LEADERBOARD_CATEGORIES,
  type LeaderboardCategory,
} from '../../../../../functions/api/_lib/leaderboard'
import type { LeaderboardBoardPayload } from '../../../../../functions/api/_services/publicLeaderboard'
import { IdentitySnapshot } from '../activity'
import { notificationStorage } from '../profile/storage'
import { useLocale } from '../preferences'
import { SegmentedControl } from '../ui/segmented-control'
import { Skeleton } from '../ui/skeleton'
import type { Locale } from '../../lib/format'
import { BoardList } from './board-list'
import { CategoryStrip } from './category-strip'
import { categoryGroups, groupName } from './categories'
import { narratorChoice, shownEntry, viewerPlace, type RankChanges } from './model'
import { narrate } from './narrator'
import { Podium } from './podium'
import './leaderboard.css'

const subscribeNoop = () => () => {}

/** Mirrors the selection in the address bar without navigating, as the Journal does. */
function mirror(category: LeaderboardCategory, period: string) {
  const params = new URLSearchParams(window.location.search)
  params.set('category', category)
  params.set('period', period)
  window.history.replaceState(null, '', `?${params}`)
}

/**
 * Rank up: `recordRank` runs once per publication for every all-time place. A tile that climbed first paints its old
 * rank, then flips to the new one when it scrolls into view; several tiles flip 60ms apart.
 */
function useRankUp(payload: LeaderboardBoardPayload, navRef: React.RefObject<HTMLElement | null>) {
  const [changes, setChanges] = useState<RankChanges>({})
  const [flipped, setFlipped] = useState<Partial<Record<LeaderboardCategory, true>>>({})
  const results = useRef<{ key: string; changes: RankChanges } | null>(null)
  const viewer = payload.viewer
  const updatedAt = payload.updatedAt
  // Before paint, so the old rank is what the first frame shows.
  useLayoutEffect(() => {
    if (!viewer) return
    const key = `${viewer.userId}:${updatedAt ?? ''}`
    // Strict mode runs this twice; the second recordRank would report nothing new.
    if (results.current?.key !== key) {
      const storage = notificationStorage()
      const next: RankChanges = {}
      for (const category of LEADERBOARD_CATEGORIES) {
        const entry = shownEntry(viewer.places[category]?.all ?? null)
        if (entry)
          next[category] = recordRank(viewer.userId, category, entry.rank, updatedAt ?? '', storage)
      }
      results.current = { key, changes: next }
    }
    setChanges(results.current.changes)
    const reset = () => {
      setChanges({})
      setFlipped({})
    }
    window.addEventListener('kuuki:identity-reset', reset)
    return () => window.removeEventListener('kuuki:identity-reset', reset)
  }, [viewer, updatedAt])

  useEffect(() => {
    const climbing = LEADERBOARD_CATEGORIES.filter((category) => changes[category]?.celebrate)
    if (!climbing.length) return
    const timers: number[] = []
    const observers: IntersectionObserver[] = []
    let slot = 0
    const flip = (category: LeaderboardCategory) => {
      timers.push(
        window.setTimeout(() => setFlipped((now) => ({ ...now, [category]: true })), slot++ * 60),
      )
    }
    for (const category of climbing) {
      const tile = navRef.current?.querySelector<HTMLElement>(`[data-category="${category}"]`)
      if (!tile || typeof IntersectionObserver === 'undefined') {
        flip(category)
        continue
      }
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return
          observer.disconnect()
          flip(category)
        },
        { threshold: 0.6 },
      )
      observer.observe(tile)
      observers.push(observer)
    }
    return () => {
      for (const observer of observers) observer.disconnect()
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [changes, navRef])

  const shownRanks: Partial<Record<LeaderboardCategory, number>> = {}
  for (const category of LEADERBOARD_CATEGORIES) {
    const change = changes[category]
    const entry = shownEntry(viewer?.places[category]?.all ?? null)
    if (change?.celebrate && !flipped[category] && entry)
      shownRanks[category] = entry.rank + change.delta
  }
  return { changes, shownRanks }
}

function relativeUpdated(updatedAt: string, now: number, locale: Locale) {
  const minutes = Math.max(0, Math.round((now - Date.parse(updatedAt)) / 60_000))
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
  const text =
    minutes < 60
      ? format.format(-minutes, 'minute')
      : minutes < 60 * 24
        ? format.format(-Math.round(minutes / 60), 'hour')
        : format.format(-Math.round(minutes / (60 * 24)), 'day')
  return locale === 'ru' ? `Обновлено ${text}` : `Updated ${text}`
}

function Updated({ updatedAt, locale }: { updatedAt: string | null; locale: Locale }) {
  // Once per render: it does not tick.
  const [now] = useState(() => Date.now())
  if (!updatedAt || !Number.isFinite(Date.parse(updatedAt))) return null
  const absolute = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(updatedAt))
  return (
    <p className="leaderboard-updated">
      <time dateTime={updatedAt} title={absolute} suppressHydrationWarning>
        {relativeUpdated(updatedAt, now, locale)}
      </time>
    </p>
  )
}

function Heading({ locale, children }: { locale: Locale; children?: ReactNode }) {
  return (
    <div className="leaderboard-head">
      <h1 className="mobile-sr-only">{locale === 'ru' ? 'Рейтинг' : 'Leaderboard'}</h1>
      {children}
    </div>
  )
}

export function LeaderboardBoard({
  payload,
  locale: initialLocale,
  initialCategory,
  initialPeriod,
}: {
  payload: LeaderboardBoardPayload
  locale: Locale
  initialCategory: LeaderboardCategory
  initialPeriod: string
}) {
  const locale = useLocale(initialLocale)
  const ru = locale === 'ru'
  const [category, setCategory] = useState(initialCategory)
  const [period, setPeriod] = useState(initialPeriod)
  // Only the hydration render (a hard load) lets the podium rise; client navigation and later switches paint settled.
  const hydrating = useSyncExternalStore(
    subscribeNoop,
    () => false,
    () => true,
  )
  const [rise, setRise] = useState(hydrating)
  const navRef = useRef<HTMLElement>(null)
  const { changes, shownRanks } = useRankUp(payload, navRef)
  const select = (nextCategory: LeaderboardCategory, nextPeriod: string) => {
    setCategory(nextCategory)
    setPeriod(nextPeriod)
    setRise(false)
    mirror(nextCategory, nextPeriod)
  }
  const slice = payload.boards[category]?.[period] ?? { top: [], total: 0 }
  const place = viewerPlace(payload, category, period)
  const choice = narratorChoice(payload, category, period, locale, changes[category])
  const narration = narrate(choice.state, choice.params, locale)
  const body = (
    <>
      <CategoryStrip
        payload={payload}
        locale={locale}
        category={category}
        period={period}
        shownRanks={shownRanks}
        navRef={navRef}
        onSelect={(next) => select(next, period)}
      />
      <p className="leaderboard-narrator">
        {narration.text}
        {narration.link && (
          <>
            {' '}
            <Link href={narration.link.href}>{narration.link.label}</Link>
          </>
        )}
      </p>
      <Podium
        top={slice.top}
        category={category}
        period={period}
        guest={!payload.viewer}
        locale={locale}
        rise={rise}
      />
      <BoardList
        key={`${category}:${period}`}
        slice={slice}
        place={place}
        category={category}
        locale={locale}
        userId={payload.viewer?.userId ?? null}
        period={period}
      />
      <Updated updatedAt={payload.updatedAt} locale={locale} />
    </>
  )
  return (
    <>
      <Heading locale={locale}>
        <SegmentedControl
          dense
          value={period}
          onChange={(next) => select(category, next)}
          label={ru ? 'Период' : 'Period'}
          options={[
            { value: payload.year, label: payload.year },
            { value: 'all', label: ru ? 'Всё время' : 'All time' },
          ]}
        />
      </Heading>
      {payload.viewer ? (
        <IdentitySnapshot ownerId={payload.viewer.userId}>{body}</IdentitySnapshot>
      ) : (
        body
      )}
    </>
  )
}

/** Suspense fallback with the strip's and the podium's geometry, so nothing shifts when the board arrives. */
export function LeaderboardLoading({ locale: initialLocale }: { locale: Locale }) {
  const locale = useLocale(initialLocale)
  const ru = locale === 'ru'
  return (
    <div className="leaderboard-loading" aria-busy="true">
      <Heading locale={locale} />
      <div className="leaderboard-tiles" aria-hidden="true">
        {categoryGroups.map(([group, keys]) => (
          <div key={group} className="leaderboard-group">
            <p className="leaderboard-group-label">{groupName[group][ru ? 1 : 0]}</p>
            <div className="leaderboard-group-tiles">
              {keys.map((key) => (
                <Skeleton key={key} height={72} label="" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="leaderboard-narrator" role="status">
        {ru ? 'Загружаем рейтинг…' : 'Loading rankings…'}
      </p>
      <ol className="leaderboard-podium" aria-hidden="true">
        {[0, 1, 2].map((position) => (
          <li key={position} className="leaderboard-sign" data-pos={position}>
            <Skeleton height="100%" label="" />
          </li>
        ))}
      </ol>
    </div>
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
