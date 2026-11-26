import { expect, it } from 'vitest'
import { NOMADS_MAX_ROUTES, nomadsSummaryOf, nomadsToText, prepareNomads } from './nomads-json'
import { nomadsLeftOutParts, nomadsStory } from './nomads-note'
import { parseStructuredText } from '../../../../../functions/api/import/_text'

const stay = (place: string, start: string, end = start, country_code = 'US') => ({
  place,
  country_code,
  date_start: start,
  date_end: end,
})
const exportOf = (trips: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ ...extra, trips })
const lines = (content: string) => (content ? content.split('\n') : [])
const route = (line: string) => line.replace(/^\S+ \| /, '').replace(/ \[.*\]$/, '')

it('orders stays, dates each move by the next stay and keeps profile data out', () => {
  const result = nomadsToText(
    exportOf([stay('Boston', '2026-03-12'), stay('New York', '2026-03-01', '2026-03-10')], {
      username: 'private-user',
      photo: 'private-photo',
    }),
  )
  expect(lines(result.content)).toEqual([
    '2026-03-12 | New York, US → Boston, US [possible flight from Nomads stays]',
  ])
  expect(result.summary).toMatchObject({ stays: 2, countries: 1, routes: 1 })
})

it('leaves out hops short enough to travel by land and keeps cities without airports', () => {
  const result = nomadsToText(
    exportOf([
      stay('Rome', '2026-04-01', '2026-04-05', 'IT'),
      stay('Naples', '2026-04-06', '2026-04-08', 'IT'),
      stay('Lisbon', '2026-04-09', '2026-04-12', 'PT'),
      stay('Porto', '2026-04-13', '2026-04-15', 'PT'),
      stay('Canggu', '2026-04-20', '2026-04-25', 'ID'),
    ]),
  )
  expect(lines(result.content).map(route)).toEqual([
    'Naples, IT → Lisbon, PT',
    'Lisbon, PT → Porto, PT',
    'Porto, PT → Canggu, ID',
  ])
  expect(result.summary).toMatchObject({ routes: 3, ground: 1 })
})

it('merges repeated stays, leaves overlaps undated and skips moves with an unclear order', () => {
  const result = nomadsToText(
    exportOf([
      stay('New York', '2026-01-01', '2026-01-05'),
      stay('New York', '2026-01-06', '2026-01-20'),
      stay('Boston', '2026-01-10', '2026-01-11'),
      stay('Chicago', '2026-01-15'),
      stay('Seattle', '2026-01-15'),
    ]),
  )
  expect(lines(result.content)).toEqual([
    'Undated | New York, US → Boston, US [possible flight from Nomads stays]',
  ])
  expect(result.summary).toMatchObject({ routes: 1, unclear: 2, ground: 0 })
})

it('skips unreadable stays one by one and treats a missing country as unknown', () => {
  const result = nomadsToText(
    exportOf([
      stay('Boston', '2026-02-30'),
      stay('Boston | BA123', '2026-01-01'),
      { ...stay('Chicago', '2026-01-03'), country_code: null },
      stay('Boston', '2026-01-02'),
    ]),
  )
  expect(lines(result.content).map(route)).toEqual(['Boston, US → Chicago'])
  expect(result.summary).toMatchObject({ stays: 2, invalid: 2 })
})

it('refuses files that are not a Nomads trips export', () => {
  for (const input of [
    '{}',
    '{',
    exportOf([stay('Boston', '2026-02-30')]),
    exportOf(Array(10_001).fill(1)),
  ])
    expect(() => nomadsToText(input)).toThrow()
  expect(prepareNomads(new TextEncoder().encode('{'), 'trips.json')).toEqual({ kind: 'failed' })
})

it('keeps the newest routes when an export has more than one batch can hold', () => {
  const day = (offset: number) => new Date(Date.UTC(2020, 0, 1 + offset)).toISOString().slice(0, 10)
  const trips = Array.from({ length: NOMADS_MAX_ROUTES + 3 }, (_, index) =>
    index % 2
      ? stay('Bangkok', day(index * 2), day(index * 2), 'TH')
      : stay('Lisbon', day(index * 2), day(index * 2), 'PT'),
  )
  const result = nomadsToText(exportOf(trips))
  expect(result.summary).toMatchObject({ routes: NOMADS_MAX_ROUTES, older: 2 })
  expect(lines(result.content).at(-1)).toContain(day((NOMADS_MAX_ROUTES + 2) * 2))
})

it('does not invent flights for an empty export or a single stay', () => {
  expect(prepareNomads(new TextEncoder().encode(exportOf([])), 'trips.json')).toMatchObject({
    kind: 'empty',
  })
  expect(nomadsToText(exportOf([stay('Boston', '2026-01-01')])).content).toBe('')
})

it('produces only lines the deterministic parser reads, so nothing falls back to the model', () => {
  const places = [
    'Road to Hana',
    'London\u2028West',
    'Tab\tCity',
    'Zero\u200bWidth',
    'São Paulo',
    'Tōkyō',
    'A -- B',
    'Saint-Denis (Réunion)',
    'Hà Nội?',
    'x'.repeat(60),
  ]
  const month = (index: number) => `2025-${String(index + 1).padStart(2, '0')}-01`
  const result = nomadsToText(
    exportOf(places.map((place, index) => stay(place, month(index), month(index), 'FR'))),
  )
  expect(result.summary.routes).toBe(places.length - 1)
  expect(parseStructuredText(result.content)?.flights).toHaveLength(result.summary.routes)
  expect(result.content).toContain('London West, FR')
  expect(result.content).not.toMatch(/[\u2028\u200b\t]/)
})

it('tells the story in real Russian plural forms', () => {
  const summary = {
    stays: 21,
    countries: 3,
    routes: 5,
    ground: 2,
    unclear: 0,
    invalid: 1,
    older: 0,
  }
  expect(nomadsStory('ru', summary)).toBe('21 пребывание в 3 странах · 5 возможных перелётов')
  expect(nomadsStory('en', { ...summary, stays: 1, countries: 1, routes: 1 })).toBe(
    '1 stay in 1 country · 1 possible flight',
  )
  expect(nomadsLeftOutParts('ru', summary)).toEqual([
    '2 переезда короче 250\u00a0км',
    '1 нечитаемое пребывание',
  ])
})

it('restores only a well-formed summary from session storage', () => {
  const summary = { stays: 2, countries: 1, routes: 1, ground: 0, unclear: 0, invalid: 0, older: 0 }
  expect(nomadsSummaryOf({ ...summary, extra: 'x' })).toEqual(summary)
  expect(nomadsSummaryOf({ skipped: 1 })).toBeUndefined()
  expect(nomadsSummaryOf({ ...summary, routes: -1 })).toBeUndefined()
})
