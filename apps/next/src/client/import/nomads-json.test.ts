import { expect, it } from 'vitest'
import { nomadsToText } from './nomads-json'
import { parseStructuredText } from '../../../../../functions/api/import/_text'
import { rowOf } from '../../../../../functions/api/_services/importJob'
import { normalizeFlights } from '../../../../../functions/api/import/_extract'

const stay = (place: string, start: string, end = start) => ({
  place,
  country_code: 'US',
  date_start: start,
  date_end: end,
})
it('sorts stays, strips private profile data and keeps drafts unselected with city hints', () => {
  const result = nomadsToText(
    JSON.stringify({
      username: 'private-user',
      photo: 'private-photo',
      trips: [stay('Boston', '2026-03-12'), stay('New York', '2026-03-01', '2026-03-10')],
    }),
  )
  expect(result.content).not.toContain('private')
  const flights = parseStructuredText(result.content)!.flights
  expect(flights).toHaveLength(1)
  expect(rowOf(flights[0])).toMatchObject({
    selected: false,
    fields: {
      date: '2026-03-12',
      origin: '',
      destination: '',
      airline_iata: 'ZZ',
      origin_hint: 'New York, US',
      destination_hint: 'Boston, US',
      review_required: true,
    },
  })
})
it('leaves overlapping dates unknown and skips repeated or ambiguously ordered stays', () => {
  const result = nomadsToText(
    JSON.stringify({
      trips: [
        stay('New York', '2026-01-01', '2026-01-20'),
        stay('Boston', '2026-01-10'),
        stay('Boston', '2026-01-12'),
        stay('Chicago', '2026-01-12'),
      ],
    }),
  )
  expect(result.skipped).toBe(2)
  const normalized = normalizeFlights(parseStructuredText(result.content)!)
  expect(normalized.flights).toHaveLength(1)
  expect(normalized.flights[0].date).toBe('')
  expect(rowOf(normalized.flights[0]).selected).toBe(false)
})
it('retains unknown countries and rejects invalid dates, oversized exports and list injection', () => {
  const result = nomadsToText(
    JSON.stringify({
      trips: [
        { ...stay('Unknown place', '2026-01-01'), country_code: '' },
        stay('Boston', '2026-01-02'),
      ],
    }),
  )
  expect(result.content).toContain('Unknown place, ?')
  for (const input of [
    '{}',
    '{',
    JSON.stringify({ trips: [stay('Boston', '2026-02-30')] }),
    JSON.stringify({ trips: [stay('Boston | BA123', '2026-01-01')] }),
    JSON.stringify({ trips: Array(502).fill(stay('Boston', '2026-01-01')) }),
  ])
    expect(() => nomadsToText(input)).toThrow()
})

it('retains review candidates when a split stay resumes on the day another stay starts', () => {
  const trips = [
    stay('Phoenix', '2026-01-01', '2026-03-06'),
    stay('Boston', '2026-03-06', '2026-03-13'),
    stay('Phoenix', '2026-03-13', '2026-06-09'),
    stay('Chicago', '2026-03-13', '2026-03-20'),
    stay('Denver', '2026-03-20'),
  ]
  const result = nomadsToText(JSON.stringify({ trips }))
  expect(result.skipped).toBe(1)
  expect(result.content).toContain('2026-03-13 | Boston, US → Chicago, US')
  expect(result.content).toContain('2026-03-20 | Chicago, US → Denver, US')
  const flights = parseStructuredText(result.content)!.flights
  expect(flights).toHaveLength(3)
  expect(flights.every((flight) => !rowOf(flight).selected)).toBe(true)
  expect(nomadsToText(JSON.stringify({ trips: [...trips].reverse() }))).toEqual(result)
})
it('does not invent flights for an empty export or a single stay', () => {
  expect(nomadsToText('{"trips":[]}').content).toBe('')
  expect(nomadsToText(JSON.stringify({ trips: [stay('Boston', '2026-01-01')] })).content).toBe('')
})

it('still rejects undated empty routes without distinct city hints and an explicit review marker', () => {
  const flight = {
    date: '',
    origin: '',
    destination: '',
    airline_iata: 'ZZ',
    confidence: 0.5,
    origin_hint: 'Boston',
    destination_hint: 'Chicago',
    review_required: true,
  }
  for (const change of [
    { review_required: false },
    { destination_hint: 'Boston' },
    { destination_hint: '' },
  ])
    expect(() => normalizeFlights({ flights: [{ ...flight, ...change }] })).toThrow()
})
