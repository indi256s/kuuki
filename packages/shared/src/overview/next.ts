import { rowCountries } from './filter'
import type { OverviewPayload, OverviewRow } from './model'

export interface NextFlight {
  flightId: number; date: string; origin: string; destination: string
  airline: string | null; flightNumber: string | null; daysAway: number; newCountry: boolean
}
export interface ReplayItem {
  key: string; flightId: number | null; origin: string; destination: string; date: string; weight: number
}

// ISO round-trip rejects normalized invalid dates and preserves years 0000–0099.
export function calendarDay(label: string): number | null {
  const time = Date.parse(`${label}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === label ? time : null
}

const chronological = (a: OverviewRow, b: OverviewRow) => a.date.localeCompare(b.date) || a.id - b.id

export function nextFlights(payload: OverviewPayload, counted: OverviewRow[]): NextFlight[] {
  const visited = new Set([...payload.passport.countryCodes, ...counted.flatMap(row => rowCountries(row, payload.refs))])
  const generated = new Date(payload.generatedAt)
  const today = Number.isFinite(generated.getTime()) ? calendarDay(generated.toISOString().slice(0, 10)) : null
  return payload.rows.filter(row => row.state === 'upcoming').sort(chronological).map(row => {
    const day = calendarDay(row.date)
    const country = payload.refs.airports[row.destination]?.country
    return { flightId: row.id, date: row.date, origin: row.origin, destination: row.destination,
      airline: row.airline, flightNumber: row.flightNumber,
      daysAway: day !== null && today !== null ? (day - today) / 86_400_000 : 0,
      newCountry: !!country && !visited.has(country) }
  })
}

export function replayItems(rows: OverviewRow[], mode: OverviewPayload['mode']): ReplayItem[] {
  return [...rows].sort(chronological).map(row => ({
    // Aggregate groups retain distinct minimum source IDs, including groups on the same monthly route.
    key: `${mode}:${row.id}`, flightId: mode === 'aggregate' ? null : row.id,
    origin: row.origin, destination: row.destination, date: mode === 'aggregate' ? row.date.slice(0, 7) : row.date,
    weight: row.weight,
  }))
}
