import { describe, expect, it } from 'vitest'
import {
  activeFilterCount,
  countryNamer,
  filterEntries,
  foundText,
  passportEntries,
  searchSuggestion,
  sortEntries,
  splitPending,
  totalsText,
  visitorEntries,
  type PassportFilters,
} from './model'

const row = (
  country_code: string,
  patch: Partial<Parameters<typeof passportEntries>[0]['countries'][number]> = {},
) => ({
  country_code,
  status: 'pressed' as const,
  logged_visit_count: 0,
  awaiting_visit_count: 0,
  claimed: 0,
  ground_visit_count: 0,
  ground_journey_count: 0,
  first_visit: null,
  last_visit: null,
  region: 'europe' as const,
  ...patch,
})

const entries = passportEntries({
  countries: [
    row('FR', { logged_visit_count: 3, first_visit: '2020-01-01', last_visit: '2024-05-01' }),
    row('DE', { ground_journey_count: 1, last_visit: '2025-02-01' }),
    row('JP', { claimed: 1, region: 'asia' }),
    row('CH', { logged_visit_count: 1, ground_visit_count: 1, last_visit: '2022-01-01' }),
    row('IT', { ground_journey_count: 1 }),
    row('BR', { status: 'pending', awaiting_visit_count: 1, region: 'americas' }),
  ],
  groundVisits: [],
  journeyModes: [
    { country_code: 'DE', mode: 'rail' },
    { country_code: 'IT', mode: 'road' },
    { country_code: 'CH', mode: 'rail' },
  ],
})
const en = countryNamer('en')
const ru = countryNamer('ru')
const none: PassportFilters = { q: '', region: null, sources: [] }
const codes = (list: { code: string }[]) => list.map((entry) => entry.code).sort()

describe('filterEntries', () => {
  it('derives sources in fixed order, mixed countries carrying several', () => {
    expect(entries.find((e) => e.code === 'CH')?.sources).toEqual(['flights', 'trains', 'manual'])
  })
  it('ORs within sources and ANDs across groups', () => {
    expect(codes(filterEntries(entries, { ...none, sources: ['trains', 'road'] }, en))).toEqual([
      'CH',
      'DE',
      'IT',
    ])
    expect(
      codes(filterEntries(entries, { ...none, region: 'europe', sources: ['manual'] }, en)),
    ).toEqual(['CH'])
  })
  it('matches a mixed-source country under each of its sources', () => {
    for (const source of ['flights', 'trains', 'manual'] as const)
      expect(codes(filterEntries(entries, { ...none, sources: [source] }, en))).toContain('CH')
  })
  it('ignores sources for visitors', () => {
    expect(
      filterEntries(entries, { ...none, sources: ['road'] }, en, { visitor: true }),
    ).toHaveLength(entries.length)
  })
  it('searches localized, English and code values without case or diacritics', () => {
    expect(codes(filterEntries(entries, { ...none, q: 'франц' }, ru))).toEqual(['FR'])
    expect(codes(filterEntries(entries, { ...none, q: 'GERMAN' }, ru))).toEqual(['DE'])
    expect(codes(filterEntries(entries, { ...none, q: 'jp' }, en))).toEqual(['JP'])
    expect(codes(filterEntries(entries, { ...none, q: 'Nippon' }, en))).toEqual([])
    expect(codes(filterEntries(entries, { ...none, q: 'swıtzerland' }, en))).toEqual([])
    expect(codes(filterEntries(entries, { ...none, q: 'SWITZERLAND' }, en))).toEqual(['CH'])
  })
  it('never changes entry fields', () => {
    const [fr] = filterEntries(entries, { ...none, sources: ['flights'] }, en)
    expect(fr).toBe(entries.find((e) => e.code === 'FR'))
  })
})

it('activeFilterCount counts region and sources, not search, and no sources for visitors', () => {
  const filters: PassportFilters = { q: 'x', region: 'asia', sources: ['flights', 'road'] }
  expect(activeFilterCount(filters)).toBe(3)
  expect(activeFilterCount(filters, { visitor: true })).toBe(1)
})

describe('sortEntries', () => {
  const pressed = splitPending(entries).collection
  it('recent puts the latest first and undated last', () => {
    expect(sortEntries(pressed, 'recent', en, 'en').map((e) => e.code)).toEqual([
      'DE',
      'FR',
      'CH',
      'IT',
      'JP',
    ])
  })
  it('records sorts by visits with name ties', () => {
    expect(sortEntries(pressed, 'records', en, 'en').map((e) => e.code)).toEqual([
      'FR',
      'CH',
      'DE',
      'IT',
      'JP',
    ])
  })
  it('name sorts by the localized name', () => {
    expect(sortEntries(pressed, 'name', ru, 'ru').map((e) => e.code)).toEqual([
      'DE',
      'IT',
      'FR',
      'CH',
      'JP',
    ])
  })
  it('splitPending separates pending slots', () => {
    expect(splitPending(entries).pending.map((e) => e.code)).toEqual(['BR'])
  })
})

it('visitorEntries are bare pressed items with the catalog region', () => {
  const [jp] = visitorEntries(['JP'])
  expect(jp).toMatchObject({
    code: 'JP',
    status: 'pressed',
    visits: 0,
    region: 'asia',
    sources: [],
  })
  expect(jp.last).toBeNull()
})

describe('copy', () => {
  it('totalsText pluralizes English and appends hidden', () => {
    expect(totalsText('en', { visited: 1, hidden: 0 })).toBe('Visited 1 country')
    expect(totalsText('en', { visited: 12, hidden: 3 })).toBe('Visited 12 countries · 3 hidden')
  })
  it('totalsText agrees in Russian for 1, 2, 5 and 21', () => {
    expect(totalsText('ru', { visited: 1, hidden: 1 })).toBe('Посещена 1 страна · 1 скрыта')
    expect(totalsText('ru', { visited: 2, hidden: 3 })).toBe('Посещено 2 страны · 3 скрыты')
    expect(totalsText('ru', { visited: 12, hidden: 5 })).toBe('Посещено 12 стран · 5 скрыто')
    expect(totalsText('ru', { visited: 5, hidden: 0 })).toBe('Посещено 5 стран')
    expect(totalsText('ru', { visited: 21, hidden: 0 })).toBe('Посещена 21 страна')
  })
  it('foundText', () => {
    expect(foundText('en', 3, 12)).toBe('Found 3 of 12')
    expect(foundText('ru', 3, 12)).toBe('Найдено 3 из 12')
  })
})

describe('searchSuggestion', () => {
  it('offers the single catalog country missing from the collection', () => {
    expect(
      searchSuggestion(
        'Japan',
        entries.filter((e) => e.code !== 'JP'),
        en,
      ),
    ).toBe('JP')
  })
  it('offers nothing when the collection matches, the query is ambiguous or empty', () => {
    expect(searchSuggestion('Japan', entries, en)).toBeNull()
    expect(searchSuggestion('ia', entries.slice(0, 1), en)).toBeNull()
    expect(searchSuggestion('  ', entries, en)).toBeNull()
  })
})
