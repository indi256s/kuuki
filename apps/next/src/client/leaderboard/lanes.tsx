'use client'

import Link from 'next/link'
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
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
import { avatarInk, ProfileAvatar } from '../profile/avatar'
import { Button } from '../ui/button'
import { categoryUnit } from './categories'
import {
  laneArt,
  laneGeometry,
  laneSpots,
  LANE_TYPES,
  type LaneVehicleKey,
} from './lanes/lanes.generated'
import { entryName, handleOf } from './model'
import './lanes/vehicles.generated.css'

const PAGE = 50
/** The API's page cap; a re-read of the shown prefix never asks for more. */
const MAX_PAGE = 200
const MEDALS = ['gold', 'silver', 'bronze'] as const
/** Lanes re-order with FLIP when the board changes: on-screen movement, like the Overview card reorder. */
const MOVE_MS = 280
const ENTER_MS = 150
const EASE_IN_OUT = 'cubic-bezier(.77,0,.175,1)'
const EASE_OUT = 'cubic-bezier(.23,1,.32,1)'

/** A live read of the board: rows plus the total and publication they came from. */
type Expansion = { entries: LeaderboardEntry[]; total: number; updatedAt: string | null }

type Gap = { name: string; gap: string }

const artUrl = (key: LaneVehicleKey) => {
  const asset = laneArt[key]
  return typeof asset === 'string' ? asset : asset.src
}

/**
 * Sky lanes fly the member's most-flown type (or the generic airliner). Trains run the locomotive and Cars the car;
 * ground Countries runs whichever the member covered more kilometres by, the car when unknown.
 */
export function laneVehicle(
  category: LeaderboardCategory,
  aircraft: string | null,
  vehicle: 'rail' | 'road' | null = null,
): LaneVehicleKey {
  if (category === 'rail') return 'rail'
  if (category === 'ground_countries') return vehicle ?? 'road'
  if (isGroundCategory(category)) return 'road'
  return (LANE_TYPES as readonly string[]).includes(aircraft ?? '')
    ? (aircraft as LaneVehicleKey)
    : 'GENERIC'
}

/** Distance markers on the taxiway: a round step (1, 2 or 5 × 10ⁿ) giving at most seven marks up to the leader. */
export function markStep(max: number) {
  if (!(max > 0)) return 0
  const base = 10 ** Math.floor(Math.log10(max / 7))
  return [1, 2, 5, 10].map((k) => k * base).find((step) => max / step <= 7) ?? 10 * base
}

function Vehicle({
  vehicle,
  frame,
}: {
  vehicle: LaneVehicleKey
  /** A viewBox of its own (the spotter card's close-up); the family's shared one otherwise. */
  frame?: readonly number[]
}) {
  const { viewBox } = laneGeometry[vehicle === 'rail' || vehicle === 'road' ? 'ground' : 'air']
  const [x, y, w, h] = viewBox
  return (
    <svg className="iso-svg lane-vehicle" viewBox={(frame ?? viewBox).join(' ')} aria-hidden="true">
      <use href={`${artUrl(vehicle)}#lane-${vehicle}`} x={x} y={y} width={w} height={h} />
    </svg>
  )
}

/**
 * The viewer's own airliner is the one live thing on the board: its upper anti-collision beacon flashes. An element
 * over the drawing, not inside it, so each flash is a composited opacity change that never repaints the aircraft.
 */
function Beacon({ type }: { type: (typeof LANE_TYPES)[number] }) {
  const [x0, y0, w, h] = laneGeometry.air.viewBox
  const [x, y] = laneSpots[type].beacon
  return (
    <span
      className="lane-beacon"
      style={{ left: `${((x - x0) / w) * 100}%`, top: `${((y - y0) / h) * 100}%` }}
    />
  )
}

/** Hover or keyboard focus on a lane opens a close-up of its airliner with the type's name and measured size. */
function Spotter({ type, locale }: { type: (typeof LANE_TYPES)[number]; locale: Locale }) {
  const spot = laneSpots[type]
  const metres = (value: number) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${locale === 'ru' ? 'м' : 'm'}`
  return (
    <span className="lane-spotter" aria-hidden="true">
      <Vehicle vehicle={type} frame={spot.box} />
      <span className="lane-spotter-name">{spot.name}</span>
      <span className="lane-spotter-size">
        {locale === 'ru'
          ? `Длина ${metres(spot.length)} · Размах ${metres(spot.span)}`
          : `Length ${metres(spot.length)} · Span ${metres(spot.span)}`}
      </span>
    </span>
  )
}

function Lane({
  entry,
  category,
  locale,
  max,
  own,
  ghost,
  leadIn,
  gap,
}: {
  entry: LeaderboardEntry
  category: LeaderboardCategory
  locale: Locale
  /** The board's top value: every lane shares this one scale. */
  max: number
  own: boolean
  /** The viewer's last published place while a change is pending: shown to them alone, off the public order. */
  ghost?: boolean
  leadIn?: string
  gap?: Gap
}) {
  const ru = locale === 'ru'
  const id = useId()
  // Escape closes the spotter card until the pointer or focus leaves the lane (WCAG 1.4.13).
  const [quiet, setQuiet] = useState(false)
  const name = entryName(entry, locale)
  const vehicle = laneVehicle(category, entry.aircraft, entry.vehicle)
  const medal = !ghost && entry.rank <= 3 ? MEDALS[entry.rank - 1] : undefined
  const at = max > 0 ? Math.min(1, Math.max(0, entry.value / max)) : 0
  const type = vehicle === 'GENERIC' || vehicle === 'rail' || vehicle === 'road' ? null : vehicle
  const ground = vehicle === 'rail' || vehicle === 'road'
  return (
    <li
      value={entry.rank}
      className="lane"
      data-own={own || undefined}
      data-ghost={ghost || undefined}
      data-quiet={quiet || undefined}
      data-row={entry.user_id}
      style={{ '--lane-at': at, '--lane-livery': avatarInk(entry.user_id) } as CSSProperties}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && type) setQuiet(true)
      }}
      onPointerLeave={() => setQuiet(false)}
      onBlur={() => setQuiet(false)}
    >
      <div className="lane-head">
        <span className="lane-place" id={`${id}-place`} data-medal={medal}>
          {leadIn && (
            <>
              <span className="sr-only">{leadIn}</span>{' '}
            </>
          )}
          #{entry.rank}
        </span>
        <ProfileAvatar
          id={entry.user_id}
          url={entry.avatar_url}
          face={entry.avatar_face}
          name=""
          size={28}
        />
        <span className="lane-name">
          {entry.username ? (
            <Link
              href={`/fly/${encodeURIComponent(entry.username)}`}
              aria-describedby={`${id}-place ${id}-value${type ? ` ${id}-type` : ''}`}
            >
              {name}
            </Link>
          ) : (
            <span>{name}</span>
          )}
          {own && (
            <small className="lane-you">
              {ghost ? (ru ? 'Вы · публикуется' : 'You · publishing') : ru ? 'Вы' : 'You'}
            </small>
          )}
          {type && (
            <span className="lane-type-anchor">
              <small className="lane-type">{type}</small>
              <span className="sr-only" id={`${id}-type`}>
                {laneSpots[type].name}
              </span>
              <Spotter type={type} locale={locale} />
            </span>
          )}
        </span>
        <span className="lane-value" id={`${id}-value`}>
          <strong>{formatNumber(locale, entry.value)}</strong>{' '}
          <small>{categoryUnit(category, entry.value, locale)}</small>
        </span>
      </div>
      <div className="lane-track" aria-hidden="true">
        <span className="lane-run" />
        <span className="lane-veh" data-vehicle={vehicle}>
          <Vehicle vehicle={vehicle} />
          {own && !ghost && !ground && <Beacon type={vehicle as (typeof LANE_TYPES)[number]} />}
          {medal && (
            <span className="lane-medal" data-medal={medal}>
              {entry.rank}
            </span>
          )}
        </span>
      </div>
      {gap && (
        <small className="lane-gap-line">
          {ru ? `до @${gap.name} ${gap.gap}` : `${gap.gap} to @${gap.name}`}
        </small>
      )}
    </li>
  )
}

/**
 * FLIP: when the board changes, each lane that stays slides from its old row and its vehicle from its old distance;
 * a lane that arrives fades in. Offsets are layout positions (offsetTop/offsetLeft), so scrolling between switches
 * never skews them. Reduced motion paints the new board at once.
 */
function useLaneFlip(
  list: React.RefObject<HTMLOListElement | null>,
  board: string,
  rows: string,
  instant: boolean,
) {
  const last = useRef<{
    board: string
    at: Map<string, { top: number; left: number; run: number }>
  } | null>(null)
  const running = useRef<Animation[]>([])
  useLayoutEffect(() => {
    const element = list.current
    if (!element) return
    const lanes = [...element.querySelectorAll<HTMLElement>('.lane[data-row]')]
    // An interrupted switch starts from where each lane is drawn now, not from the end of the move it cut short.
    const drawn = new Map(
      lanes.map((lane) => {
        const vehicle = lane.querySelector<HTMLElement>('.lane-veh')
        const shift = (target: HTMLElement | null) =>
          target && running.current.length && typeof DOMMatrixReadOnly === 'function'
            ? new DOMMatrixReadOnly(getComputedStyle(target).transform)
            : null
        return [lane.dataset.row!, { y: shift(lane)?.m42 ?? 0, x: shift(vehicle)?.m41 ?? 0 }]
      }),
    )
    const at = new Map(
      lanes.map((lane) => [
        lane.dataset.row!,
        {
          top: lane.offsetTop,
          left: lane.querySelector<HTMLElement>('.lane-veh')?.offsetLeft ?? 0,
          run: lane.querySelector<HTMLElement>('.lane-run')?.offsetWidth ?? 0,
        },
      ]),
    )
    const previous = last.current
    last.current = { board, at }
    if (!previous || previous.board === board) return
    for (const animation of running.current) animation.cancel()
    running.current = []
    if (instant || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    for (const lane of lanes) {
      if (typeof lane.animate !== 'function') return
      const before = previous.at.get(lane.dataset.row!)
      const now = at.get(lane.dataset.row!)!
      if (!before) {
        running.current.push(
          lane.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ENTER_MS, easing: EASE_OUT }),
        )
        continue
      }
      const shift = drawn.get(lane.dataset.row!)!
      const dy = before.top + shift.y - now.top
      const dx = before.left + shift.x - now.left
      if (dy)
        running.current.push(
          lane.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
            duration: MOVE_MS,
            easing: EASE_IN_OUT,
          }),
        )
      const vehicle = lane.querySelector<HTMLElement>('.lane-veh')
      if (dx && vehicle)
        running.current.push(
          vehicle.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], {
            duration: MOVE_MS,
            easing: EASE_IN_OUT,
          }),
        )
      // The run ends at the nose, so it stretches by the same distance the vehicle travels.
      const run = lane.querySelector<HTMLElement>('.lane-run')
      if (dx && run && now.run > 0)
        running.current.push(
          run.animate(
            [
              { transform: `scaleX(${Math.max(0, now.run + dx) / now.run})` },
              { transform: 'none' },
            ],
            { duration: MOVE_MS, easing: EASE_IN_OUT },
          ),
        )
    }
  }, [list, board, rows, instant])
}

/**
 * The race: one lane per participant on one shared scale, the lane's length is the value. Everyone up to 20
 * participants; otherwise the top ten, then the viewer's neighbourhood. Show all reads further pages.
 */
export function RaceLanes({
  slice,
  place,
  category,
  period,
  locale,
  userId,
  guest,
  instant,
}: {
  slice: LeaderboardBoardSlice
  place: ViewerPlace | null
  category: LeaderboardCategory
  period: string
  locale: Locale
  userId: string | null
  guest: boolean
  /** The switch came from the keyboard: re-order without motion. */
  instant: boolean
}) {
  const ru = locale === 'ru'
  const board = `${category}:${period}`
  const list = useRef<HTMLOListElement>(null)
  const alive = useRef(true)
  const focusFrom = useRef<string | null>(null)
  // Every committed selection invalidates its pending reads, including a switch away and back.
  const generation = useRef(0)
  useLayoutEffect(() => {
    generation.current += 1
    focusFrom.current = null
  }, [board])
  const [more, setMore] = useState<(Expansion & { done: boolean }) | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  // A switch drops the expansion, its pending read and its error without remounting the lanes, so FLIP can run.
  const [shownBoard, setShownBoard] = useState(board)
  if (shownBoard !== board) {
    setShownBoard(board)
    setMore(null)
    setLoading(false)
    setFailed(false)
  }
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
    const lane = [...(list.current?.querySelectorAll<HTMLElement>('[data-row]') ?? [])].find(
      (element) => element.dataset.row === id,
    )
    const target = lane?.querySelector<HTMLElement>('a') ?? lane
    if (lane && target === lane) lane.tabIndex = -1
    target?.focus()
  }, [more])

  // Expanded, the list is the live read alone: appending it to the server-rendered head would mix two boards.
  const rows = more ? more.entries : slice.top
  let extras: LeaderboardEntry[] = []
  let showGap = false
  if (!more && slice.total > SHOW_EVERYONE_UP_TO && place?.state === 'ranked') {
    const shown = new Set(slice.top.map((entry) => entry.user_id))
    extras = place.neighbours.filter((entry) => !shown.has(entry.user_id))
    const last = slice.top.at(-1)
    if (extras.length && last) {
      const sharers = slice.top.filter((entry) => entry.rank === last.rank).length
      showGap = extras[0].rank !== last.rank + sharers
    }
  }
  // A pending viewer keeps their last published place, drawn as their own ghost lane at the end.
  const listed = new Set([...rows, ...extras].map((entry) => entry.user_id))
  const ghost =
    place?.state === 'pending' && place.entry && !listed.has(place.entry.user_id)
      ? place.entry
      : null
  const max = Math.max(rows[0]?.value ?? 0, ghost?.value ?? 0)
  const next = place?.state === 'ranked' ? place.next : null
  // The gap sits on the lane to beat; when that lane is outside the list (a tie that spans the neighbourhood), it
  // moves to the viewer's own lane so it is never lost.
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
  useLaneFlip(list, board, [...rows, ...extras].map((entry) => entry.user_id).join(), instant)

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
    const from = generation.current
    setLoading(true)
    setFailed(false)
    try {
      let fetched: Expansion
      if (!more) fetched = await read(0, PAGE)
      else {
        const page = await read(more.entries.length, PAGE)
        fetched =
          page.total === more.total && page.updatedAt === more.updatedAt
            ? { ...page, entries: [...more.entries, ...page.entries] }
            : await read(0, Math.min(more.entries.length + PAGE, MAX_PAGE))
      }
      if (!alive.current || generation.current !== from) return
      const known = new Set(rows.map((entry) => entry.user_id))
      focusFrom.current =
        fetched.entries.find((entry) => !known.has(entry.user_id))?.user_id ?? null
      // A read that brings nothing new ends the expansion, whatever the total says.
      setMore({ ...fetched, done: fetched.entries.length <= (more?.entries.length ?? 0) })
    } catch {
      if (alive.current && generation.current === from) setFailed(true)
    } finally {
      if (alive.current && generation.current === from) setLoading(false)
    }
  }

  const canLoad = !more?.done && (more?.total ?? slice.total) > rows.length
  const freeTarget = guest
    ? { href: '/signin', hint: ru ? 'войти' : 'sign in' }
    : isGroundCategory(category)
      ? {
          href: '/ground-travel/new',
          hint: ru ? 'добавить наземную поездку' : 'add a ground journey',
        }
      : { href: '/add', hint: ru ? 'добавить перелёт' : 'add a flight' }
  const family = isGroundCategory(category) ? 'ground' : 'air'
  const geometry = laneGeometry[family]
  const step = markStep(max)
  return (
    <section
      className="leaderboard-lanes"
      aria-labelledby="leaderboard-lanes-title"
      data-family={family}
      style={
        {
          '--lane-box': geometry.viewBox[2] / geometry.unit,
          '--lane-aspect': geometry.viewBox[3] / geometry.viewBox[2],
          '--lane-nose': geometry.nose,
          '--lane-ground': geometry.ground,
          '--lane-deck': geometry.deck,
          '--lane-skew': `${geometry.skew}deg`,
          '--lane-mark': step ? step / max : 1,
          ...('rail' in geometry && {
            '--lane-rail': geometry.rail.offset,
            '--lane-rail-deck': geometry.rail.deck,
          }),
        } as CSSProperties
      }
    >
      <h2 id="leaderboard-lanes-title" className="sr-only">
        {ru ? 'Участники' : 'Participants'}
      </h2>
      <ol className="lanes" ref={list}>
        {rows.map((entry) => (
          <Lane
            key={entry.user_id}
            entry={entry}
            category={category}
            locale={locale}
            max={max}
            own={entry.user_id === userId}
            gap={gapFor(entry)}
          />
        ))}
        {showGap && (
          <li className="lanes-gap" aria-hidden="true">
            · · ·
          </li>
        )}
        {extras.map((entry, index) => (
          <Lane
            key={entry.user_id}
            entry={entry}
            category={category}
            locale={locale}
            max={max}
            own={entry.user_id === userId}
            leadIn={index === 0 ? leadIn : undefined}
            gap={gapFor(entry)}
          />
        ))}
        {ghost && (
          <Lane
            key={ghost.user_id}
            entry={ghost}
            category={category}
            locale={locale}
            max={max}
            own
            ghost
          />
        )}
        {!rows.length && (
          <li className="lane-free">
            <Link href={freeTarget.href}>
              {ru ? 'Свободно' : 'Free'}
              <span className="sr-only">, {freeTarget.hint}</span>
            </Link>
          </li>
        )}
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
          {more ? (ru ? 'Показать ещё' : 'Show more') : ru ? 'Показать всех' : 'Show all'}
        </Button>
      )}
    </section>
  )
}
