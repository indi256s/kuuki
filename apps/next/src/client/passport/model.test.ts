import { describe, expect, it } from 'vitest'
import catalog from '@kuuki/data/countries.json'
import { COUNTRY_NEIGHBORS } from '@kuuki/data/country-neighbors'
import { CATALOG_TOTAL, arrivalHref, countryNamer, groupByRegion, headerFigures, passportEntries, removalOutcome, searchCountries, sortEntries, stampCaption, suggestCountries } from './model'
import type { PassportData } from '../../server/passport'

type Row = PassportData['countries'][number]
const row = (code: string, patch: Partial<Row> = {}): Row => ({
  country_code: code, status: 'pressed', logged_visit_count: 0, awaiting_visit_count: 0, claimed: 0, ground_visit_count: 0,
  first_visit: null, last_visit: null, region: null, ...patch,
})
const now = new Date(Date.UTC(2026, 9, 5, 12))
// Fixture mirrors the API: a logged country, a pending (awaiting-only) one, a claim, land and sea visits.
const data = {
  countries: [
    row('JP', { logged_visit_count: 12, first_visit: '2019-04-02', last_visit: '2026-08-01', region: 'asia' }),
    row('PT', { status: 'pending', awaiting_visit_count: 1, first_visit: '2026-10-03', last_visit: '2026-10-03', region: 'europe' }),
    row('IS', { claimed: 1, region: 'europe' }),
    row('CH', { ground_visit_count: 2, region: 'europe' }),
    row('GR', { ground_visit_count: 1, claimed: 1, region: 'europe' }),
    row('US', { logged_visit_count: 3, awaiting_visit_count: 1, first_visit: '2026-02-01', last_visit: '2026-09-28', region: 'americas' }),
  ],
  groundVisits: [
    { country_code: 'CH', visit_year: 2018, entry_method: 'land' },
    { country_code: 'CH', visit_year: 2015, entry_method: null },
    { country_code: 'GR', visit_year: null, entry_method: 'sea' },
  ],
  pressedCountryCount: 5,
  pendingCountryCount: 1,
}
const entries = passportEntries(data)
const by = (code: string) => entries.find(entry => entry.code === code)!
const name = countryNamer('en')

describe('passportEntries', () => {
  it('maps API states to stamp kinds: air by flights, land/sea by ground visits, claim otherwise; pending stays pending', () => {
    expect(entries.map(entry => [entry.code, entry.status, entry.kind])).toEqual([
      ['JP', 'pressed', 'air'], ['PT', 'pending', 'air'], ['IS', 'pressed', 'claim'],
      ['CH', 'pressed', 'land'], ['GR', 'pressed', 'sea'], ['US', 'pressed', 'air'],
    ])
  })
  it('counts logged, awaiting and ground visits, and takes the first year from flights or else ground years', () => {
    expect(by('US').visits).toBe(4)
    expect(by('CH')).toMatchObject({ visits: 2, firstYear: 2015 })
    expect(by('JP').firstYear).toBe(2019)
    expect(by('IS')).toMatchObject({ visits: 0, firstYear: null, claimed: true })
  })
})

describe('visit chronology', () => {
  const only = (countries: Row[], groundVisits: PassportData['groundVisits']) => {
    const list = passportEntries({ countries, groundVisits })
    const counts = { pressedCountryCount: list.filter(entry => entry.status === 'pressed').length, pendingCountryCount: list.filter(entry => entry.status === 'pending').length }
    return { list, figures: headerFigures(counts, list, now) }
  }
  it('dates a land or sea visit by its year alone, and counts it as new this year and as the latest stamp', () => {
    const { list, figures } = only([row('NO', { ground_visit_count: 1, region: 'europe' })], [{ country_code: 'NO', visit_year: 2026, entry_method: 'land' }])
    expect(list[0]).toMatchObject({ firstYear: 2026, first: { year: 2026, date: null }, last: { year: 2026, date: null } })
    expect(figures).toMatchObject({ newThisYear: 1, latest: { code: 'NO' } })
  })
  it('takes an earlier land visit as the first visit even when the first flight is dated', () => {
    const { list, figures } = only([row('IT', { logged_visit_count: 1, ground_visit_count: 1, first_visit: '2026-03-01', last_visit: '2026-03-01', region: 'europe' })],
      [{ country_code: 'IT', visit_year: 2018, entry_method: 'land' }])
    expect(list[0]).toMatchObject({ firstYear: 2018, first: { year: 2018, date: null }, last: { year: 2026, date: '2026-03-01' } })
    expect(figures.newThisYear).toBe(0)
  })
  it('shows a year when a dated flight and a land visit share it, and keeps undated evidence undated', () => {
    const { list } = only([
      row('AT', { logged_visit_count: 1, ground_visit_count: 1, first_visit: '2025-06-01', last_visit: '2025-06-01', region: 'europe' }),
      row('GR', { ground_visit_count: 1, claimed: 1, region: 'europe' }),
    ], [{ country_code: 'AT', visit_year: 2025, entry_method: 'land' }, { country_code: 'GR', visit_year: null, entry_method: 'sea' }])
    expect(list[0]).toMatchObject({ first: { year: 2025, date: null }, last: { year: 2025, date: null } })
    expect(list[1]).toMatchObject({ firstYear: null, first: null, last: null })
  })
})

describe('sorting and grouping', () => {
  it('puts the pending slot first under Recent, then the latest visit', () => {
    expect(sortEntries(entries, 'recent', name, 'en').map(entry => entry.code)).toEqual(['PT', 'US', 'JP', 'CH', 'GR', 'IS'])
  })
  it('sorts by visits and by localized name', () => {
    expect(sortEntries(entries, 'visits', name, 'en').map(entry => entry.code)).toEqual(['JP', 'US', 'CH', 'GR', 'PT', 'IS'])
    expect(sortEntries(entries, 'name', name, 'en').map(entry => entry.code)).toEqual(['GR', 'IS', 'JP', 'PT', 'CH', 'US'])
  })
  it('groups by region in the order the sort reaches each region first', () => {
    const groups = groupByRegion(sortEntries(entries, 'recent', name, 'en'))
    expect(groups.map(group => [group.region, group.entries.map(entry => entry.code)])).toEqual([
      ['europe', ['PT', 'CH', 'GR', 'IS']], ['americas', ['US']], ['asia', ['JP']],
    ])
  })
})

describe('header figures', () => {
  it('states pressed + pending as the total, keeps them apart, and counts first visits this year', () => {
    expect(headerFigures(data, entries, now)).toMatchObject({ total: 6, pressed: 5, pending: 1, newThisYear: 1 })
  })
  it('takes the newest first visit among pressed stamps as the latest stamp, never a pending one', () => {
    expect(headerFigures(data, entries, now).latest?.code).toBe('US')
  })
  it('uses the whole catalog as the denominator', () => {
    expect(CATALOG_TOTAL).toBe(Object.keys(catalog).length)
    expect(CATALOG_TOTAL).toBe(246)
  })
})

describe('stampCaption', () => {
  it('writes the count and relative time in readable text, localized', () => {
    expect(stampCaption('en', by('JP'), now)).toBe('×12 · 2 mo. ago')
    expect(stampCaption('ru', by('JP'), now)).toBe('×12 · 2 мес. назад')
    expect(stampCaption('en', by('CH'), now)).toBe('×2 · 2018')
    expect(stampCaption('en', by('GR'), now)).toBe('×1')
    expect(stampCaption('en', by('IS'), now)).toBeUndefined()
  })
})

describe('suggestions', () => {
  it('suggests uncollected neighbors of pressed countries and recent pressed countries', () => {
    const result = suggestCountries(entries)
    // CH is dated only by its land years (2018), which still place it among recent visits.
    expect(result.recent).toEqual(['US', 'JP', 'CH'])
    // Uncollected neighbors of pressed CH, GR and US (each bordered once here), capped at six. Portugal is
    // only pending, so Spain is not suggested through it; collected countries are never suggested.
    expect(result.neighbors).toEqual(['AL', 'AT', 'BG', 'CA', 'DE', 'FR'])
    const more = suggestCountries(entries, { recent: 4, neighbors: 50 }).neighbors
    expect(more).not.toContain('ES')
    expect(more).not.toContain('CH')
  })
  it('searches code, English, native and localized names', () => {
    expect(searchCountries('jp', name)[0]).toBe('JP')
    expect(searchCountries('日本', name)).toEqual(['JP'])
    expect(searchCountries('Германия', countryNamer('ru'))).toEqual(['DE'])
    expect(searchCountries('cote', name)).toContain('CI')
    expect(searchCountries('', name)).toHaveLength(246)
  })
})

describe('country neighbors dataset', () => {
  const codes = Object.keys(COUNTRY_NEIGHBORS)
  it('covers only catalog codes and is symmetric', () => {
    for (const code of codes) {
      expect(Object.hasOwn(catalog, code), code).toBe(true)
      for (const neighbor of COUNTRY_NEIGHBORS[code]) {
        expect(Object.hasOwn(catalog, neighbor), neighbor).toBe(true)
        expect(COUNTRY_NEIGHBORS[neighbor], `${neighbor} -> ${code}`).toContain(code)
      }
    }
  })
  it('has well-known land borders and no sea-only pairs', () => {
    expect(COUNTRY_NEIGHBORS.FR).toEqual(expect.arrayContaining(['ES', 'DE', 'BE', 'CH', 'IT', 'LU', 'BR']))
    expect(COUNTRY_NEIGHBORS.US).toEqual(['CA', 'MX'])
    expect(COUNTRY_NEIGHBORS.GB).toEqual(['IE'])
    expect(COUNTRY_NEIGHBORS.FR).not.toContain('GB')
    expect(COUNTRY_NEIGHBORS.JP).toBeUndefined()
  })
})

describe('arrivalHref', () => {
  const queue = [
    { flight: { id: 7, origin: 'JFK', destination: 'IST' }, effectiveDefault: { transit: true } },
    { flight: { id: 8, origin: 'IST', destination: 'LIS' }, effectiveDefault: { transit: false } },
  ]
  it('links a pending country to the arrival card of a flight that reaches it', () => {
    expect(arrivalHref('PT', queue)).toBe('/journal?queue=awaiting#arrival-8')
  })
  it('skips a default-transit destination and falls back to the queue', () => {
    expect(arrivalHref('TR', [queue[0]])).toBe('/journal?queue=awaiting')
    expect(arrivalHref('PT', undefined)).toBe('/journal?queue=awaiting')
  })
})

describe('removalOutcome', () => {
  type Entries = Parameters<typeof removalOutcome>[0]['entries']
  const flight = (state: 'logged' | 'awaiting') => ({ kind: 'flight' as const, flightId: 1, endpoint: 'destination' as const, airport: 'ATH', date: '2026-01-02', state })
  const claim = { kind: 'claim' as const, claimedAt: '2026-01-01' }
  const ground = (id: string) => ({ kind: 'ground' as const, id, visitYear: 2018, entryMethod: 'sea' })
  it('removes claim and ground visits; a logged or archived flight keeps the stamp pressed', () => {
    expect(removalOutcome({ entries: [claim, ground('a'), ground('b'), flight('logged')] as Entries })).toEqual({ removable: true, claimed: true, groundVisits: 2, after: 'pressed' })
    expect(removalOutcome({ entries: [ground('a'), { kind: 'legacy', airport: 'ATH', visitCount: 2, firstVisit: '', lastVisit: '', provenance: 'x', explanation: 'archived_counter', flightCount: 0 }] as Entries }).after).toBe('pressed')
  })
  it('leaves an awaiting-only country pending and a manual-only country gone', () => {
    expect(removalOutcome({ entries: [claim, flight('awaiting')] as Entries }).after).toBe('pending')
    expect(removalOutcome({ entries: [claim] as Entries })).toEqual({ removable: true, claimed: true, groundVisits: 0, after: 'gone' })
  })
  it('offers no direct removal for a flight-only country', () => {
    expect(removalOutcome({ entries: [flight('logged')] as Entries }).removable).toBe(false)
  })
})
