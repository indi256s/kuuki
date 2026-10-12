import type { Rhythm } from '@kuuki/shared/overview/rhythm'
import type { Locale } from '../../../../lib/format'
import { monthName } from '../../page/scope-title'
import { flights } from '../rankings/display'

/** What the stamper prints for one position of its band: the band's line, the impression's lettering and its count line. */
export type Mark = { band: string; print: string; flights: string }

/** Flights per calendar month, January first, summed over every year shown. */
export function monthTotals(data: Rhythm | null): number[] {
  const totals = Array.from({ length: 12 }, () => 0)
  for (const cell of data?.cells ?? []) totals[cell.month - 1] += cell.flights
  return totals
}

const upper = (locale: Locale, text: string) => text.toLocaleUpperCase(locale)

/** Twelve marks, January first: "MAR" / «МАР» and "11 FLIGHTS". */
export function monthMarks(totals: readonly number[], locale: Locale): Mark[] {
  return totals.map((count, index) => {
    const short = upper(locale, monthName(locale, index + 1).slice(0, 3))
    return { band: short, print: short, flights: upper(locale, flights(locale, count)) }
  })
}

/** One mark per year, oldest first: the band reads "2019". */
export function yearMarks(rows: readonly { year: number; flights: number }[], locale: Locale) {
  return rows.map<Mark>((row) => ({
    band: String(row.year),
    print: String(row.year),
    flights: upper(locale, flights(locale, row.flights)),
  }))
}
