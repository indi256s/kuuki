import { expect, it } from 'vitest'
import { bandOf, haulOf, isEmptyFilter, matches, previousPeriod, routeKey, rowCountries } from './filter'
import type { OverviewFilter, OverviewPayload, OverviewRow } from './model'

const refs: OverviewPayload['refs'] = {
  airports: {
    TBS: { lat: 41, lon: 45, country: 'GE', city: 'Tbilisi', name: 'TBS' },
    KUT: { lat: 42, lon: 42, country: 'GE', city: 'Kutaisi', name: 'KUT' },
    IST: { lat: 41, lon: 29, country: 'TR', city: 'Istanbul', name: 'IST' },
    NRT: { lat: 36, lon: 140, country: 'JP', city: 'Tokyo', name: 'NRT' },
  },
  aircraft: { A320: { manufacturer: 'Airbus', type: 'narrowbody', family: 'A320', name: 'A320' } },
  regions: { GE: 'asia', TR: 'asia', JP: 'asia' },
}
const row = (extra: Partial<OverviewRow> = {}): OverviewRow => ({
  id: 1, weight: 1, date: '2025-01-01', state: 'logged', origin: 'TBS', destination: 'IST',
  airline: 'TK', aircraft: 'A320', flightNumber: '381', depMinute: 600, arrMinute: null, distanceKm: 1400,
  durationMinutes: 120, durationSource: 'times', zonesOverflown: 2,
  originTz: 'Asia/Tbilisi', destTz: 'Europe/Istanbul', departureUtc: null, suppressed: 0, ...extra,
})

it('OR within, AND across every facet', () => {
  const rows = [row(), row({ id: 2, airline: 'A9', destination: 'NRT' }), row({ id: 3, airline: 'BA' })]
  expect(rows.filter(r => matches(r, { airlines: ['TK', 'A9'] }, refs)).map(r => r.id)).toEqual([1, 2])
  expect(rows.filter(r => matches(r, { airlines: ['TK', 'A9'], countries: ['JP'] }, refs)).map(r => r.id)).toEqual([2])
  expect(matches(row(), { regions: ['europe', 'asia'], makers: ['airbus'], bodies: ['narrow'],
    aircraft: ['A320'], haul: ['short'], domestic: ['international'], departureBands: ['morning'] }, refs)).toBe(true)
  expect(matches(row(), { regions: ['europe'] }, refs)).toBe(false)
})

it('transit country does not match but raw countries still decide domestic', () => {
  const suppressed = row({ suppressed: 2 })
  expect(rowCountries(suppressed, refs)).toEqual(['GE'])
  expect(matches(suppressed, { countries: ['TR'] }, refs)).toBe(false)
  expect(matches(suppressed, { countries: ['GE'] }, refs)).toBe(true)
  expect(rowCountries(row({ suppressed: 3 }), refs)).toEqual([])
  expect(matches(row({ destination: 'KUT', suppressed: 3 }), { domestic: ['domestic'] }, refs)).toBe(true)
})

it('route is undirected', () => {
  expect(routeKey('TBS', 'IST')).toBe('IST-TBS')
  expect(matches(row(), { routes: ['IST-TBS'] }, refs)).toBe(true)
  expect(matches(row({ origin: 'IST', destination: 'TBS' }), { routes: ['IST-TBS'] }, refs)).toBe(true)
})

it('haul and band edges', () => {
  expect([1499, 1500, 3999, 4000].map(haulOf)).toEqual(['short', 'medium', 'medium', 'long'])
  expect([0, 359, 360, 719, 720, 1079, 1080, 1319, 1320, 1439].map(bandOf)).toEqual([
    'night', 'night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night',
  ])
  expect(matches(row({ weight: 4, distanceKm: 6000 }), { haul: ['medium'] }, refs)).toBe(true)
  expect(matches(row({ weight: 4, distanceKm: 6000 }), { haul: ['long'] }, refs)).toBe(false)
})

it.each<OverviewFilter>([
  { aircraft: ['A320'] }, { bodies: ['narrow'] }, { makers: ['airbus'] },
  { departureBands: ['night'] }, { airlines: ['TK'] }, { haul: ['short'] }, { domestic: ['domestic'] },
])('missing attribute never matches: %j', filter => {
  expect(matches(row({ aircraft: null, airline: null, depMinute: null, distanceKm: null, destination: 'ZZZ' }), filter, refs)).toBe(false)
})

it('period boundaries are inclusive and stale facet values match nothing', () => {
  const filter: OverviewFilter = { period: { from: '2025-11', to: '2026-02' } }
  expect(['2025-10-31', '2025-11-01', '2026-02-28', '2026-03-01'].map(date => matches(row({ date }), filter, refs)))
    .toEqual([false, true, true, false])
  expect(matches(row({ date: '2024-12-31' }), { period: { years: [2023, 2024] } }, refs)).toBe(true)
  expect(['2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02'].map(date => matches(row({ date }), { period: { from: '2024-02-29', to: '2024-03-01' } }, refs))).toEqual([false, true, true, false])
  expect(matches(row(), { airlines: ['obsolete'] }, refs)).toBe(false)
  expect(matches(row(), { countries: ['XX'] }, refs)).toBe(false)
})

it('previous period preserves facets and compares equal calendar spans', () => {
  expect(previousPeriod({ period: { years: [2024] } })).toEqual({ period: { years: [2023] } })
  expect(previousPeriod({ period: { from: '2025-11', to: '2026-02' }, airlines: ['TK'] }))
    .toEqual({ period: { from: '2025-07', to: '2025-10' }, airlines: ['TK'] })
  expect(previousPeriod({ period: { years: [2023, 2024] } })).toEqual({ period: { years: [2021, 2022] } })
  expect(previousPeriod({ period: { years: [2019, 2024] } })).toBeNull()
  expect(previousPeriod({ period: { from: '2024-03-01', to: '2024-03-02' }, countries: ['JP'] })).toEqual({ period: { from: '2024-02-28', to: '2024-02-29' }, countries: ['JP'] })
  expect(previousPeriod({ period: { from: '0099-01-01', to: '0099-01-01' } })).toEqual({ period: { from: '0098-12-31', to: '0098-12-31' } })
  expect(previousPeriod({ period: { from: '0000-01-01', to: '0000-01-01' } })).toBeNull()
  expect(previousPeriod({})).toBeNull()
  const filter: OverviewFilter = { period: { years: [2024, 2023, 2024] }, countries: ['JP'] }
  expect(previousPeriod(filter)).toEqual({ period: { years: [2021, 2022] }, countries: ['JP'] })
  expect(filter.period).toEqual({ years: [2024, 2023, 2024] })
})

it('invalid periods fail closed without throwing', () => {
  for (const period of [{ from: 'bad', to: '2025-02' }, { from: '2025-12', to: '2025-01' },
    { from: '2025-13', to: '2025-14' }]) {
    expect(previousPeriod({ period })).toBeNull()
    expect(matches(row(), { period }, refs)).toBe(false)
  }
  expect(previousPeriod({ period: { years: [] } })).toBeNull()
})

it('empty arrays mean cleared facets', () => {
  expect(isEmptyFilter({})).toBe(true)
  expect(isEmptyFilter({ airlines: [], period: { years: [] } })).toBe(true)
  expect(matches(row(), { airlines: [], period: { years: [] } }, refs)).toBe(true)
  expect(isEmptyFilter({ airlines: ['obsolete'] })).toBe(false)
  expect(isEmptyFilter({ period: { years: [2025] } })).toBe(false)
})

it('new facets match actual metadata, dates and either airport endpoint', () => {
  const data = { ...refs, aircraft: { ...refs.aircraft,
    E190: { manufacturer: 'Embraer', type: 'regional', family: 'E-Jet', name: 'E190' },
    B77W: { manufacturer: 'Boeing', type: 'widebody', family: '777', name: 'B77W' },
  } }
  const check = (extra: Partial<OverviewRow>, filter: OverviewFilter) => matches(row(extra), filter, data)
  expect(check({ origin: 'IST', destination: 'FRA' }, { airports: ['IST'] })).toBe(true)
  expect(check({ origin: 'FRA', destination: 'IST', suppressed: 2 }, { airports: ['IST'] })).toBe(true)
  expect(check({}, { airports: ['FRA'] })).toBe(false)
  expect(check({ airline: 'S7', date: '2019-01-01' }, { alliances: ['oneworld'] })).toBe(true)
  expect(check({ airline: 'S7', date: '2023-01-01' }, { alliances: ['oneworld'] })).toBe(false)
  expect(check({ aircraft: null }, { makers: ['unknown'] })).toBe(true)
  expect(check({ aircraft: 'E190' }, { families: ['E-Jet'] })).toBe(true)
  expect(check({ aircraft: 'E190' }, { families: ['777'] })).toBe(false)
  expect(check({ aircraft: 'E190' }, { bodies: ['narrow'] })).toBe(true)
  expect(check({ aircraft: 'B77W' }, { bodies: ['narrow'] })).toBe(false)
  for (const aircraft of [null, 'UNLISTED']) {
    expect(check({ aircraft }, { bodies: ['narrow', 'wide'] })).toBe(false)
  }
  for (const type of [null, '', 'unlisted']) {
    expect(matches(row(), { bodies: ['narrow'] }, { ...refs,
      aircraft: { A320: { ...refs.aircraft.A320, type } } })).toBe(false)
  }
  expect(check({ aircraft: 'B77W' }, { makers: ['airbus', 'boeing'], bodies: ['wide'] })).toBe(true)
  expect(check({}, { makers: ['airbus', 'boeing'], bodies: ['wide'] })).toBe(false)
  expect(check({ aircraft: 'E190' }, { makers: ['airbus', 'boeing'], bodies: ['narrow'] })).toBe(false)
})

it('local hour facets validate minutes and keep missing time distinct from midnight', () => {
  for (const key of ['depMinute', 'arrMinute'] as const) {
    const facet = key === 'depMinute' ? 'depHours' : 'arrHours'
    expect([419, 420, 479, 480].map(minute => matches(row({ [key]: minute }), { [facet]: [7] }, refs)))
      .toEqual([false, true, true, false])
    expect(matches(row({ [key]: 400 }), { [facet]: [6] }, refs)).toBe(true)
    for (const minute of [null, NaN, Infinity, -1, 1439.5, 1440]) {
      expect(matches(row({ [key]: minute }), { [facet]: [0, 23] }, refs)).toBe(false)
    }
    expect(matches(row({ [key]: 0 }), { [facet]: [0] }, refs)).toBe(true)
    expect(matches(row({ [key]: 1439 }), { [facet]: [23] }, refs)).toBe(true)
  }
})
