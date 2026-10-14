import { expect, it } from 'vitest'
import { normalizeJournalQuery, journalHref, normalizePassportQuery } from './url-state'
const now = new Date('2026-10-05T00:00:00Z')
const qs = (value: string) => new URLSearchParams(value)

it('Journal exact-day bookmarks supersede years, normalize invalid periods and clear both bounds', () => {
  const normalized = normalizeJournalQuery(
    qs('year=2025&from=2024-02-29&to=2024-03-01&airport=tbs'),
    now,
  )
  expect(normalized.state).toEqual({ from: '2024-02-29', to: '2024-03-01', airport: 'TBS' })
  expect(normalizeJournalQuery(qs(normalized.query), now).canonical).toBe(true)
  for (const range of [
    'from=2025-02-29&to=2025-03-01',
    'from=2024-03-01&to=2024-02-29',
    'from=2024-02-29',
    'to=2024-02-29',
    'from=&to=',
  ]) {
    expect(normalizeJournalQuery(qs(`year=2025&${range}&airport=TBS`), now).state).toEqual({
      airport: 'TBS',
    })
  }
  expect(journalHref({ from: '2024-02-29', to: '2024-03-01', year: 2025 })).toBe(
    '/journal?from=2024-02-29&to=2024-03-01',
  )
})

it('Journal paging bookmarks are dropped: the list is in memory', () => {
  const normalized = normalizeJournalQuery(qs('page=3&airport=TBS'), now)
  expect(normalized.state).toEqual({ airport: 'TBS' })
  expect(normalized.query).toBe('airport=TBS')
  expect(normalized.canonical).toBe(false)
})

const noCountry = () => false

it('Passport legacy keys are rewritten: stamps view and layer, year and period are dropped, visits sorts as records', () => {
  const stamps = normalizePassportQuery(
    qs('view=stamps&sort=visits&layer=routes&year=2026&period=2025'),
    noCountry,
  )
  expect(stamps.state).toMatchObject({ view: 'cards', sort: 'records' })
  expect(stamps.query).toBe('sort=records')
  expect(stamps.canonical).toBe(false)
  expect(normalizePassportQuery(qs(stamps.query), noCountry).canonical).toBe(true)
  expect(normalizePassportQuery(qs('view=map'), noCountry).query).toBe('view=map')
})

it('Passport sources are deduped, ordered and filtered, and search text is trimmed and capped', () => {
  const normalized = normalizePassportQuery(
    qs(`src=manual,bogus,flights,manual,road&q=%20%20Новая%20%20Зеландия%20&region=europe`),
    noCountry,
  )
  expect(normalized.state).toMatchObject({
    q: 'Новая Зеландия',
    region: 'europe',
    sources: ['flights', 'road', 'manual'],
  })
  expect(normalized.query).toBe(
    new URLSearchParams({
      q: 'Новая Зеландия',
      region: 'europe',
      src: 'flights,road,manual',
    }).toString(),
  )
  expect(normalizePassportQuery(qs('q=' + 'a'.repeat(80)), noCountry).state.q).toHaveLength(64)
  expect(normalizePassportQuery(qs('q=%20&src=bogus&region=mars'), noCountry).query).toBe('')
})

it('Passport as=visitor is kept and any other value is dropped', () => {
  expect(normalizePassportQuery(qs('as=visitor'), noCountry).state.as).toBe('visitor')
  expect(normalizePassportQuery(qs('as=admin'), noCountry).state.as).toBeNull()
})

it('Passport country deep links keep catalog validation', () => {
  expect(normalizePassportQuery(qs('country=ge'), (code) => code === 'GE').state.country).toBe('GE')
  expect(normalizePassportQuery(qs('country=zz'), noCountry).state.country).toBeNull()
})
