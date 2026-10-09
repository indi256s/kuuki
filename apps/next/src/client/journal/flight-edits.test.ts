import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findAirport } from '@kuuki/data/airport-lookup'
import { advanceAuthGeneration, api, ApiError } from '@kuuki/client/apiClient'
import { calculateFlightDistance } from '@kuuki/client/geo'
import { formatDistanceKm } from '../../lib/format'
import { canUndo, editableValues, failureOutcome, mergeSavedFlight, previewConsequence, undoWrite, validateDraft, writeFlightField, type EditRecord, type FlightDto } from './flight-edits'
import type { JournalFlight } from './model'

vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))
vi.mock('@kuuki/client/apiClient', async importOriginal => ({ ...(await importOriginal<typeof import('@kuuki/client/apiClient')>()), api: { patch: vi.fn() } }))

const flight = (overrides: Partial<JournalFlight> = {}) => ({
  id: 7, date: '2024-05-04', origin: 'TBS', destination: 'IST', airline_iata: 'TK', aircraft_icao: 'A321', flight_number: 'TK381',
  departure_time: '05:10', arrival_time: '06:50', departure_utc: null, arrival_utc: null, origin_tz: null, dest_tz: null, distance_km: 1350, duration_minutes: 160,
  duration_source: 'times', source: 'manual', lifecycle_state: 'logged', confirmation_source: 'save', origin_country: 'GE', destination_country: 'TR', ...overrides,
}) as unknown as JournalFlight
const distanceBetween = (a: string, b: string) => { const from = findAirport(a)!, to = findAirport(b)!; return calculateFlightDistance(from.latitude, from.longitude, to.latitude, to.longitude) }

beforeEach(() => { vi.mocked(api.patch).mockReset() })

describe('consequence preview', () => {
  it('forecasts the distance, the country and the recalculated duration of an airport change', () => {
    const km = distanceBetween('MUC', 'IST')
    expect(previewConsequence(flight(), 'origin', 'muc', 'en')).toBe(`Distance becomes ${formatDistanceKm('en', km)}, country changes to Germany, duration will be recalculated.`)
    expect(previewConsequence(flight(), 'origin', 'MUC', 'ru')).toBe(`После сохранения: расстояние ${formatDistanceKm('ru', km)}, страна Германия, длительность пересчитается.`)
    // Same country: only distance and duration.
    expect(previewConsequence(flight(), 'destination', 'AYT', 'en')).toBe(`Distance becomes ${formatDistanceKm('en', distanceBetween('TBS', 'AYT'))}, duration will be recalculated.`)
  })

  it('says nothing for an unchanged, unknown or same-airport draft', () => {
    expect(previewConsequence(flight(), 'origin', 'TBS', 'en')).toBeNull()
    expect(previewConsequence(flight(), 'origin', 'ZZZ', 'en')).toBeNull()
    expect(previewConsequence(flight(), 'origin', 'IST', 'en')).toBeNull()
  })

  it('warns when a date change moves the lifecycle', () => {
    expect(previewConsequence(flight(), 'date', '2030-01-01', 'en', { today: '2026-10-09' })).toBe('This flight becomes upcoming and loses its confirmation.')
    expect(previewConsequence(flight({ lifecycle_state: 'upcoming' }), 'date', '2026-10-01', 'en', { today: '2026-10-09' })).toBe('This flight will wait for your confirmation.')
    expect(previewConsequence(flight(), 'date', '2024-05-05', 'en', { today: '2026-10-09' })).toBeNull()
  })
})

describe('draft validation', () => {
  it('uses the full form rules for the edited field only', () => {
    expect(validateDraft(flight(), 'destination', 'TBS', 'en')).toBe('Choose a different airport.')
    expect(validateDraft(flight(), 'origin', 'IST', 'en')).toBe('Choose a different airport.')
    expect(validateDraft(flight(), 'departure_time', '25:00', 'en')).toBe('Use HH:MM, for example 14:30.')
    expect(validateDraft(flight(), 'aircraft_icao', '', 'en')).toBeNull()
    expect(validateDraft(flight(), 'date', '', 'ru')).toBe('Введите дату.')
  })
})

describe('writes and outcomes', () => {
  const dto = (overrides: Partial<FlightDto> = {}) => ({ ...flight(), derived_state: 'ready', revision: 3, ...overrides }) as unknown as FlightDto

  it('maps 4xx to rejected and 5xx, network failures and aborts to unknown', () => {
    expect(failureOutcome(new ApiError(400, 'origin airport does not exist', 'UNKNOWN_AIRPORT'), 'en')).toEqual({ status: 'rejected', message: 'Choose an airport from the list.' })
    expect(failureOutcome(new ApiError(409, 'changed', 'STATE_CONFLICT'), 'en')).toMatchObject({ status: 'rejected', message: expect.stringContaining('changed somewhere else') })
    expect(failureOutcome(new ApiError(503, 'unavailable'), 'en')).toMatchObject({ status: 'unknown', message: expect.stringContaining('may or may not be saved') })
    expect(failureOutcome(new TypeError('Failed to fetch'), 'en').status).toBe('unknown')
    expect(failureOutcome(new DOMException('Request timed out', 'AbortError'), 'en').status).toBe('unknown')
  })

  it('sends only the changed field and returns the server row', async () => {
    vi.mocked(api.patch).mockResolvedValue(dto({ origin: 'MUC' }))
    const result = await writeFlightField(7, 'origin', 'MUC', 'en')
    expect(result.outcome).toEqual({ status: 'saved' })
    expect(result.flight?.origin).toBe('MUC')
    const [path, body] = vi.mocked(api.patch).mock.calls[0]
    expect(path).toBe('/api/flights/7')
    expect(Object.keys(body as object).filter(key => key !== 'timezone')).toEqual(['origin', 'offer_undo'])
  })

  it('is unknown when the PATCH aborts, or when the answer does not carry the sent value', async () => {
    vi.mocked(api.patch).mockRejectedValue(new DOMException('Session changed', 'AbortError'))
    expect((await writeFlightField(7, 'origin', 'MUC', 'en')).outcome.status).toBe('unknown')
    vi.mocked(api.patch).mockResolvedValue(dto({ origin: 'TBS' }))
    expect((await writeFlightField(7, 'origin', 'MUC', 'en')).outcome.status).toBe('unknown')
  })

  it('drops an answer that arrives after the session changed', async () => {
    vi.mocked(api.patch).mockImplementation(async () => { advanceAuthGeneration(); return dto({ origin: 'MUC' }) })
    const result = await writeFlightField(7, 'origin', 'MUC', 'en')
    expect(result.outcome.status).toBe('unknown')
    expect(result.flight).toBeUndefined()
  })

  it('undo sends the server snapshot token instead of a replacement value', async () => {
    vi.mocked(api.patch).mockResolvedValue(dto({ origin: 'TBS' }))
    const record: EditRecord = { flightId: 7, field: 'origin', previous: 'TBS', after: editableValues(flight({ origin: 'MUC' })), seq: 1, undoToken: 'signed-snapshot' }
    expect((await undoWrite(record, 'en')).outcome).toEqual({ status: 'saved' })
    const [path, body] = vi.mocked(api.patch).mock.calls[0]
    expect(path).toBe('/api/flights/7')
    expect(body).toMatchObject({ undo_token: 'signed-snapshot' })
    expect(Object.keys(body as object).filter(key => key !== 'timezone')).toEqual(['undo_token'])
  })

  it('refuses Undo once the flight changed again or a later edit was recorded', () => {
    const saved = flight({ origin: 'MUC' })
    const record: EditRecord = { flightId: 7, field: 'origin', previous: 'TBS', after: editableValues(saved), seq: 1, undoToken: 'signed-snapshot' }
    expect(canUndo(record, saved, 1)).toBe(true)
    expect(canUndo(record, flight({ origin: 'MUC', flight_number: 'TK1' }), 1)).toBe(false)
    expect(canUndo(record, saved, 2)).toBe(false)
    expect(canUndo(record, undefined, 1)).toBe(false)
  })

  it('merges the server row, keeping an unchanged endpoint country and taking a changed one from the catalogue', () => {
    const merged = mergeSavedFlight(flight(), dto({ origin: 'MUC', distance_km: 1580, derived_state: 'pending' }))
    expect(merged).toMatchObject({ origin: 'MUC', distance_km: 1580, origin_country: 'DE', destination_country: 'TR' })
    expect('derived_state' in merged).toBe(false)
  })
})
