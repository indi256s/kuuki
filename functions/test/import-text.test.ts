import { afterEach, expect, it, vi } from 'vitest'
import { extractFlights, normalizeFlights } from '../api/import/_extract'
import { airportCandidates } from '../api/import/_text'
import { rowOf } from '../api/_services/importJob'
import { draftFieldsOf } from '../api/_services/importDrafts'

const provider = vi.hoisted(() => ({ generateContent: vi.fn() }))
vi.mock('@google/genai', async importOriginal => {
  const actual = await importOriginal<typeof import('@google/genai')>()
  return { ...actual, GoogleGenAI: class { models = { generateContent: provider.generateContent } } }
})
afterEach(() => provider.generateContent.mockReset())

it('imports a structured travel log locally, preserving uncertainty and excluding ineligible bookings', async () => {
  provider.generateContent.mockResolvedValue({ text: '{"flights":[]}' })
  const result = await extractFlights({} as Env, { type: 'text', content: [
    '2016-03-31 | DME → KGD | S7 Airlines S767 | 17:00 → 18:05 [travel log only]',
    '2022-03-26 | AYT → ZIA | Red Wings WZ4610 | dep 01:55 [schedule updated]',
    '2023-02-03 | SAW → TBS | Pegasus Airlines PC318 | 23:00 → 02:10 (2023-02-04) [possible refund not conclusively linked]',
    '2022-07-31 | OSL → LED | Nordwind Airlines N42306 | 19:30 → 22:35 [outbound canceled; return status unresolved]',
    '2025-03-08 | Tbilisi → Istanbul Sabiha Gokcen | Pegasus Airlines PC315 | 05:00 → 06:30',
    '2015-05-21 | ROV → Moscow | 07:05 → 08:55 [calendar only; times from calendar]',
    '2024-10-31 | TBS → DOH | Qatar Airways QR256 | dep 14:20 [replaced QR254; arrival unresolved]',
    '2020-03-25 | EVN → ROV | Azimuth A4226 | 12:55 → 12:35 [canceled; times from calendar]',
    '2022-03-13 | SAW → AYT | Pegasus Airlines PC2012 | 15:40 → 16:55 [unpaid reservation]',
    '2024-10-31 | TBS → DOH | Qatar Airways QR254 | 20:55 → 23:00 [superseded; replaced by QR256 at 14:20]',
    'Other-passenger bookings or conflicting ownership (18)',
    '2026-01-30 | TBS → GYD | Azal J28234 | 17:50 → 19:00 [other passenger]',
    '2026-01-31 | GYD → TBS | J28225 | 20:50 → 22:00',
    'Partial dates / incomplete records (7)',
    'Undated | BUD → ORY | Wizz Air [partial booking evidence]',
  ].join('\n') })
  expect(provider.generateContent).not.toHaveBeenCalled()
  expect(result.flights.map(f => [f.origin, f.destination, f.airline_iata, f.flight_number])).toEqual([
    ['DME', 'KGD', 'S7', '67'], ['AYT', 'ZIA', 'WZ', '4610'], ['SAW', 'TBS', 'PC', '318'],
    ['OSL', 'LED', 'N4', '2306'], ['TBS', 'SAW', 'PC', '315'], ['ROV', '', 'ZZ', undefined],
    ['TBS', 'DOH', 'QR', '256'], ['BUD', 'ORY', 'W6', undefined],
  ])
  expect(result.flights.map(f => rowOf(f).selected)).toEqual([true, false, false, false, true, false, false, false])
  expect(result.flights[1].departure_time).toBe('01:55')
  expect(result.flights[1].arrival_time).toBeUndefined()
  expect(result.flights[2]).toMatchObject({ date: '2023-02-03', arrival_time: '02:10' })
  expect(result.flights[7].date).toBe('')
})

it('sends unstructured or partly unsupported text intact to the provider once', async () => {
  provider.generateContent.mockResolvedValue({ text: '{"flights":[]}' })
  const content = '2026-03-10 | JFK → LHR | BA178\nAnd the return is on March 20.'
  await extractFlights({ GEMINI_API_KEY: 'test' } as Env, { type: 'text', content })
  expect(provider.generateContent).toHaveBeenCalledTimes(1)
  expect(provider.generateContent.mock.lastCall?.[0].contents[1]).toContain(content)
})

it('keeps uncertain model rows unselected, including an explicit ZZ placeholder', () => {
  const flights = normalizeFlights({ flights: [
    { date: '2026-03-10', origin: 'JFK', destination: 'LHR', airline_iata: 'BA', confidence: 0.95,
      field_confidence: { date_year_explicit: true, destination: 0.5 } },
    { date: '2026-03-10', origin: 'JFK', destination: 'LHR', airline_iata: 'ZZ', confidence: 0.95,
      field_confidence: { date_year_explicit: true } },
  ] }).flights
  expect(flights.map(f => rowOf(f).selected)).toEqual([false, false])
})

it('keeps a partially readable model route as a correctable draft instead of losing the leg', () => {
  const flights = normalizeFlights({ flights: [{ date: '', origin: 'TIV', destination: '', airline_iata: 'JU', confidence: 0.5 }] }).flights
  expect(flights).toHaveLength(1)
  expect(rowOf(flights[0])).toMatchObject({ fields: { origin: 'TIV', destination: '', date: '' }, selected: false })
})

it('keeps dated city-only and partial calendar records for correction and reports a route-less entry', async () => {
  const result = await extractFlights({} as Env, { type: 'text', content: [
    '2024-03-20 | Los Angeles to New York | Delta Air Lines',
    '2016-04-04 (calendar entry) | to Moscow [calendar only; arrival from calendar]',
    '2025-12-03 (calendar entry) [calendar only]',
  ].join('\n') })
  expect(result.flights.map(f => [f.date, f.origin, f.destination, rowOf(f).selected])).toEqual([
    ['2024-03-20', 'LAX', '', false], ['2016-04-04', '', '', false],
  ])
  expect(result.rejected).toEqual([{ index: 2, reason: 'incomplete route' }])
})

it('keeps uncertain cancellation evidence for review instead of excluding or preselecting it', async () => {
  const result = await extractFlights({} as Env, { type: 'text', content: [
    '2025-01-02 | JFK → LHR | BA178 [canceled?]',
    '2025-01-03 | JFK → LHR | BA178 [booking canceled?]',
    '2025-01-04 | JFK → LHR | BA178 [not canceled; canceled email was for outbound]',
  ].join('\n') })
  expect(result.flights.map(f => [f.date, rowOf(f).selected])).toEqual([
    ['2025-01-02', false], ['2025-01-03', false], ['2025-01-04', false],
  ])
})

it('resolves punctuated airport codes but leaves metro codes and contradictory dates for correction', async () => {
  const result = await extractFlights({} as Env, { type: 'text', content: [
    '2025-01-02 | Rio → JFK | BA178',
    '2025-01-03 | JFK → LHR. | BA178',
    '2025-01-04 | JFK → LHR | BA178 | 23:00 → 01:00 (2025-01-01)',
  ].join('\n') })
  expect(result.flights.map(f => [f.origin, f.destination, rowOf(f).selected])).toEqual([
    ['', 'JFK', false], ['JFK', 'LHR', true], ['JFK', 'LHR', false],
  ])
})

it('lists every catalog airport a label can mean, sorted, deduplicated and capped', () => {
  expect(airportCandidates('Moscow')).toEqual(['DME', 'SVO', 'VKO'])
  expect(airportCandidates('London')).toEqual(['LGW', 'LHR', 'LTN', 'STN'])
  expect(airportCandidates('JFK')).toEqual(['JFK'])
  expect(airportCandidates('Rostov-on-Don')).toEqual(['ROV'])
  expect(airportCandidates('Atlantis')).toEqual([])
  expect(airportCandidates('Moscow').length).toBeLessThanOrEqual(6)
})

it('does not demand review for a catalog or year gap alone and keeps the written name as a hint', async () => {
  const result = await extractFlights({} as Env, { type: 'text', content: [
    '2015-05-21 | ROV → Moscow | S7 Airlines S7 123',
    '2024-03-20 | Los Angeles to Atlantis | Delta Air Lines DL 1',
    'Undated | TBS → IST | TK379',
    '2015-05-21 | ROV → Moscow | S7 Airlines S7 123 [email says Sunday]',
  ].join('\n') })
  const [moscow, atlantis, undated, noted] = result.flights
  expect(moscow).toMatchObject({ origin: 'ROV', destination: '', destination_hint: 'Moscow', review_required: false, confidence: 1 })
  expect(moscow.origin_hint).toBeUndefined()
  expect(moscow.field_confidence).toMatchObject({ destination: 0 })
  expect(rowOf(moscow).selected).toBe(false)
  expect(atlantis).toMatchObject({ origin: 'LAX', destination: '', destination_hint: 'Atlantis', review_required: false })
  expect(undated).toMatchObject({ date: '', origin: 'TBS', destination: 'IST', review_required: false, confidence: 1 })
  expect(rowOf(undated).selected).toBe(false)
  expect(noted).toMatchObject({ review_required: true, confidence: 0.5 })
})

it('keeps a month and day only for an undated row with a real calendar day', () => {
  const row = (extra: Record<string, unknown>) => ({ date: '', origin: 'SVO', destination: 'LED', airline_iata: 'SU', confidence: 0.6,
    field_confidence: { date_year_explicit: false }, ...extra })
  const kept = (extra: Record<string, unknown>) => normalizeFlights({ flights: [row(extra)] as never }).flights[0].date_month_day
  expect(kept({ date_month_day: '03-25' })).toBe('03-25')
  expect(kept({ date_month_day: '02-29' })).toBe('02-29')
  for (const bad of ['02-30', '13-01', '00-10', '04-31', '3-25', '03-25x', '', 325, null]) expect(kept({ date_month_day: bad })).toBeUndefined()
  // A confirmed full date wins over a stray month and day.
  const dated = normalizeFlights({ flights: [row({ date: '2026-03-25', date_month_day: '03-25', field_confidence: { date_year_explicit: true } })] as never }).flights[0]
  expect(dated.date).toBe('2026-03-25')
  expect(dated.date_month_day).toBeUndefined()
})

it('keeps a trimmed, bounded name hint only for an empty endpoint', () => {
  const [open, filled] = normalizeFlights({ flights: [
    { date: '', origin: 'SVO', destination: '', destination_hint: `  Moscow${'x'.repeat(80)}  `, origin_hint: 'Sheremetyevo', airline_iata: 'SU', confidence: 0.5 },
    { date: '', origin: 'SVO', destination: 'LED', destination_hint: 'Saint Petersburg', airline_iata: 'SU', confidence: 0.5 },
  ] as never }).flights
  expect(open.destination_hint).toHaveLength(60)
  expect(open.destination_hint?.startsWith('Moscow')).toBe(true)
  expect(open.origin_hint).toBeUndefined()
  expect(filled.destination_hint).toBeUndefined()
})

it('persists the question metadata beside the draft fields without exceeding the stored size', () => {
  const [moscow] = normalizeFlights({ flights: [
    { date: '', date_month_day: '03-25', origin: 'ROV', destination: '', destination_hint: 'Moscow', airline_iata: 'SU', confidence: 0.4, review_required: true,
      field_confidence: { date_year_explicit: false } },
  ] as never }).flights
  const fields = draftFieldsOf(moscow)
  expect(fields).toMatchObject({ date: '', date_month_day: '03-25', origin: 'ROV', destination: '', destination_options: ['DME', 'SVO', 'VKO'], review_required: true })
  expect(fields.origin_options).toBeUndefined()
  expect(JSON.stringify(fields).length).toBeLessThan(600)
  // Absent when there is nothing to ask.
  const plain = draftFieldsOf({ date: '2026-03-25', date_month_day: '03-25', origin: 'JFK', destination: 'LHR', airline_iata: 'BA', confidence: 1, review_required: false,
    origin_hint: 'New York', destination_hint: 'London' })
  expect(Object.keys(plain).sort()).toEqual(['airline_iata', 'date', 'destination', 'origin'])
  // A hint that matches no catalog airport stores no options.
  expect(draftFieldsOf({ date: '', origin: '', destination: 'LHR', airline_iata: 'BA', confidence: 1, origin_hint: 'Atlantis' }).origin_options).toBeUndefined()
  // At most six options.
  expect(draftFieldsOf({ date: '', origin: '', destination: '', airline_iata: 'BA', confidence: 1, origin_hint: 'London' }).origin_options).toEqual(['LGW', 'LHR', 'LTN', 'STN'])
})
