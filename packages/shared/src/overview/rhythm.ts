import { totals, type Gate } from './figures'
import { calendarDay } from './next'
import type { OverviewPayload, OverviewRow } from './model'

export interface RhythmCell {
  key: string; year: number; month: number; flights: number; distanceKm: number; durationMinutes: number
}
export interface Rhythm {
  years: number[]; cells: RhythmCell[]
  busiestMonthOfYear: { month: number; flights: number } | null
  longestGap: { months: number; from: string; to: string } | null
  odometer: Array<{ key: string; date: string; km: number; flightId: number | null }>
  max: { flights: number; distanceKm: number; durationMinutes: number }
}

export function rhythm(rows: OverviewRow[], mode: OverviewPayload['mode'] = 'flights'): Gate<Rhythm> {
  const months = new Map<string, OverviewRow[]>()
  for (const row of rows) {
    const key = row.date.slice(0, 7)
    if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(key)) continue
    const group = months.get(key) ?? []
    group.push(row)
    months.set(key, group)
  }
  if (months.size < 2) return { status: 'below', have: months.size, need: 2 }
  const flightYears = [...months.keys()].map(month => Number(month.slice(0, 4)))
  const newest = Math.max(...flightYears), oldest = Math.min(...flightYears)
  const years = Array.from({ length: newest - oldest + 1 }, (_, i) => newest - i)
  const cells = years.flatMap(year => Array.from({ length: 12 }, (_, i) => {
    const month = i + 1, key = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
    return { key, year, month, ...totals(months.get(key) ?? []) }
  }))
  const max = { flights: 0, distanceKm: 0, durationMinutes: 0 }
  const byMonth = Array<number>(12).fill(0)
  for (const cell of cells) {
    byMonth[cell.month - 1] += cell.flights
    max.flights = Math.max(max.flights, cell.flights)
    max.distanceKm = Math.max(max.distanceKm, cell.distanceKm)
    max.durationMinutes = Math.max(max.durationMinutes, cell.durationMinutes)
  }
  let busiestMonthOfYear: Rhythm['busiestMonthOfYear'] = null
  for (const [index, flights] of byMonth.entries()) if (flights > (busiestMonthOfYear?.flights ?? 0)) {
    busiestMonthOfYear = { month: index + 1, flights }
  }
  const occupied = cells.filter(cell => cell.flights > 0).map(cell => cell.year * 12 + cell.month - 1).sort((a, b) => a - b)
  const monthLabel = (month: number) => `${String(Math.floor(month / 12)).padStart(4, '0')}-${String(month % 12 + 1).padStart(2, '0')}`
  let longestGap: Rhythm['longestGap'] = null
  for (let i = 1; i < occupied.length; i++) {
    const length = occupied[i] - occupied[i - 1] - 1
    if (length > (longestGap?.months ?? 0)) longestGap = {
      months: length, from: monthLabel(occupied[i - 1] + 1), to: monthLabel(occupied[i] - 1),
    }
  }
  // Legacy cells accept month prefixes; odometer evidence requires real calendar dates.
  const dated = rows.filter(row => calendarDay(row.date) !== null)
  const odometer: Rhythm['odometer'] = []
  let km = 0
  if (mode === 'aggregate') {
    const datedMonths = new Map<string, OverviewRow[]>()
    for (const row of dated) {
      const month = row.date.slice(0, 7), members = datedMonths.get(month) ?? []
      members.push(row)
      datedMonths.set(month, members)
    }
    for (const [date, members] of [...datedMonths].sort(([a], [b]) => a.localeCompare(b))) {
      km += totals(members).distanceKm
      odometer.push({ key: `aggregate:${date}`, date, km, flightId: null })
    }
  } else {
    for (const row of dated.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)) {
      km += totals([row]).distanceKm
      odometer.push({ key: `flights:${row.id}`, date: row.date, km, flightId: row.id })
    }
  }
  return { status: 'ready', value: { years, cells, busiestMonthOfYear, longestGap, odometer, max } }
}
