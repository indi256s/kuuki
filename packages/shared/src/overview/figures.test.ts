import { expect, it } from 'vitest'
import { computeOverview } from './compute'
import type { OverviewPayload, OverviewRow } from './model'

const row = (extra: Partial<OverviewRow> = {}): OverviewRow => ({
  id: 1, weight: 1, date: '2025-01-01', state: 'logged', origin: 'TBS', destination: 'IST',
  airline: 'TK', aircraft: 'A320', flightNumber: '381', depMinute: 600, arrMinute: null, distanceKm: 1000,
  durationMinutes: 120, durationSource: 'times', zonesOverflown: 2,
  originTz: 'Asia/Tbilisi', destTz: 'Europe/Istanbul', departureUtc: null, suppressed: 0, ...extra,
})
const payload = (rows: OverviewRow[], extra: Partial<OverviewPayload> = {}): OverviewPayload => ({
  schemaVersion: 3, etag: 'W/"ov3-fixture-1-1"', generatedAt: '2026-01-01T00:00:00Z', mode: 'flights',
  derivedReady: true, passport: { countries: 5, regions: 3 }, homeOverride: null, rows,
  refs: {
    airports: {
      TBS: { lat: 41, lon: 45, country: 'GE', city: 'Tbilisi', name: 'TBS' },
      IST: { lat: 41, lon: 29, country: 'TR', city: 'Istanbul', name: 'IST' },
      JFK: { lat: 41, lon: -74, country: 'US', city: 'New York', name: 'JFK' },
    },
    aircraft: { A320: { manufacturer: 'Airbus', type: 'narrowbody', family: 'A320', name: 'A320' } },
    regions: { GE: 'asia', TR: 'asia', US: 'americas' },
  }, ...extra,
})

it('upcoming never counts and awaiting is reported separately', () => {
  const result = computeOverview(payload([
    row(), row({ id: 2, state: 'awaiting' }), row({ id: 3, state: 'upcoming', weight: 99 }),
  ]), {})
  expect(result.figures).toMatchObject({ flights: 2, awaiting: 1, distanceKm: 2000, durationMinutes: 240 })
  expect(result.coverage.total).toBe(2)
  expect(computeOverview(payload([row({ state: 'upcoming' })], { passport: { countries: 0, regions: 0 } }), {}).figures)
    .toMatchObject({ flights: 0, awaiting: 0, distanceKm: 0, durationMinutes: 0 })
})

it('estimates make totals approximate but are not precise coverage', () => {
  const result = computeOverview(payload([row(), row({ id: 2, durationMinutes: 180, durationSource: 'estimate' })]), {})
  expect(result.figures.durationMinutes).toBe(300)
  expect(result.figures.durationApproximate).toBe(true)
  expect(result.coverage.preciseDuration).toBe(1)
  expect(computeOverview(payload([row({ durationSource: 'schedule' })]), {}).figures.durationApproximate).toBe(false)
})

it('passport count only when unfiltered; filtered evidence includes only unsuppressed endpoints', () => {
  const data = payload([row({ suppressed: 2 })])
  expect(computeOverview(data, {}).figures).toMatchObject({ countries: { value: 5, source: 'passport' }, regions: 3 })
  expect(computeOverview(data, { airlines: ['TK'] }).figures)
    .toMatchObject({ countries: { value: 1, source: 'by_air' }, regions: 1 })
  expect(computeOverview(data, { countries: ['TR'] }).figures)
    .toMatchObject({ flights: 0, countries: { value: 0, source: 'by_air' }, regions: 0 })
})

it('deltas are previous-period values with the same facets', () => {
  const data = payload([
    row(), row({ id: 2, state: 'awaiting' }),
    row({ id: 3, date: '2024-01-01', distanceKm: 800, durationMinutes: 90 }),
    row({ id: 4, date: '2024-02-01', airline: 'A9', distanceKm: 2000, durationMinutes: 240 }),
  ])
  expect(computeOverview(data, { period: { years: [2025] }, airlines: ['TK'] }).figures.deltas)
    .toEqual({ flights: 1, distanceKm: 800, durationMinutes: 90 })
  expect(computeOverview(data, {}).figures.deltas).toBeNull()
  expect(computeOverview(data, { period: { years: [2019, 2025] } }).figures.deltas).toBeNull()
})

it('month-range deltas use an equally long preceding range', () => {
  const data = payload([
    row({ date: '2025-11-01' }), row({ id: 2, date: '2026-02-01' }),
    row({ id: 3, date: '2025-07-31', distanceKm: 700, durationMinutes: 70 }),
    row({ id: 4, date: '2025-10-01', distanceKm: 800, durationMinutes: 80 }),
    row({ id: 5, date: '2025-06-30' }),
  ])
  expect(computeOverview(data, { period: { from: '2025-11', to: '2026-02' } }).figures.deltas)
    .toEqual({ flights: 2, distanceKm: 1500, durationMinutes: 150 })
})

function expectFinite(value: unknown): void {
  if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true)
  else if (value && typeof value === 'object') Object.values(value).forEach(expectFinite)
}

it('empty scope is finite', () => {
  const empty = computeOverview(payload([row({ suppressed: 2 })]), { countries: ['TR'] })
  expect(empty.figures).toMatchObject({ flights: 0, distanceKm: 0, durationMinutes: 0,
    countries: { value: 0, source: 'by_air' }, regions: 0 })
  expect(empty.coverage).toEqual({ total: 0, typed: 0, withDepartureTime: 0, withBothTz: 0, preciseDuration: 0 })
  expect(empty.records).toEqual({ status: 'below', have: 0, need: 5 })
  expect(empty.crossings).toEqual({ status: 'below', have: 0, need: 3 })
  expect(empty.fleet).toEqual({ status: 'below', have: 0, need: 5 })
  expect(empty.clock).toEqual({ status: 'below', have: 0, need: 10 })
  expect(empty.rhythm).toEqual({ status: 'below', have: 0, need: 2 })
  expect(empty.rankings).toEqual({ airlines: [], airports: [], routes: [] })
  expect(empty.globe.centroid).toBeNull()
  expectFinite(empty)
  expectFinite(computeOverview(payload([]), {}))
})

it('home override and fallback use all counted rows with alphabetical ties', () => {
  const data = payload([row(), row({ id: 2 }), row({ id: 3, origin: 'IST', airline: 'BA' }),
    row({ id: 4, origin: 'JFK', state: 'upcoming', weight: 99 })])
  expect(computeOverview(data, { airlines: ['BA'] }).home).toEqual({ iata: 'TBS', source: 'most_departed' })
  expect(computeOverview({ ...data, homeOverride: 'JFK' }, {}).home).toEqual({ iata: 'JFK', source: 'override' })
  expect(computeOverview({ ...data, homeOverride: 'ZZZ' }, {}).home).toEqual({ iata: 'TBS', source: 'most_departed' })
  expect(computeOverview(payload([row(), row({ id: 2, origin: 'IST' })]), {}).home)
    .toEqual({ iata: 'IST', source: 'most_departed' })
  expect(computeOverview(payload([], { homeOverride: 'JFK' }), {}).home).toBeNull()
})

it('weights count as flights while aggregate metrics are already sums', () => {
  const result = computeOverview(payload([row({ weight: 7, distanceKm: 7000, durationMinutes: 840 })], { mode: 'aggregate' }), {})
  expect(result.figures).toMatchObject({ flights: 7, distanceKm: 7000, durationMinutes: 840 })
  expect(result.coverage).toEqual({ total: 7, typed: 7, withDepartureTime: 7, withBothTz: 7, preciseDuration: 7 })
})

it('missing metrics remain finite and do not imply precise durations', () => {
  const result = computeOverview(payload([row({ aircraft: null, depMinute: null, originTz: null,
    distanceKm: null, durationMinutes: null, durationSource: null })]), {})
  expect(result.coverage).toEqual({ total: 1, typed: 0, withDepartureTime: 0, withBothTz: 0, preciseDuration: 0 })
  expect(result.figures).toMatchObject({ distanceKm: 0, durationMinutes: 0, durationApproximate: false })
  expectFinite(result)
})

it('upcoming stays visible only as globe ghosts', () => {
  const result = computeOverview(payload([row({ state: 'upcoming' })], { passport: { countries: 0, regions: 0 } }), {})
  expect(result.figures.flights).toBe(0)
  expect(result.globe.routes).toEqual([])
  expect(result.globe.centroid).toBeNull()
  expect(result.globe.ghosts).toEqual([{ id: 1, origin: 'TBS', destination: 'IST', date: '2025-01-01' }])
})
