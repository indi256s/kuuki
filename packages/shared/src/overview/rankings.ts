import { routeKey } from './filter'
import type { OverviewRow } from './model'

export interface RankRow { key: string; count: number }
export interface Rankings { airlines: RankRow[]; airports: RankRow[]; routes: RankRow[] }

function add(counts: Map<string, number>, key: string, weight: number): void {
  counts.set(key, (counts.get(key) ?? 0) + weight)
}
function ranked(counts: Map<string, number>): RankRow[] {
  return [...counts].map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

export function rankings(rows: OverviewRow[]): Rankings {
  const airlines = new Map<string, number>(), airports = new Map<string, number>(), routes = new Map<string, number>()
  for (const row of rows) {
    if (row.airline) add(airlines, row.airline, row.weight)
    add(airports, row.origin, row.weight)
    add(airports, row.destination, row.weight)
    add(routes, routeKey(row.origin, row.destination), row.weight)
  }
  return { airlines: ranked(airlines), airports: ranked(airports), routes: ranked(routes) }
}
