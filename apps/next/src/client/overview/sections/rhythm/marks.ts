import type { Rhythm } from '@kuuki/shared/overview/rhythm'
import { monthName, type Locale } from '../../../../lib/format'
import { flights } from '../rankings/display'

export type Mark = { band: string; print: string; flights: string }

export function monthTotals(data: Rhythm | null): number[] {
  const totals = Array.from({ length: 12 }, () => 0)
  for (const cell of data?.cells ?? []) totals[cell.month - 1] += cell.flights
  return totals
}

const upper = (locale: Locale, text: string) => text.toLocaleUpperCase(locale)

export function monthMarks(totals: readonly number[], locale: Locale): Mark[] {
  return totals.map((count, index) => {
    const short = upper(locale, monthName(locale, index + 1).slice(0, 3))
    return { band: short, print: short, flights: upper(locale, flights(locale, count)) }
  })
}

export function yearMarks(rows: readonly { year: number; flights: number }[], locale: Locale) {
  return rows.map<Mark>((row) => ({
    band: String(row.year),
    print: String(row.year),
    flights: upper(locale, flights(locale, row.flights)),
  }))
}
