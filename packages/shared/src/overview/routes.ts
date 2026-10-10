import type { Gate } from './figures'
import { routeKey } from './filter'
import type { OverviewRow } from './model'
import { dateInstant } from './records'

export interface Routes {
  flights: number
  distinct: number
  repeatShare: number
  profile: 'commuter' | 'explorer' | 'mixed'
  top: { key: string; count: number } | null
  homeShare: number | null
  byYear: { key: string; year: number; flights: number; newRoutes: number }[]
}

export function routes(
  rows: OverviewRow[],
  counted: OverviewRow[],
  homeIata: string | null,
): Gate<Routes> {
  const flights = rows.reduce((sum, row) => sum + row.weight, 0)
  if (flights < 5) return { status: 'below', have: flights, need: 5 }
  const counts = new Map<string, number>()
  let home = 0
  for (const row of rows) {
    const key = routeKey(row.origin, row.destination)
    counts.set(key, (counts.get(key) ?? 0) + row.weight)
    if (homeIata !== null && (row.origin === homeIata || row.destination === homeIata))
      home += row.weight
  }
  let repeated = 0,
    top: Routes['top'] = null
  for (const [key, count] of counts) {
    if (count >= 2) repeated += count
    if (!top || count > top.count || (count === top.count && key < top.key)) top = { key, count }
  }
  const ratio = counts.size / flights
  const dated = counted.filter((row) => dateInstant(row.date) !== null)
  const years = dated.map((row) => Number(row.date.slice(0, 4)))
  const first = years.length ? years.reduce((a, b) => Math.min(a, b)) : 0,
    last = years.length ? years.reduce((a, b) => Math.max(a, b)) : -1
  const byYear: Routes['byYear'] = Array.from({ length: last - first + 1 }, (_, i) => ({
    key: String(first + i).padStart(4, '0'),
    year: first + i,
    flights: 0,
    newRoutes: 0,
  }))
  // A route is new in the year of its first counted flight (date, then id), if that flight is in scope.
  const inScope = new Set(rows)
  const firstOf = new Map<string, OverviewRow>()
  for (const row of dated) {
    if (inScope.has(row)) byYear[Number(row.date.slice(0, 4)) - first].flights += row.weight
    const key = routeKey(row.origin, row.destination),
      earliest = firstOf.get(key)
    if (
      !earliest ||
      row.date < earliest.date ||
      (row.date === earliest.date && row.id < earliest.id)
    )
      firstOf.set(key, row)
  }
  for (const row of firstOf.values())
    if (inScope.has(row)) byYear[Number(row.date.slice(0, 4)) - first].newRoutes++
  return {
    status: 'ready',
    value: {
      flights,
      distinct: counts.size,
      repeatShare: repeated / flights,
      profile: ratio >= 0.8 ? 'explorer' : ratio <= 0.5 ? 'commuter' : 'mixed',
      top: top && top.count >= 2 ? top : null,
      homeShare: homeIata === null ? null : home / flights,
      byYear,
    },
  }
}
