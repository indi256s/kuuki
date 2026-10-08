import { matches, routeKey } from '@kuuki/shared/overview/filter'
import type { OverviewFilter, OverviewPayload, OverviewRow } from '@kuuki/shared/overview/model'
import { calendarDay } from '@kuuki/shared/overview/next'

export type ChapterSummary = {
  flights: number; distanceKm: number; knownDistanceFlights: number; averageDistanceKm: number | null
  firstDate: string | null; lastDate: string | null
}
export type ChapterComparison = {
  routes: { key: string; a: string; b: string; heldCount: number; currentCount: number; status: 'shared' | 'added' | 'absent'
    flightIds: { held: number[]; current: number[] } }[]
  airports: { iata: string; heldCount: number; currentCount: number }[]
  airlines: { code: string; heldCount: number; currentCount: number; heldShare: number; currentShare: number }[]
  held: ChapterSummary
  current: ChapterSummary
}

type Side = {
  summary: ChapterSummary; dates: string[]
  routes: Map<string, { a: string; b: string; count: number; ids: number[] }>
  airports: Map<string, number>; airlines: Map<string, number>
}

function collect(rows: OverviewRow[], payload: OverviewPayload, filter: OverviewFilter): Side {
  const side: Side = {
    summary: { flights: 0, distanceKm: 0, knownDistanceFlights: 0, averageDistanceKm: null, firstDate: null, lastDate: null },
    dates: [], routes: new Map(), airports: new Map(), airlines: new Map(),
  }
  const bump = (map: Map<string, number>, key: string, weight: number) => map.set(key, (map.get(key) ?? 0) + weight)
  for (const row of rows) {
    if (!matches(row, filter, payload.refs)) continue
    const weight = row.weight, summary = side.summary
    summary.flights += weight
    if (row.distanceKm !== null && Number.isFinite(row.distanceKm) && row.distanceKm >= 0) {
      summary.distanceKm += row.distanceKm
      summary.knownDistanceFlights += weight
    }
    if (calendarDay(row.date) !== null) side.dates.push(row.date)
    bump(side.airports, row.origin, weight)
    bump(side.airports, row.destination, weight)
    bump(side.airlines, row.airline || 'unknown', weight)
    const key = routeKey(row.origin, row.destination)
    const route = side.routes.get(key) ?? { a: '', b: '', count: 0, ids: [] }
    ;[route.a, route.b] = [row.origin, row.destination].sort()
    route.count += weight
    // A weighted aggregate row stands for several flights; its id must not leave the owner.
    if (payload.mode === 'flights' && weight === 1 && Number.isSafeInteger(row.id) && row.id > 0) route.ids.push(row.id)
    side.routes.set(key, route)
  }
  const { summary } = side
  summary.averageDistanceKm = summary.knownDistanceFlights > 0 ? summary.distanceKm / summary.knownDistanceFlights : null
  side.dates.sort()
  summary.firstDate = side.dates[0] ?? null
  summary.lastDate = side.dates.at(-1) ?? null
  return side
}

const delta = (item: { heldCount: number; currentCount: number }) => Math.abs(item.currentCount - item.heldCount)
const compare = <T extends { heldCount: number; currentCount: number }>(name: (item: T) => string) => (x: T, y: T) =>
  delta(y) - delta(x) || Math.max(y.heldCount, y.currentCount) - Math.max(x.heldCount, x.currentCount) ||
  (name(x) < name(y) ? -1 : name(x) > name(y) ? 1 : 0)
const keys = (a: Map<string, unknown>, b: Map<string, unknown>) => [...new Set([...a.keys(), ...b.keys()])]

/** Compares two filters over the payload's completed rows without attributing the difference to a cause. */
export function compareChapters(payload: OverviewPayload, heldFilter: OverviewFilter, currentFilter: OverviewFilter): ChapterComparison {
  const completed = payload.rows.filter(row => (row.state === 'logged' || row.state === 'awaiting') &&
    Number.isFinite(row.weight) && row.weight > 0)
  const held = collect(completed, payload, heldFilter), current = collect(completed, payload, currentFilter)
  const routes = keys(held.routes, current.routes).map(key => {
    const h = held.routes.get(key), c = current.routes.get(key), either = (h ?? c)!
    const ids = (side?: { ids: number[] }) => [...new Set(side?.ids ?? [])].sort((x, y) => x - y)
    return { key, a: either.a, b: either.b, heldCount: h?.count ?? 0, currentCount: c?.count ?? 0,
      status: h && c ? 'shared' as const : c ? 'added' as const : 'absent' as const,
      flightIds: { held: ids(h), current: ids(c) } }
  }).sort(compare(route => route.key))
  const airports = keys(held.airports, current.airports)
    .map(iata => ({ iata, heldCount: held.airports.get(iata) ?? 0, currentCount: current.airports.get(iata) ?? 0 }))
    .sort(compare(airport => airport.iata))
  const share = (count: number, total: number) => total > 0 ? count / total : 0
  const airlines = keys(held.airlines, current.airlines).map(code => {
    const heldCount = held.airlines.get(code) ?? 0, currentCount = current.airlines.get(code) ?? 0
    return { code, heldCount, currentCount, heldShare: share(heldCount, held.summary.flights), currentShare: share(currentCount, current.summary.flights) }
  }).sort((a, b) => Math.abs(b.currentShare - b.heldShare) - Math.abs(a.currentShare - a.heldShare) || compare<typeof a>(airline => airline.code)(a, b))
  return { routes, airports, airlines, held: held.summary, current: current.summary }
}
