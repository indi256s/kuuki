import { matches } from './filter'
import { totals } from './figures'
import type { OverviewFilter, OverviewPayload, OverviewRow } from './model'
import { dayToEpoch } from './range'

export function overviewSeries(payload: OverviewPayload, filter: OverviewFilter) {
  const dailyAvailable = payload.mode === 'flights' || payload.aggregateResolution === 'day'
  const rows = payload.rows.filter(row => row.state !== 'upcoming' && dayToEpoch(row.date) !== null && matches(row, filter, payload.refs))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
  const months = new Map<string, OverviewRow[]>()
  const days = new Map<string, number>()
  for (const row of rows) {
    const month = row.date.slice(0, 7), members = months.get(month) ?? []
    members.push(row)
    months.set(month, members)
    if (dailyAvailable && row.state === 'logged') days.set(row.date, (days.get(row.date) ?? 0) + row.weight)
  }
  const monthly: Array<{ date: string; flights: number; km: number }> = []
  const occupied = [...months.keys()].sort()
  if (occupied.length) {
    const index = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5)) - 1
    for (let value = index(occupied[0]); value <= index(occupied.at(-1)!); value++) {
      const date = `${String(Math.floor(value / 12)).padStart(4, '0')}-${String(value % 12 + 1).padStart(2, '0')}`
      const sum = totals(months.get(date) ?? [])
      monthly.push({ date, flights: sum.flights, km: sum.distanceKm })
    }
  }
  const cumulative: Array<{ key: string; date: string; flights: number; km: number; flightId: number | null }> = []
  let flights = 0, km = 0
  // Legacy month summaries cannot locate their weighted members on individual days.
  if (dailyAvailable) {
    const byDay = new Map<string, OverviewRow[]>()
    for (const row of rows) {
      const members = byDay.get(row.date) ?? []
      members.push(row)
      byDay.set(row.date, members)
    }
    const groups = payload.mode === 'flights' ? rows.map(row => [row]) : [...byDay.values()]
    for (const members of groups) {
      const sum = totals(members), row = members[0]
      flights += sum.flights; km += sum.distanceKm
      cumulative.push({ key: payload.mode === 'flights' ? `flight:${row.id}` : `day:${row.date}`, date: row.date, flights, km,
        flightId: payload.mode === 'flights' ? row.id : null })
    }
  }
  return { dailyAvailable, daily: [...days].map(([date, count]) => ({ date, count })), cumulative, monthly }
}
