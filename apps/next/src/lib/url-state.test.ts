import { describe, expect, it } from 'vitest'
import {
  normalizeJournalQuery, journalHref, resetJournalFilters, normalizeImportQuery, normalizeOnboardingQuery, normalizeOverviewQuery, normalizePassportQuery, resolveOnboardingStep, withQuery,
} from './url-state'

const now = new Date('2026-10-05T00:00:00Z')
const qs = (value: string) => new URLSearchParams(value)

describe('overview', () => {
  it('keeps a valid year and drops everything out of range or malformed', () => {
    expect(normalizeOverviewQuery(qs('year=2024'), now)).toMatchObject({ query: 'year=2024', canonical: true, state: { year: '2024' } })
    for (const bad of ['1899', '2028', '24', 'abcd', '2024x', '']) expect(normalizeOverviewQuery(qs(`year=${bad}`), now)).toMatchObject({ query: '', canonical: false, state: { year: null } })
    expect(normalizeOverviewQuery(qs('year=2027'), now).state.year).toBe('2027')
  })
  it('rewrites the legacy period key and omits the default', () => {
    expect(normalizeOverviewQuery(qs('period=2023'), now)).toMatchObject({ query: 'year=2023', canonical: false })
    expect(normalizeOverviewQuery({}, now)).toMatchObject({ query: '', canonical: true })
  })
  it('keeps unrelated keys and accepts record input with arrays', () => {
    expect(normalizeOverviewQuery({ year: ['2022', '2023'], utm: 'x' }, now)).toMatchObject({ query: 'year=2022&utm=x', canonical: false })
  })
})

describe('passport', () => {
  it('omits defaults and uppercases the country', () => {
    expect(normalizePassportQuery(qs('view=stamps&sort=recent&layer=countries&country=jp'), now).query).toBe('country=JP')
    expect(normalizePassportQuery(qs('view=map&layer=routes&sort=visits&country=jp&year=2024'), now).query).toBe('view=map&sort=visits&country=JP&layer=routes&year=2024')
  })
  it('drops invalid values without loops', () => {
    const result = normalizePassportQuery(qs('view=bogus&sort=x&layer=y&country=JPN&year=1'), now)
    expect(result).toMatchObject({ query: '', canonical: false, state: { view: 'stamps', sort: 'recent', layer: 'countries', country: null, year: null } })
  })
})

describe('import', () => {
  const id = '3f2b8c1e-5a4d-4e0b-9d7a-1c2b3a4d5e6f'
  it('validates source and batch uuid', () => {
    expect(normalizeImportQuery(qs(`source=text&batch=${id.toUpperCase()}`))).toMatchObject({ query: `source=text&batch=${id}`, canonical: false })
    expect(normalizeImportQuery(qs('source=paste&batch=nope')).query).toBe('')
  })
  it('does not touch the draft handoff key', () => {
    expect(normalizeImportQuery(qs('draft=abc'))).toMatchObject({ query: 'draft=abc', canonical: true })
  })
})

describe('onboarding', () => {
  const none = { hasUsername: false, hasFlight: false }
  const named = { hasUsername: true, hasFlight: false }
  const done = { hasUsername: true, hasFlight: true }
  it('never shows an unearned step', () => {
    expect(resolveOnboardingStep('reveal', none)).toBe('name')
    expect(resolveOnboardingStep('capture', none)).toBe('name')
    expect(resolveOnboardingStep('reveal', named)).toBe('capture')
    expect(resolveOnboardingStep('reveal', done)).toBe('reveal')
    expect(resolveOnboardingStep('name', done)).toBe('name')
  })
  it('defaults an invalid or missing step to the earned one', () => {
    expect(resolveOnboardingStep('bogus', none)).toBe('name')
    expect(resolveOnboardingStep(undefined, named)).toBe('capture')
    expect(resolveOnboardingStep(undefined, done)).toBe('reveal')
    expect(normalizeOnboardingQuery(qs('step=reveal'), named)).toMatchObject({ query: 'step=capture', canonical: false })
  })
})

describe('fixed point', () => {
  const inputs = ['', 'year=2024&view=map', 'view=bogus&country=jp&x=1&x=2', 'period=2020&year=zzzz', 'source=file&batch=bad&draft=1', 'step=reveal&a=b']
  it('re-normalizing the canonical output changes nothing', () => {
    for (const input of inputs) {
      for (const run of [
        (s: string) => normalizeOverviewQuery(qs(s), now),
        (s: string) => normalizePassportQuery(qs(s), now),
        (s: string) => normalizeImportQuery(qs(s)),
        (s: string) => normalizeOnboardingQuery(qs(s), { hasUsername: true, hasFlight: false }),
      ]) {
        const once = run(input)
        const twice = run(once.query)
        expect(twice.query).toBe(once.query)
        expect(twice.canonical).toBe(true)
      }
    }
  })
  it('withQuery omits an empty query', () => {
    expect(withQuery('/passport', '')).toBe('/passport')
    expect(withQuery('/passport', 'view=map')).toBe('/passport?view=map')
  })
})


describe('journal C1', () => {
  it('validates and normalizes filters, sorting and navigation state to a fixed point', () => {
    const result = normalizeJournalQuery(qs('q=%20TBS%20&airport=tbs&airlineIata=tk&aircraftIcao=a320&isUpcoming=false&sortField=distance_km&sortOrder=asc&year=2025&flight=4&queue=awaiting'), now)
    expect(Object.fromEntries(qs(result.query))).toEqual({ q: 'TBS', airport: 'TBS', airline: 'TK', aircraft: 'A320', status: 'completed', sort: 'distance_km', order: 'asc', year: '2025', flight: '4', queue: 'awaiting' })
    expect(normalizeJournalQuery(qs(result.query), now).canonical).toBe(true)
    expect(normalizeJournalQuery(qs('airport=bad-code&status=draft&year=1800&sort=sql&flight=-1&batch=bad'), now).query).toBe('')
  })
  it('reset removes filters and pagination, preserving detail, queue, batch and sorting', () => {
    expect(resetJournalFilters('q=abc&year=2025&status=logged&airport=IST&page=3&flight=12&queue=awaiting&batch=x&order=asc')).toBe('flight=12&queue=awaiting&batch=x&order=asc')
  })
})

describe('journalHref (Overview "All" links)', () => {
  it('builds canonical C1 hrefs for airport, airline, aircraft and year', () => {
    expect(journalHref({ airport: 'tbs', year: '2025' })).toBe('/journal?year=2025&airport=TBS')
    expect(journalHref({ airline: 'tk', year: 2025 })).toBe('/journal?year=2025&airline=TK')
    expect(journalHref({ aircraft: 'a320' })).toBe('/journal?aircraft=A320')
    expect(journalHref({})).toBe('/journal')
  })
  it('keeps an exact route and a sort for the Overview route and missing-aircraft links', () => {
    const route = journalHref({ origin: 'tbs', destination: 'ist', year: 2025 })
    expect(new URLSearchParams(route.split('?')[1]).get('origin')).toBe('TBS')
    expect(new URLSearchParams(route.split('?')[1]).get('destination')).toBe('IST')
    // Ascending aircraft puts flights with no aircraft first in the Journal.
    const missing = journalHref({ year: 2025, sort: 'aircraft_icao', order: 'asc' })
    expect(Object.fromEntries(new URLSearchParams(missing.split('?')[1]))).toEqual({ year: '2025', sort: 'aircraft_icao', order: 'asc' })
    expect(normalizeJournalQuery(new URLSearchParams(missing.split('?')[1])).canonical).toBe(true)
  })
  it('drops invalid values and returns a canonical fixed point', () => {
    expect(journalHref({ airport: 'bad-code', year: '1800', airline: '' })).toBe('/journal')
    const href = journalHref({ airport: 'IST', airline: 'TK', year: '2024' })
    expect(normalizeJournalQuery(new URLSearchParams(href.split('?')[1])).canonical).toBe(true)
  })
})
