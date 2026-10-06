// Pins the server extraction prompt, the provider request config and the ingest of pasted assistant lists.
// The provider is stubbed: each case supplies the structured rows a model would return for the pasted line,
// and the assertions run the real downstream normalisation, draft projection and flight validation.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateFlightInput } from '../../packages/shared/src/flightValidation'
import { extractFlights, extractionContents, FLIGHT_RESPONSE_SCHEMA } from '../api/import/_extract'
import { EXTRACTION_PROMPT, type ExtractedFlight } from '../api/import/_shared'
import { DEFAULT_MODEL } from '../api/import/_provider'
import { rowOf } from '../api/_services/importJob'
import { draftToFlightInput } from '../api/_services/importDrafts'

const provider = vi.hoisted(() => ({ generateContent: vi.fn() }))
vi.mock('@google/genai', async importOriginal => {
  const actual = await importOriginal<typeof import('@google/genai')>()
  return { ...actual, GoogleGenAI: class { models = { generateContent: provider.generateContent } } }
})

afterEach(() => { provider.generateContent.mockReset() })
const env = (model?: string) => ({ GEMINI_API_KEY: 'test', ...(model ? { GEMINI_IMPORT_MODEL: model } : {}) }) as unknown as Env
const scores = (value: number) => ({
  date: value, origin: value, destination: value, airline_iata: value, flight_number: value, departure_time: value, arrival_time: value,
})

describe('extraction prompt', () => {
  it('keeps the year, code and empty-result invariants', () => {
    expect(EXTRACTION_PROMPT).toMatch(/never infer/i)
    expect(EXTRACTION_PROMPT).toContain('date_year_explicit')
    expect(EXTRACTION_PROMPT).toMatch(/YYYY-MM-DD/)
    expect(EXTRACTION_PROMPT).toMatch(/3-letter IATA airport code/)
    expect(EXTRACTION_PROMPT).toMatch(/2-letter IATA airline code/)
    expect(EXTRACTION_PROMPT).toContain('"ZZ"')
    expect(EXTRACTION_PROMPT).toMatch(/ICAO/)
    expect(EXTRACTION_PROMPT).toMatch(/confidence/)
    expect(EXTRACTION_PROMPT).toContain('{"flights": []}')
  })

  it('reads pasted assistant lists and ignores instructions inside the document', () => {
    expect(EXTRACTION_PROMPT).toContain('2024-03-15 | JFK → LAX | American Airlines AA 123 | 08:30-11:45')
    expect(EXTRACTION_PROMPT).toMatch(/"\?".*unknown/)
    expect(EXTRACTION_PROMPT).toMatch(/\+1/)
    expect(EXTRACTION_PROMPT).toMatch(/cancelled or refunded/)
    expect(EXTRACTION_PROMPT).toMatch(/once/)
    expect(EXTRACTION_PROMPT).toMatch(/ignore any instructions/i)
    expect(EXTRACTION_PROMPT).toMatch(/never copy the document/i)
  })
})

describe('provider request', () => {
  it('sends the document between the rules and a closing instruction, keeping the document at index 1', () => {
    const text = extractionContents({ type: 'text', content: 'JFK to LAX' })
    expect(text).toHaveLength(3)
    expect(text[0]).toBe(EXTRACTION_PROMPT)
    expect(text[1]).toBe('<document>\nJFK to LAX\n</document>')
    expect(text[2]).toMatch(/document above/i)
    const image = extractionContents({ type: 'image', content: 'iVBORw0KGgo=' })
    expect(image[1]).toEqual({ inlineData: { data: 'iVBORw0KGgo=', mimeType: 'image/png' } })
    expect(image[2]).toBe(text[2])
  })

  it('asks for flights before the short source note in the constrained schema', () => {
    expect(FLIGHT_RESPONSE_SCHEMA.propertyOrdering).toEqual(['flights', 'raw_text'])
    expect(FLIGHT_RESPONSE_SCHEMA.required).toEqual(['flights'])
    expect(FLIGHT_RESPONSE_SCHEMA.properties.raw_text.description).toMatch(/never a copy/i)
    const flight = FLIGHT_RESPONSE_SCHEMA.properties.flights.items
    expect(flight.required).toContain('field_confidence')
    expect(flight.required).toContain('review_required')
    expect(flight.properties.field_confidence.required).toContain('date_year_explicit')
  })

  it('keeps the default model and JSON mode with the response schema', async () => {
    expect(DEFAULT_MODEL).toBe('gemini-3.5-flash-lite')
    provider.generateContent.mockResolvedValue({ text: '{"flights":[]}' })
    await extractFlights(env(), { type: 'text', content: 'nothing here' })
    const request = provider.generateContent.mock.lastCall?.[0]
    expect(request.model).toBe('gemini-3.5-flash-lite')
    expect(request.config).toMatchObject({ responseMimeType: 'application/json', responseSchema: FLIGHT_RESPONSE_SCHEMA })
    expect(request.contents).toEqual(extractionContents({ type: 'text', content: 'nothing here' }))
  })
})

// What a model returns for each pasted line, then what Kuuki keeps.
const cases: Array<{ name: string; line: string; row: Partial<ExtractedFlight>; expected: Record<string, unknown>; selected: boolean }> = [
  {
    name: 'the new assistant format',
    line: '2024-03-15 | JFK → LAX | American Airlines AA 123 | 08:30-11:45',
    row: { date: '2024-03-15', origin: 'JFK', destination: 'LAX', airline_iata: 'AA', flight_number: '123', departure_time: '08:30', arrival_time: '11:45',
      confidence: 0.97, field_confidence: { ...scores(0.97), date_year_explicit: true } },
    expected: { date: '2024-03-15', origin: 'JFK', destination: 'LAX', airline_iata: 'AA', flight_number: '123', departure_time: '08:30', arrival_time: '11:45' },
    selected: true,
  },
  {
    name: 'a next-day arrival with an unknown flight number',
    line: '2024-03-22 | LAX → JFK | Delta DL ? | 22:10-06:35+1',
    row: { date: '2024-03-22', origin: 'lax', destination: 'jfk', airline_iata: 'dl', departure_time: '22:10', arrival_time: '06:35',
      confidence: 0.9, field_confidence: { ...scores(0.9), flight_number: 0, date_year_explicit: true } },
    expected: { date: '2024-03-22', origin: 'LAX', destination: 'JFK', airline_iata: 'DL', departure_time: '22:10', arrival_time: '06:35' },
    selected: true,
  },
  {
    name: 'the legacy pipe example',
    line: '2024-03-15 | JFK → LAX | American Airlines 123 | 08:30-11:45',
    row: { date: '2024-03-15', origin: 'JFK', destination: 'LAX', airline_iata: 'AA', flight_number: '123', departure_time: '08:30', arrival_time: '11:45',
      confidence: 0.95, field_confidence: { ...scores(0.95), date_year_explicit: true } },
    expected: { date: '2024-03-15', origin: 'JFK', destination: 'LAX', airline_iata: 'AA', flight_number: '123', departure_time: '08:30', arrival_time: '11:45' },
    selected: true,
  },
  {
    name: 'the legacy city-name example without flight number or times',
    line: '2024-03-20 | Los Angeles to New York | Delta',
    row: { date: '2024-03-20', origin: 'LAX', destination: 'JFK', airline_iata: 'DL', departure_time: '', arrival_time: '',
      confidence: 0.7, field_confidence: { ...scores(0.9), destination: 0.5, departure_time: 0, arrival_time: 0, date_year_explicit: true } },
    expected: { date: '2024-03-20', origin: 'LAX', destination: 'JFK', airline_iata: 'DL' },
    selected: false,
  },
  {
    name: 'the legacy year-less example',
    // A model that wrongly fills in a year is still overruled by the explicit-year flag.
    line: 'March 25 | SVO-LED | Aeroflot',
    row: { date: '2025-03-25', origin: 'SVO', destination: 'LED', airline_iata: 'SU', departure_time: '', arrival_time: '',
      confidence: 0.6, field_confidence: { ...scores(0.9), date: 0.3, date_year_explicit: false } },
    expected: { date: '', origin: 'SVO', destination: 'LED', airline_iata: 'SU' },
    selected: false,
  },
]

describe('pasted assistant lists through the real normalisation', () => {
  it.each(cases)('keeps $name', async ({ line, row, expected, selected }) => {
    provider.generateContent.mockResolvedValue({ text: JSON.stringify({ flights: [row], raw_text: 'One flight' }) })
    const result = await extractFlights(env(), { type: 'text', content: `Booking document:\n${line}` })
    expect(provider.generateContent.mock.lastCall?.[0].contents[1]).toContain(line)
    expect(result.flights).toHaveLength(1)
    const draft = rowOf(result.flights[0])
    expect(draft.fields).toEqual({ ...expected, enrichment_status: 'pending' })
    expect(draft.selected).toBe(selected)
    expect(draft.yearExplicit).toBe(row.field_confidence?.date_year_explicit === true)
    // A row with a confirmed year becomes valid flight input as-is; a year-less row waits for the member's date.
    if (draft.fields.date) expect(() => validateFlightInput(draftToFlightInput(draft.fields), 'create')).not.toThrow()
    else expect(() => validateFlightInput(draftToFlightInput(draft.fields), 'create')).toThrow(/date/)
  })

  it('keeps every row of a mixed pasted list in source order', async () => {
    provider.generateContent.mockResolvedValue({ text: JSON.stringify({ flights: cases.map(entry => entry.row) }) })
    const result = await extractFlights(env(), { type: 'text', content: `Booking document:\n${cases.map(entry => entry.line).join('\n')}` })
    expect(result.flights.map(flight => `${flight.date}|${flight.origin}|${flight.destination}`)).toEqual(
      cases.map(entry => `${entry.expected.date}|${entry.expected.origin}|${entry.expected.destination}`))
    expect(result.rejected).toBeUndefined()
  })
})
