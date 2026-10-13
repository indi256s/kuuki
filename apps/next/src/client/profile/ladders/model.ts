// Achievement ladders: which badge rows belong to which ladder, one tile per ladder, and what is next.
// Pure and client-safe. Legacy rows 1–18, `cities-*` and unknown codes are hidden here, not deleted in D1.
import type { toUserStats } from '../../../../../../functions/api/_lib/stats'
import type { EarnedBadge } from '../achievements'
import type { LadderId } from './figures/types'

export type LadderStats = Pick<
  ReturnType<typeof toUserStats>,
  | 'total_flights'
  | 'total_distance_km'
  | 'total_duration_minutes'
  | 'countries_count'
  | 'airports_count'
  | 'continents_count'
  | 'airlines_count'
  | 'aircraft_count'
>

export type Ladder = {
  id: LadderId
  /** Badge code prefix including the dash; the rung digit follows. */
  codePrefix: string
  /** Seed thresholds in the metric's own unit (time aloft: minutes). */
  thresholds: readonly number[]
  metric: (stats: LadderStats) => number
  /** Display unit: time aloft shows hours although its metric is minutes. */
  unit: 'count' | 'km' | 'hours'
}

export type LadderTile =
  | { kind: 'ladder'; ladder: LadderId; rung: number; rungs: number; item: EarnedBadge }
  | { kind: 'founding'; item: EarnedBadge }

export const FOUNDING_CODE = 'founding-user'

export const LADDERS: readonly Ladder[] = [
  {
    id: 'flights',
    codePrefix: 'flights-',
    thresholds: [1, 25, 50, 100, 500],
    metric: (s) => s.total_flights,
    unit: 'count',
  },
  {
    id: 'distance',
    codePrefix: 'distance-',
    thresholds: [10_000, 50_000, 100_000, 500_000, 1_000_000],
    metric: (s) => s.total_distance_km,
    unit: 'km',
  },
  {
    id: 'time-aloft',
    codePrefix: 'airtime-',
    thresholds: [1440, 7200, 21_600, 43_200, 129_600],
    metric: (s) => s.total_duration_minutes,
    unit: 'hours',
  },
  {
    id: 'countries',
    codePrefix: 'countries-',
    thresholds: [5, 15, 30, 50, 100],
    metric: (s) => s.countries_count,
    unit: 'count',
  },
  {
    id: 'airports',
    codePrefix: 'airports-',
    thresholds: [5, 20, 50, 100, 200],
    metric: (s) => s.airports_count,
    unit: 'count',
  },
  {
    id: 'continents',
    codePrefix: 'continents-',
    thresholds: [2, 3, 4, 5, 6],
    metric: (s) => s.continents_count,
    unit: 'count',
  },
  {
    id: 'airlines',
    codePrefix: 'airlines-',
    thresholds: [5, 15, 30],
    metric: (s) => s.airlines_count,
    unit: 'count',
  },
  {
    id: 'aircraft-types',
    codePrefix: 'aircraft-',
    thresholds: [5, 20, 50],
    metric: (s) => s.aircraft_count,
    unit: 'count',
  },
]

const byId = (id: LadderId) => LADDERS.find((ladder) => ladder.id === id) as Ladder

/** The ladder and 1-based rung a badge code belongs to, or null for anything the cabinet hides. */
export function ladderOf(code: string): { ladder: LadderId; rung: number } | null {
  for (const ladder of LADDERS) {
    if (!code.startsWith(ladder.codePrefix)) continue
    const rest = code.slice(ladder.codePrefix.length)
    if (!/^\d$/.test(rest)) continue
    const rung = Number(rest)
    if (rung >= 1 && rung <= ladder.thresholds.length) return { ladder: ladder.id, rung }
  }
  return null
}

/** One tile per ladder at its highest earned rung, founding first. */
export function toTiles(badges: readonly EarnedBadge[]): LadderTile[] {
  const top = new Map<LadderId, { rung: number; item: EarnedBadge }>()
  let founding: EarnedBadge | null = null
  for (const item of badges) {
    if (item.badge.code === FOUNDING_CODE) {
      founding ??= item
      continue
    }
    const found = ladderOf(item.badge.code)
    if (!found) continue
    const current = top.get(found.ladder)
    if (!current || found.rung > current.rung) top.set(found.ladder, { rung: found.rung, item })
  }
  const tiles: LadderTile[] = founding ? [{ kind: 'founding', item: founding }] : []
  for (const ladder of LADDERS) {
    const entry = top.get(ladder.id)
    if (entry)
      tiles.push({
        kind: 'ladder',
        ladder: ladder.id,
        rung: entry.rung,
        rungs: ladder.thresholds.length,
        item: entry.item,
      })
  }
  return tiles
}

/** The current value in display units: hours for time aloft (fractional), kilometres, counts. */
export function ladderValue(ladderId: LadderId, stats: LadderStats): number {
  const ladder = byId(ladderId)
  const value = ladder.metric(stats)
  return ladder.unit === 'hours' ? value / 60 : value
}

/** A rung's threshold in display units: the fallback value when stats are missing. */
export function rungValue(ladderId: LadderId, rung: number): number {
  const ladder = byId(ladderId)
  const threshold = ladder.thresholds[rung - 1] ?? 0
  return ladder.unit === 'hours' ? threshold / 60 : threshold
}

/** What is left to the next rung, in display units; null at the top rung, without stats, or when the stat is already past it. */
export function nextStep(
  ladderId: LadderId,
  rung: number,
  stats: LadderStats | null,
): { rung: number; remaining: number } | null {
  const ladder = byId(ladderId)
  const threshold = ladder.thresholds[rung]
  if (threshold === undefined || !stats) return null
  const gap = threshold - ladder.metric(stats)
  if (!(gap > 0)) return null
  const remaining = Math.ceil(ladder.unit === 'hours' ? gap / 60 : gap)
  return { rung: rung + 1, remaining }
}

/** Ladder rows and the founding badge; everything else never toasts or unboxes. */
export function visibleBadges(badges: readonly EarnedBadge[]): EarnedBadge[] {
  return badges.filter((item) => item.badge.code === FOUNDING_CODE || ladderOf(item.badge.code))
}

/** Up to two upper-case initials from the holder's name (Flights top rung paints them on the tail). */
export function holderInitials(name: string): string {
  return name
    .split(/[\s._-]+/)
    .map((word) => [...word].find((ch) => /\p{L}/u.test(ch)) ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase()
}
