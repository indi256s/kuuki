import { expect, it } from 'vitest'
import { normalizeJournalQuery, journalHref, resetJournalFilters } from './url-state'
const now = new Date('2026-10-05T00:00:00Z')
const qs = (value: string) => new URLSearchParams(value)

it('Journal exact-day bookmarks supersede years, normalize invalid periods and clear both bounds', () => {
  const normalized = normalizeJournalQuery(qs('year=2025&from=2024-02-29&to=2024-03-01&airport=tbs'), now)
  expect(normalized.state).toEqual({ from: '2024-02-29', to: '2024-03-01', airport: 'TBS' })
  expect(normalizeJournalQuery(qs(normalized.query), now).canonical).toBe(true)
  for (const range of ['from=2025-02-29&to=2025-03-01', 'from=2024-03-01&to=2024-02-29', 'from=2024-02-29', 'to=2024-02-29', 'from=&to=']) {
    expect(normalizeJournalQuery(qs(`year=2025&${range}&airport=TBS`), now).state).toEqual({ airport: 'TBS' })
  }
  expect(resetJournalFilters(normalized.query + '&page=2&order=asc')).toBe('order=asc')
  expect(journalHref({ from: '2024-02-29', to: '2024-03-01', year: 2025 })).toBe('/journal?from=2024-02-29&to=2024-03-01')
})

it('Journal paging bookmarks are dropped: the list is in memory', () => {
  const normalized = normalizeJournalQuery(qs('page=3&airport=TBS'), now)
  expect(normalized.state).toEqual({ airport: 'TBS' })
  expect(normalized.query).toBe('airport=TBS')
  expect(normalized.canonical).toBe(false)
})
