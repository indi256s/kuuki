import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findAirport } from '@kuuki/data/airport-lookup'
import { advanceAuthGeneration, api, ApiError } from '@kuuki/client/apiClient'
import { calculateFlightDistance } from '@kuuki/client/geo'
import { formatDistanceKm } from '../../lib/format'
import {
  canUndo,
  draftsOf,
  editableValues,
  failureOutcome,
  mergeSavedFlight,
  previewChanges,
  previewConsequence,
  undoWrite,
  validateDrafts,
  writeFlightFields,
  type EditRecord,
  type FlightDto,
} from './flight-edits'
import type { JournalFlight } from './model'

vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('@kuuki/client/apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@kuuki/client/apiClient')>()),
  api: { patch: vi.fn() },
}))

const flight = (overrides: Partial<JournalFlight> = {}) =>
  ({
    id: 7,
    date: '2024-05-04',
    origin: 'TBS',
    destination: 'IST',
    airline_iata: 'TK',
    aircraft_icao: 'A321',
    flight_number: 'TK381',
    departure_time: '05:10',
    arrival_time: '06:50',
    departure_utc: null,
    arrival_utc: null,
    origin_tz: null,
    dest_tz: null,
    distance_km: 1350,
    duration_minutes: 160,
    duration_source: 'times',
    source: 'manual',
    lifecycle_state: 'logged',
    confirmation_source: 'save',
    origin_country: 'GE',
    destination_country: 'TR',
    ...overrides,
  }) as unknown as JournalFlight
const distanceBetween = (a: string, b: string) => {
  const from = findAirport(a)!,
    to = findAirport(b)!
  return calculateFlightDistance(from.latitude, from.longitude, to.latitude, to.longitude)
}

beforeEach(() => {
  vi.mocked(api.patch).mockReset()
})

describe('consequence preview', () => {
  it('forecasts the distance, the country and the recalculated duration of an airport change', () => {
    const km = distanceBetween('MUC', 'IST')
    expect(previewConsequence(flight(), 'origin', 'muc', 'en')).toBe(
      `Distance becomes ${formatDistanceKm('en', km)}, country changes to Germany, duration will be recalculated.`,
    )
    expect(previewConsequence(flight(), 'origin', 'MUC', 'ru')).toBe(
      `После сохранения: расстояние ${formatDistanceKm('ru', km)}, страна Германия, длительность пересчитается.`,
    )
    // Same country: only distance and duration.
    expect(previewConsequence(flight(), 'destination', 'AYT', 'en')).toBe(
      `Distance becomes ${formatDistanceKm('en', distanceBetween('TBS', 'AYT'))}, duration will be recalculated.`,
    )
  })

  it('says nothing for an unchanged, unknown or same-airport draft', () => {
    expect(previewConsequence(flight(), 'origin', 'TBS', 'en')).toBeNull()
    expect(previewConsequence(flight(), 'origin', 'ZZZ', 'en')).toBeNull()
    expect(previewConsequence(flight(), 'origin', 'IST', 'en')).toBeNull()
  })

  it('warns when a date change moves the lifecycle', () => {
    expect(previewConsequence(flight(), 'date', '2030-01-01', 'en', { today: '2026-10-09' })).toBe(
      'This flight becomes upcoming and loses its confirmation.',
    )
    expect(
      previewConsequence(flight({ lifecycle_state: 'upcoming' }), 'date', '2026-10-01', 'en', {
        today: '2026-10-09',
      }),
    ).toBe('This flight will wait for your confirmation.')
    expect(
      previewConsequence(flight(), 'date', '2024-05-05', 'en', { today: '2026-10-09' }),
    ).toBeNull()
  })

  it('forecasts a route with both ends changed from the new origin, and the date beside it', () => {
    expect(
      previewChanges(flight(), { origin: 'MUC', destination: 'AYT', date: '2030-01-01' }, 'en', {
        today: '2026-10-09',
      }),
    ).toEqual([
      `Distance becomes ${formatDistanceKm('en', distanceBetween('MUC', 'AYT'))}, duration will be recalculated.`,
      'This flight becomes upcoming and loses its confirmation.',
    ])
  })
})

describe('draft validation', () => {
  it('checks the changed drafts together with the full form rules', () => {
    const drafts = (changes: Partial<ReturnType<typeof draftsOf>>) => ({
      ...draftsOf(flight()),
      ...changes,
    })
    expect(validateDrafts(flight(), drafts({ destination: 'TBS' }), 'en')).toEqual({
      destination: 'Choose a different airport.',
    })
    // A changed origin that now equals the kept destination owns the same-airport message.
    expect(validateDrafts(flight(), drafts({ origin: 'IST' }), 'en')).toEqual({
      origin: 'Choose a different airport.',
    })
    expect(validateDrafts(flight(), drafts({ departure_time: '25:00', date: '' }), 'ru')).toEqual({
      departure_time: 'Формат ЧЧ:ММ, например 14:30.',
      date: 'Выберите дату.',
    })
    expect(validateDrafts(flight(), drafts({ aircraft_icao: '' }), 'en')).toEqual({})
  })

  it('never blocks an edit on a legacy value the catalogue no longer knows', () => {
    const legacy = flight({ aircraft_icao: 'ZZZZ' })
    expect(validateDrafts(legacy, { ...draftsOf(legacy), flight_number: 'TK382' }, 'en')).toEqual(
      {},
    )
  })
})

describe('writes and outcomes', () => {
  const dto = (overrides: Partial<FlightDto> = {}) =>
    ({ ...flight(), derived_state: 'ready', revision: 3, ...overrides }) as unknown as FlightDto

  it('maps 4xx to rejected and 5xx, network failures and aborts to unknown', () => {
    expect(
      failureOutcome(new ApiError(400, 'origin airport does not exist', 'UNKNOWN_AIRPORT'), 'en'),
    ).toEqual({ status: 'rejected', message: 'Choose an airport from the list.' })
    expect(failureOutcome(new ApiError(409, 'changed', 'STATE_CONFLICT'), 'en')).toMatchObject({
      status: 'rejected',
      message: expect.stringContaining('changed somewhere else'),
    })
    expect(failureOutcome(new ApiError(503, 'unavailable'), 'en')).toMatchObject({
      status: 'unknown',
      message: expect.stringContaining('may or may not be saved'),
    })
    expect(failureOutcome(new TypeError('Failed to fetch'), 'en').status).toBe('unknown')
    expect(failureOutcome(new DOMException('Request timed out', 'AbortError'), 'en').status).toBe(
      'unknown',
    )
  })

  it('sends the changed fields together in one PATCH and returns the server row', async () => {
    vi.mocked(api.patch).mockResolvedValue(dto({ origin: 'MUC', aircraft_icao: null }))
    const result = await writeFlightFields(7, { origin: 'MUC', aircraft_icao: null }, 'en')
    expect(result.outcome).toEqual({ status: 'saved' })
    expect(result.flight?.origin).toBe('MUC')
    expect(api.patch).toHaveBeenCalledTimes(1)
    const [path, body] = vi.mocked(api.patch).mock.calls[0]
    expect(path).toBe('/api/flights/7')
    expect(
      Object.fromEntries(Object.entries(body as object).filter(([key]) => key !== 'timezone')),
    ).toEqual({ origin: 'MUC', aircraft_icao: null, offer_undo: true })
  })

  it('is unknown when the PATCH aborts, or when the answer does not carry every sent value', async () => {
    vi.mocked(api.patch).mockRejectedValue(new DOMException('Session changed', 'AbortError'))
    expect((await writeFlightFields(7, { origin: 'MUC' }, 'en')).outcome.status).toBe('unknown')
    vi.mocked(api.patch).mockResolvedValue(dto({ origin: 'MUC', flight_number: 'TK381' }))
    expect(
      (await writeFlightFields(7, { origin: 'MUC', flight_number: 'TK382' }, 'en')).outcome.status,
    ).toBe('unknown')
  })

  it('drops an answer that arrives after the session changed', async () => {
    vi.mocked(api.patch).mockImplementation(async () => {
      advanceAuthGeneration()
      return dto({ origin: 'MUC' })
    })
    const result = await writeFlightFields(7, { origin: 'MUC' }, 'en')
    expect(result.outcome.status).toBe('unknown')
    expect(result.flight).toBeUndefined()
  })

  it('undo sends the snapshot token and accepts the server previous value when the cached previous value was stale', async () => {
    vi.mocked(api.patch).mockResolvedValue(dto({ aircraft_icao: 'B738' }))
    const record: EditRecord = {
      flightId: 7,
      fields: ['aircraft_icao'],
      after: editableValues(flight({ aircraft_icao: 'A320' })),
      seq: 1,
      undoToken: 'signed-snapshot',
    }
    const result = await undoWrite(record, 'en')
    expect(result.outcome).toEqual({ status: 'saved' })
    expect(result.flight?.aircraft_icao).toBe('B738')
    const [path, body] = vi.mocked(api.patch).mock.calls[0]
    expect(path).toBe('/api/flights/7')
    expect(body).toMatchObject({ undo_token: 'signed-snapshot' })
    expect(Object.keys(body as object).filter((key) => key !== 'timezone')).toEqual(['undo_token'])
  })

  it('refuses Undo once the flight changed again or a later edit was recorded', () => {
    const saved = flight({ origin: 'MUC' })
    const record: EditRecord = {
      flightId: 7,
      fields: ['origin'],
      after: editableValues(saved),
      seq: 1,
      undoToken: 'signed-snapshot',
    }
    expect(canUndo(record, saved, 1)).toBe(true)
    expect(canUndo(record, flight({ origin: 'MUC', flight_number: 'TK1' }), 1)).toBe(false)
    expect(canUndo(record, saved, 2)).toBe(false)
    expect(canUndo(record, undefined, 1)).toBe(false)
  })

  it('merges the server row, keeping an unchanged endpoint country and taking a changed one from the catalogue', () => {
    const merged = mergeSavedFlight(
      flight(),
      dto({ origin: 'MUC', distance_km: 1580, derived_state: 'pending' }),
    )
    expect(merged).toMatchObject({
      origin: 'MUC',
      distance_km: 1580,
      origin_country: 'DE',
      destination_country: 'TR',
    })
    expect('derived_state' in merged).toBe(false)
  })
})
