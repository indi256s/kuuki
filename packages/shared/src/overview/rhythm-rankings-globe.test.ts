import { expect, it } from 'vitest'
import { findAirport } from '../../../data/src/airport-lookup'
import { greatCircleKm } from '../geo'
import { rhythm } from './rhythm'
import { rankings } from './rankings'
import { globe } from './globe'
import type { OverviewPayload, OverviewRow } from './model'

const refs: OverviewPayload['refs'] = { aircraft: {}, regions: { GE: 'asia', JP: 'asia', TR: 'asia', US: 'americas' },
  airports: Object.fromEntries(['TBS', 'NRT', 'IST', 'JFK'].map(code => {
    const airport = findAirport(code)
    if (!airport) throw new Error(`Missing fixture airport ${code}`)
    return [code, { lat: airport.latitude, lon: airport.longitude, country: airport.countryCode,
      city: airport.city, name: airport.name }]
  })) }
const row = (extra: Partial<OverviewRow> = {}): OverviewRow => ({
  id: 1, weight: 1, date: '2025-01-01', state: 'logged', origin: 'TBS', destination: 'NRT',
  airline: 'TK', aircraft: null, flightNumber: null, depMinute: null, arrMinute: null, distanceKm: 1000,
  durationMinutes: 120, durationSource: 'times', zonesOverflown: 2,
  originTz: 'Asia/Tbilisi', destTz: 'Asia/Tokyo', departureUtc: null, suppressed: 0, ...extra,
})

it('rhythm cells are a full grid including gap years and weighted metric sums', () => {
  const result = rhythm([row({ date: '2022-12-01', weight: 2, distanceKm: 2000, durationMinutes: 240 }),
    row({ id: 2, date: '2024-03-01' })])
  if (result.status !== 'ready') throw new Error('Expected ready rhythm')
  expect(result.value.years).toEqual([2024, 2023, 2022])
  expect(result.value.cells).toHaveLength(36)
  expect(new Set(result.value.cells.map(cell => cell.key)).size).toBe(36)
  expect(result.value.cells.find(cell => cell.key === '2022-12'))
    .toEqual({ key: '2022-12', year: 2022, month: 12, flights: 2, distanceKm: 2000, durationMinutes: 240 })
  expect(result.value.cells.filter(cell => cell.year === 2023).every(cell => cell.flights === 0 && cell.distanceKm === 0 && cell.durationMinutes === 0)).toBe(true)
})

it('rhythm gates by distinct valid months rather than weights', () => {
  expect(rhythm([])).toEqual({ status: 'below', have: 0, need: 2 })
  expect(rhythm([row({ weight: 100 }), row({ id: 2, date: '2025-01-31' }), row({ id: 3, date: 'bad-date' })]))
    .toEqual({ status: 'below', have: 1, need: 2 })
})

it('ranking ties are alphabetical, routes undirected, airports count both endpoints', () => {
  const rows = [row({ weight: 2 }), row({ id: 2, origin: 'NRT', destination: 'TBS', airline: 'BA', weight: 2 }),
    row({ id: 3, destination: 'IST', airline: 'A9' })]
  const result = rankings(rows)
  expect(result).toEqual({ airlines: [{ key: 'BA', count: 2 }, { key: 'TK', count: 2 }, { key: 'A9', count: 1 }],
    airports: [{ key: 'TBS', count: 5 }, { key: 'NRT', count: 4 }, { key: 'IST', count: 1 }],
    routes: [{ key: 'NRT-TBS', count: 4 }, { key: 'IST-TBS', count: 1 }] })
  expect(rankings([...rows].reverse())).toEqual(result)
  expect(rankings(Array.from({ length: 7 }, (_, i) => row({ id: i + 1, airline: `A${i}` }))).airlines).toHaveLength(7)
})

it('ghost routes and countries exclude in-scope keys and upcoming stays separate', () => {
  const all = [row(), row({ id: 2, origin: 'NRT', destination: 'TBS', airline: 'BA' }),
    row({ id: 3, destination: 'IST' }), row({ id: 4, origin: 'IST', destination: 'JFK', state: 'upcoming', date: '2027-01-01' })]
  const result = globe(all, [all[0]], refs)
  expect(result.routes).toEqual([{ key: 'NRT-TBS', a: 'NRT', b: 'TBS', count: 1 }])
  expect(result.ghostRoutes).toEqual(['IST-TBS'])
  expect(result.countries).toEqual([{ code: 'GE', visits: 1 }, { code: 'JP', visits: 1 }])
  expect(result.ghostCountries).toEqual(['TR'])
  expect(result.ghosts).toEqual([{ id: 4, origin: 'IST', destination: 'JFK', date: '2027-01-01' }])
})

it('suppression affects country evidence but retains airport visits', () => {
  const rows = [row({ destination: 'IST', suppressed: 2, weight: 3 })]
  const result = globe(rows, rows, refs)
  expect(result.countries).toEqual([{ code: 'GE', visits: 3 }])
  expect(result.airports).toEqual([{ iata: 'IST', count: 3 }, { iata: 'TBS', count: 3 }])
})

it('centroid of TBS×3 and NRT×1 lies on their arc nearer TBS', () => {
  const rows = [row({ origin: 'TBS', destination: 'TBS', weight: 3 }), row({ id: 2, origin: 'NRT', destination: 'NRT' })]
  const centroid = globe(rows, rows, refs).centroid
  if (!centroid) throw new Error('Expected located centroid')
  const tbs = { lat: refs.airports.TBS.lat!, lon: refs.airports.TBS.lon! }
  const nrt = { lat: refs.airports.NRT.lat!, lon: refs.airports.NRT.lon! }
  expect(greatCircleKm(tbs, centroid)).toBeLessThan(greatCircleKm(nrt, centroid))
  expect(greatCircleKm(tbs, centroid) + greatCircleKm(centroid, nrt)).toBeCloseTo(greatCircleKm(tbs, nrt), 6)
})

it('antipodal and missing-coordinate centroids are null', () => {
  const custom: OverviewPayload['refs'] = { ...refs, airports: {
    AAA: { lat: 0, lon: 0, country: null, city: null, name: 'AAA' },
    BBB: { lat: 0, lon: 180, country: null, city: null, name: 'BBB' },
  } }
  const rows = [row({ origin: 'AAA', destination: 'BBB' })]
  expect(globe(rows, rows, custom).centroid).toBeNull()
  const missing = [row({ origin: 'ZZZ', destination: 'XXX' })]
  expect(globe(missing, missing, refs).centroid).toBeNull()
  expect(globe(rows, [], custom).centroid).toBeNull()
})

it('globe output is unchanged by input order and ghosts are chronological', () => {
  const all = [row({ weight: 3 }), row({ id: 2, destination: 'IST' }),
    row({ id: 4, state: 'upcoming', date: '2027-01-01' }), row({ id: 3, state: 'upcoming', date: '2026-12-01' })]
  const result = globe(all, all.slice(0, 2), refs)
  expect(result.ghosts.map(item => item.id)).toEqual([3, 4])
  expect(globe([...all].reverse(), [all[1], all[0]], refs)).toEqual(result)
})
