import { makerOf } from '../../../data/src/aircraft-makers'
import { bandOf, haulOf, routeKey } from './filter'
import type { OverviewRow } from './model'
import { calendarDay } from './next'

export interface RankRow {
  key: string
  count: number
}
export interface Leader {
  top: RankRow[]
  total: number
  topShare: number
  top5Share: number
}
export interface BumpRow {
  key: string
  entity: string
  year: number
  rank: number
  count: number
}
export interface VersusRow {
  id: 'makers' | 'haul' | 'daytime'
  left: RankRow
  right: RankRow
  excluded: number
}
type Category = 'airlines' | 'airports' | 'routes'
export interface Rankings {
  airlines: RankRow[]
  airports: RankRow[]
  routes: RankRow[]
  leaders: Record<Category, Leader>
  rankByYear: Record<Category, BumpRow[]>
  versus: VersusRow[]
}

function add(counts: Map<string, number>, key: string, weight: number): void {
  counts.set(key, (counts.get(key) ?? 0) + weight)
}
function ranked(counts: Map<string, number>): RankRow[] {
  return [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

function categoryCounts(rows: OverviewRow[]): Record<Category, Map<string, number>> {
  const airlines = new Map<string, number>(),
    airports = new Map<string, number>(),
    routes = new Map<string, number>()
  for (const row of rows) {
    if (row.airline) add(airlines, row.airline, row.weight)
    add(airports, row.origin, row.weight)
    add(airports, row.destination, row.weight)
    add(routes, routeKey(row.origin, row.destination), row.weight)
  }
  return { airlines, airports, routes }
}

function leader(list: RankRow[]): Leader {
  const top = list.slice(0, 5),
    total = list.reduce((sum, row) => sum + row.count, 0)
  return {
    top,
    total,
    topShare: total ? top[0].count / total : 0,
    top5Share: total ? top.reduce((sum, row) => sum + row.count, 0) / total : 0,
  }
}

export function rankings(rows: OverviewRow[]): Rankings {
  const counts = categoryCounts(rows)
  const airlines = ranked(counts.airlines),
    airports = ranked(counts.airports),
    routes = ranked(counts.routes)
  const dated = rows.filter((row) => calendarDay(row.date) !== null)
  const years = [...new Set(dated.map((row) => Number(row.date.slice(0, 4))))]
    .sort((a, b) => a - b)
    .slice(-6)
  const selected = categoryCounts(
    dated.filter((row) => years.includes(Number(row.date.slice(0, 4)))),
  )
  const yearly = years.map((year) => ({
    year,
    counts: categoryCounts(dated.filter((row) => Number(row.date.slice(0, 4)) === year)),
  }))
  const rankByYear: Rankings['rankByYear'] = { airlines: [], airports: [], routes: [] }
  for (const category of ['airlines', 'airports', 'routes'] as const) {
    const entities = ranked(selected[category])
      .slice(0, 5)
      .map((row) => row.key)
    for (const { year, counts } of yearly) {
      const list = ranked(
        new Map(entities.map((entity) => [entity, counts[category].get(entity) ?? 0])),
      ).filter((row) => row.count > 0)
      let rank = 0
      list.forEach((row, index) => {
        if (index === 0 || row.count !== list[index - 1].count) rank = index + 1
        rankByYear[category].push({
          key: `${row.key}:${year}`,
          entity: row.key,
          year,
          rank,
          count: row.count,
        })
      })
    }
  }
  const versus: VersusRow[] = [
    {
      id: 'makers',
      left: { key: 'airbus', count: 0 },
      right: { key: 'boeing', count: 0 },
      excluded: 0,
    },
    { id: 'haul', left: { key: 'short', count: 0 }, right: { key: 'long', count: 0 }, excluded: 0 },
    {
      id: 'daytime',
      left: { key: 'day', count: 0 },
      right: { key: 'night', count: 0 },
      excluded: 0,
    },
  ]
  for (const row of rows) {
    const km = row.distanceKm === null ? null : row.distanceKm / row.weight
    const minute = row.depMinute
    const keys = [
      makerOf(row.aircraft),
      km !== null && Number.isFinite(km) && km >= 0 && row.weight > 0
        ? haulOf(km) === 'long'
          ? 'long'
          : 'short'
        : null,
      minute !== null && Number.isFinite(minute) && minute >= 0 && minute < 1440
        ? bandOf(minute) === 'night'
          ? 'night'
          : 'day'
        : null,
    ]
    versus.forEach((pair, index) => {
      if (keys[index] === pair.left.key) pair.left.count += row.weight
      else if (keys[index] === pair.right.key) pair.right.count += row.weight
      else pair.excluded += row.weight
    })
  }
  return {
    airlines,
    airports,
    routes,
    leaders: { airlines: leader(airlines), airports: leader(airports), routes: leader(routes) },
    rankByYear,
    versus,
  }
}
