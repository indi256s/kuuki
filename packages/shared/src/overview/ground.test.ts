import { describe, expect, it } from 'vitest'
import { computeOverview } from './compute'
import { effectiveScope, groundMatches, hasAviationFacet } from './filter'
import type { OverviewFilter, OverviewGroundJourney, OverviewPayload, OverviewRow } from './model'

const row = (id: number, date: string, origin: string, destination: string, km: number) =>
  ({
    id,
    weight: 1,
    date,
    state: 'logged',
    origin,
    destination,
    airline: 'BA',
    aircraft: null,
    flightNumber: null,
    depMinute: null,
    arrMinute: null,
    distanceKm: km,
    durationMinutes: null,
    zonesOverflown: null,
    durationSource: null,
    originTz: null,
    destTz: null,
    departureUtc: null,
    suppressed: 0,
  }) satisfies OverviewRow

const journey = (
  id: string,
  status: OverviewGroundJourney['status'],
  startDate: string | null,
  countries: string[],
  distanceKm: number | null,
): OverviewGroundJourney => ({
  id,
  mode: 'rail',
  status,
  startDate,
  endDate: null,
  runs: [
    [
      [2.35, 48.85],
      [8.68, 50.11],
    ],
  ],
  countries,
  distanceKm,
})

const place = (country: string) => ({ lat: 0, lon: 0, country, city: null, name: country })
const payload: OverviewPayload = {
  schemaVersion: 4,
  etag: 'W/"ov5-ground-1-1"',
  generatedAt: '2026-10-15T00:00:00.000Z',
  mode: 'flights',
  derivedReady: true,
  homeOverride: null,
  passport: { countries: 9, regions: 4, countryCodes: [] },
  rows: [row(1, '2025-03-10', 'LHR', 'JFK', 5500), row(2, '2024-06-01', 'JFK', 'NRT', 10800)],
  ground: [
    journey('g1', 'completed', '2025-06-02', ['FR', 'DE'], 900),
    journey('g2', 'completed', '2024-09-01', ['AT', 'DE'], null),
    journey('g3', 'planned', '2026-11-01', [], 300),
    journey('g4', 'completed', null, ['FR'], 100),
  ],
  refs: {
    airports: { LHR: place('GB'), JFK: place('US'), NRT: place('JP') },
    aircraft: {},
    regions: {
      GB: 'Europe',
      FR: 'Europe',
      DE: 'Europe',
      AT: 'Europe',
      US: 'North America',
      JP: 'Asia',
    },
  },
}

const compute = (filter: OverviewFilter, source = payload) => computeOverview(source, filter)
const globeCodes = (result: ReturnType<typeof compute>) =>
  new Set(result.globe.countries.map((country) => country.code))

describe('ground in the overview geography', () => {
  it('unfiltered all keeps the passport count and totals both kinds of travel', () => {
    const result = compute({})
    expect(result.figures.scope).toBe('all')
    expect(result.figures.countries).toEqual({ value: 9, source: 'passport' })
    expect(result.figures.travelKm).toBe(5500 + 10800 + 900 + 100)
    expect(result.figures.travelKmApproximate).toBe(true)
    expect(result.figures.groundJourneys).toBe(3)
    expect(result.figures.distanceKm).toBe(16300)
    expect(result.globe.ground.map((item) => [item.id, item.planned])).toEqual([
      ['g1', false],
      ['g2', false],
      ['g3', true],
      ['g4', false],
    ])
  })

  it.each([
    ['all', {}, 'passport', 9, 17300],
    ['flights', { scope: 'flights' }, 'by_air', 3, 16300],
    ['ground', { scope: 'ground' }, 'ground', 3, 1000],
  ] as const)('scope %s unfiltered', (_name, filter, source, countries, km) => {
    const result = compute(filter)
    expect(result.figures.countries.source).toBe(source)
    if (source !== 'passport') {
      expect(result.figures.countries.value).toBe(countries)
      expect(globeCodes(result).size).toBe(countries)
    }
    expect(result.figures.travelKm).toBe(km)
  })

  it('the three scopes agree with the globe under a period', () => {
    const period = { period: { years: [2025] } }
    const all = compute(period)
    expect(all.figures.countries).toEqual({ value: 4, source: 'all' })
    expect(globeCodes(all)).toEqual(new Set(['GB', 'US', 'FR', 'DE']))
    expect(all.figures.travelKm).toBe(6400)
    expect(all.figures.travelKmApproximate).toBe(false)
    expect(all.figures.groundJourneys).toBe(1)
    expect(all.figures.regions).toBe(2)

    const flights = compute({ ...period, scope: 'flights' })
    expect(flights.figures.countries).toEqual({ value: 2, source: 'by_air' })
    expect(globeCodes(flights)).toEqual(new Set(['GB', 'US']))
    expect(flights.figures.travelKm).toBe(5500)
    expect(flights.figures.groundJourneys).toBe(0)
    expect(flights.globe.ground).toEqual([])

    const ground = compute({ ...period, scope: 'ground' })
    expect(ground.figures.countries).toEqual({ value: 2, source: 'ground' })
    expect(globeCodes(ground)).toEqual(new Set(['FR', 'DE']))
    expect(ground.figures.travelKm).toBe(900)
    expect(ground.globe.routes).toEqual([])
    expect(ground.globe.airports).toEqual([])
    expect(ground.globe.ghostRoutes).toEqual([])
    expect(ground.globe.ghosts).toEqual([])
    expect(ground.globe.ghostCountries).toEqual(['AT'])
    expect(ground.globe.centroid).not.toBeNull()
  })

  it('a planned journey counts toward nothing but is still drawn', () => {
    for (const scope of [undefined, 'ground'] as const) {
      const result = compute({ period: { years: [2026] }, scope })
      expect(result.figures.countries.value).toBe(0)
      expect(result.figures.travelKm).toBe(0)
      expect(result.figures.groundJourneys).toBe(0)
      expect(result.globe.ground.map((item) => item.id)).toEqual(['g3'])
    }
  })

  it('an aviation facet excludes ground; geography facets keep it', () => {
    expect(hasAviationFacet({ airlines: ['BA'] })).toBe(true)
    expect(hasAviationFacet({ countries: ['DE'], regions: ['Europe'], scope: 'ground' })).toBe(
      false,
    )
    const all = compute({ airlines: ['BA'] })
    expect(all.globe.ground).toEqual([])
    expect(all.figures.countries).toEqual({ value: 3, source: 'all' })
    expect(all.figures.travelKm).toBe(16300)
    const ground = compute({ airlines: ['BA'], scope: 'ground' })
    expect(ground.figures.countries.value).toBe(0)
    expect(ground.figures.travelKm).toBe(0)
    expect(ground.globe.centroid).toBeNull()
    const germany = compute({ countries: ['DE'], scope: 'ground' })
    expect(globeCodes(germany)).toEqual(new Set(['FR', 'DE', 'AT']))
    expect(germany.figures.countries.value).toBe(3)
    expect(compute({ regions: ['Asia'], scope: 'ground' }).globe.ground).toEqual([])
  })

  it('an undated journey matches only without a period', () => {
    const undated = payload.ground[3]
    expect(groundMatches(undated, {}, payload.refs)).toBe(true)
    expect(groundMatches(undated, { period: { years: [] } }, payload.refs)).toBe(true)
    expect(groundMatches(undated, { period: { years: [2025] } }, payload.refs)).toBe(false)
    expect(
      groundMatches(undated, { period: { from: '2025-01-01', to: '2025-12-31' } }, payload.refs),
    ).toBe(false)
    expect(
      groundMatches(
        payload.ground[0],
        { period: { from: '2025-06-01', to: '2025-06-30' } },
        payload.refs,
      ),
    ).toBe(true)
  })

  it('a stored scope without ground data behaves as all', () => {
    const bare = { ...payload, ground: [] }
    expect(effectiveScope(bare, { scope: 'ground' })).toBe('all')
    const result = compute({ scope: 'ground' }, bare)
    expect(result.figures.scope).toBe('all')
    expect(result.figures.countries).toEqual({ value: 9, source: 'passport' })
    const filtered = compute({ scope: 'ground', period: { years: [2025] } }, bare)
    expect(filtered.figures.countries).toEqual({ value: 2, source: 'by_air' })
    expect(filtered.globe.countries.length).toBe(2)
    expect(filtered.figures.travelKm).toBe(5500)
  })
})
