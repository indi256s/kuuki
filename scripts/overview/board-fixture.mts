import { readFileSync, writeFileSync } from 'node:fs'
import { findAirport } from '../../packages/data/src/airport-lookup'
import { familyOf, findAircraft } from '../../packages/data/src/aircraft-lookup'
import { addDays } from '../../packages/shared/src/calendar'
import { greatCircleKm } from '../../packages/shared/src/geo'
import { rowCountries } from '../../packages/shared/src/overview/filter'
import type { OverviewPayload, OverviewRow } from '../../packages/shared/src/overview/model'
import { COUNTRY_REGION } from '../../functions/api/_lib/countryRegions.generated'

type BoardFlight = {
  date: string; from: string; to: string; airline: string; family: string
  distanceKm: number; blockMinutes: number | null; depLocalHour: number | null; fromUtcOffset: number
}
const source = JSON.parse(readFileSync(new URL('../../.scratch/overview-redesign/prototype/charts/flights.json', import.meta.url), 'utf8')) as BoardFlight[]
const generatedAt = '2026-10-07T09:00:00Z'
const types: Record<string, string | null> = {
  '737': 'B738', '777': 'B77W', A330: 'A333', A350: 'A359', A320: 'A320', E190: 'E190', ATR72: 'AT76', unknown: null,
}
const chronological = source.map((flight, index) => ({ flight, index }))
  .sort((a, b) => a.flight.date.localeCompare(b.flight.date) || a.index - b.index)
const estimated = new Set(chronological.filter(({ flight }) => flight.blockMinutes !== null).slice(0, 6).map(({ index }) => index))
const awaiting = new Set(chronological.slice(-3).map(({ index }) => index))
const rows: OverviewRow[] = source.map((flight, index) => ({
  id: index + 1, weight: 1, date: flight.date, state: awaiting.has(index) ? 'awaiting' : 'logged',
  origin: flight.from, destination: flight.to, airline: flight.airline, aircraft: types[flight.family],
  flightNumber: `${flight.airline} ${100 + index}`, depMinute: flight.depLocalHour === null ? null : flight.depLocalHour * 60,
  arrMinute: null, distanceKm: flight.distanceKm, durationMinutes: flight.blockMinutes,
  durationSource: flight.blockMinutes === null ? null : estimated.has(index) ? 'estimate' : 'times', zonesOverflown: null,
  originTz: findAirport(flight.from)?.timezone ?? null, destTz: findAirport(flight.to)?.timezone ?? null,
  departureUtc: flight.depLocalHour === null ? null : new Date(Date.parse(`${flight.date}T00:00:00Z`) +
    (flight.depLocalHour - flight.fromUtcOffset) * 3_600_000).toISOString(), suppressed: 0,
}))
for (const [origin, destination, days, airline] of [['DXB', 'MLE', 3, 'EK'], ['IST', 'NRT', 40, 'TK']] as const) {
  const a = findAirport(origin)!, b = findAirport(destination)!
  rows.push({ id: rows.length + 1, weight: 1, date: addDays(generatedAt.slice(0, 10), days), state: 'upcoming',
    origin, destination, airline, aircraft: null, flightNumber: `${airline} ${100 + rows.length}`,
    depMinute: null, arrMinute: null, distanceKm: Math.round(greatCircleKm({ lat: a.latitude, lon: a.longitude },
      { lat: b.latitude, lon: b.longitude })), durationMinutes: null, durationSource: null, zonesOverflown: null,
    originTz: a.timezone, destTz: b.timezone, departureUtc: null, suppressed: 0 })
}
const refs: OverviewPayload['refs'] = { airports: {}, aircraft: {}, regions: {} }
for (const code of [...new Set(rows.flatMap(row => [row.origin, row.destination]))].sort()) {
  const airport = findAirport(code)
  refs.airports[code] = { lat: airport?.latitude ?? null, lon: airport?.longitude ?? null,
    country: airport?.countryCode ?? null, city: airport?.city ?? null, name: airport?.name ?? code }
  if (airport) refs.regions[airport.countryCode] = COUNTRY_REGION[airport.countryCode]
}
for (const code of [...new Set(rows.flatMap(row => row.aircraft ? [row.aircraft] : []))].sort()) {
  const aircraft = findAircraft(code)
  if (!aircraft) throw new Error(`Missing board aircraft ${code}`)
  refs.aircraft[code] = { manufacturer: aircraft.manufacturer, type: aircraft.type, family: familyOf(code), name: aircraft.name }
}
const pressed = new Set(rows.filter(row => row.state === 'logged').flatMap(row => rowCountries(row, refs)))
const payload: OverviewPayload = { schemaVersion: 3, etag: 'W/"ov3-board-1-1"', generatedAt, mode: 'flights',
  derivedReady: true, homeOverride: null, passport: { countries: pressed.size,
    regions: new Set([...pressed].map(code => refs.regions[code])).size }, rows, refs }
writeFileSync(new URL('../../packages/shared/src/overview/__fixtures__/board.json', import.meta.url), `${JSON.stringify(payload, null, 2)}\n`)
