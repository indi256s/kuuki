import { totals, type Gate } from './figures'
import type { OverviewRow } from './model'

export interface RhythmCell {
  key: string; year: number; month: number; flights: number; distanceKm: number; durationMinutes: number
}
export interface Rhythm { years: number[]; cells: RhythmCell[] }

export function rhythm(rows: OverviewRow[]): Gate<Rhythm> {
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
  return { status: 'ready', value: { years, cells } }
}
