import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import { ApiError } from '@google/genai'
import { onRequestPost as parseImport } from '../api/import/parse'
import { onRequestPost as enrichAircraft } from '../api/enrich/aircraft'
import { decodedBase64Size } from '../api/import/_body'
import { validateImportSource } from '../api/import/_extract'
import { createApiDatabase, csrfRequest, testOrigin as origin } from './harness'

const provider = vi.hoisted(() => ({ generateContent: vi.fn() }))
vi.mock('@google/genai', async importOriginal => {
  const actual = await importOriginal<typeof import('@google/genai')>()
  return {
    ...actual,
    GoogleGenAI: class {
      models = { generateContent: provider.generateContent }
    },
  }
})

let api: Awaited<ReturnType<typeof createApiDatabase>>
beforeAll(async () => { api = await createApiDatabase() })
afterAll(async () => { await api.dispose() })

function context(path: string, body: BodyInit, userId = 'u1') {
  const request = csrfRequest(path, 'POST', body)
  return {
    request,
    env: { GEMINI_API_KEY: 'test', PAGES_ORIGIN: origin, DB: api.db },
    data: { user: { id: userId, email: `${userId}@example.test` } },
    params: {},
    waitUntil() {},
  } as never
}

afterEach(() => { provider.generateContent.mockReset() })

it('validates a 10 MiB base64 boundary without a repeating-group regex', () => {
  const content = 'A'.repeat(13_981_012) + 'AA=='
  expect(decodedBase64Size(content)).toBe(10 * 1024 * 1024)
  expect(() => decodedBase64Size(content.slice(0, -4) + 'AB==')).toThrow('Invalid file encoding')
})

it.each([
  ['import parse', parseImport, '/api/import/parse', 14 * 1024 * 1024 + 1, 'flights'],
  ['enrichment', enrichAircraft, '/api/enrich/aircraft', 50_001, 'results'],
] as const)('rejects a chunked oversized %s body before contacting the provider, without trusting Content-Length', async (_label, handler, path, size, emptyKey) => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(size))
      controller.close()
    },
  })
  const response = await handler(context(path, stream))
  expect(response.status).toBe(413)
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin)
  expect(await response.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE', [emptyKey]: [] })
  expect(provider.generateContent).not.toHaveBeenCalled()
})

it('rate-limits parse per user in D1 and keeps the CORS error shape', async () => {
  provider.generateContent.mockResolvedValue({ text: '{"flights":[]}' })
  const body = JSON.stringify({ type: 'text', content: 'Flight details' })
  for (let i = 0; i < 20; i++) expect((await parseImport(context('/api/import/parse', body, 'u-limit'))).status).toBe(200)
  const response = await parseImport(context('/api/import/parse', body, 'u-limit'))
  expect(response.status).toBe(429)
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin)
  expect(await response.json()).toMatchObject({ code: 'RATE_LIMITED', flights: [] })
  expect(provider.generateContent).toHaveBeenCalledTimes(20)
})

it('uses one configured model call and leaves an unknown year for review', async () => {
  provider.generateContent.mockResolvedValue({
    text: JSON.stringify({
      flights: [{
        date: '2025-03-15', origin: 'AAA', destination: 'BBB',
        airline_iata: 'ZZ', confidence: 0.9,
        field_confidence: { date_year_explicit: false },
      }],
    }),
  })
  const response = await parseImport(context(
    '/api/import/parse',
    JSON.stringify({ type: 'text', content: '15 March AAA to BBB' }),
  ))
  expect(response.status).toBe(200)
  const result = await response.json() as { flights: Array<{ date: string; field_confidence: { date_year_explicit: boolean } }> }
  expect(result.flights[0].date).toBe('')
  expect(result.flights[0].field_confidence.date_year_explicit).toBe(false)
  expect(provider.generateContent).toHaveBeenCalledTimes(1)
})

it('projects provider flight fields and rejection reasons without echoing arbitrary data', async () => {
  provider.generateContent.mockResolvedValue({ text: JSON.stringify({ flights: [
    {
      date: '2025-03-15', origin: 'AAA', destination: 'BBB', airline_iata: 'ZZ',
      confidence: 0.9, secret: 'private-provider-data',
      field_confidence: { date_year_explicit: true, secret: 'private-provider-data' },
    },
    { origin: 'private-provider-data', destination: 'BBB', airline_iata: 'ZZ' },
  ] }) })
  const response = await parseImport(context('/api/import/parse', JSON.stringify({ type: 'text', content: 'Flight details' })))
  expect(response.status).toBe(200)
  const result = await response.json() as { flights: Array<Record<string, unknown>>; rejected: Array<{ reason: string }> }
  expect(result.flights[0]).not.toHaveProperty('secret')
  expect(result.flights[0].field_confidence).not.toHaveProperty('secret')
  expect(JSON.stringify(result.rejected)).not.toContain('private-provider-data')
})

it('sends PDF and PNG bytes as the matching inline media types', async () => {
  provider.generateContent.mockResolvedValue({ text: '{"flights":[]}' })
  for (const [type, content, mime] of [
    ['pdf', 'JVBERi0x', 'application/pdf'],
    ['image', 'iVBORw0KGgo=', 'image/png'],
  ]) {
    const response = await parseImport(context(
      '/api/import/parse',
      JSON.stringify({ type, content }),
    ))
    expect(response.status).toBe(200)
    const parts = provider.generateContent.mock.lastCall?.[0].contents
    expect(parts[1].inlineData.mimeType).toBe(mime)
  }
  expect(provider.generateContent).toHaveBeenCalledTimes(2)
})

it.each([
  [new ApiError({ status: 404, message: 'model missing' }), 502, 'MODEL_UNAVAILABLE'],
  [new ApiError({ status: 429, message: 'quota exceeded' }), 503, 'PROVIDER_QUOTA'],
  [new Error('request timed out'), 504, 'PROVIDER_TIMEOUT'],
])('returns an error for provider failures', async (failure, status, code) => {
  provider.generateContent.mockRejectedValue(failure)
  const response = await parseImport(context(
    '/api/import/parse',
    JSON.stringify({ type: 'text', content: 'Flight details' }),
  ))
  expect(response.status).toBe(status)
  expect(await response.json()).toMatchObject({ code, flights: [] })
})

it.each([
  ['enrichment', enrichAircraft, '/api/enrich/aircraft', { flights: [{ id: 'f1', date: '2025-01-01', origin: 'AAA', destination: 'BBB' }] }, '{bad-json', 'results'],
  ['structured import', parseImport, '/api/import/parse', { type: 'text', content: 'Flight details' }, 'not-json', 'flights'],
] as const)('surfaces malformed %s provider JSON as an error, not an empty success', async (_label, handler, path, body, text, emptyKey) => {
  provider.generateContent.mockResolvedValue({ text })
  const response = await handler(context(path, JSON.stringify(body)))
  expect(response.status).toBe(502)
  expect(await response.json()).toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE', [emptyKey]: [] })
})

it.each([
  ['an unknown type', { type: 'video', content: 'x' }, 400, 'INVALID_SOURCE_TYPE'],
  ['a missing type', { content: 'x' }, 400, 'INVALID_SOURCE_TYPE'],
  ['empty content', { type: 'text', content: '' }, 400, 'INVALID_BODY'],
  ['non-string content', { type: 'text', content: 7 }, 400, 'INVALID_BODY'],
  ['a malformed file encoding', { type: 'pdf', content: 'not-base64' }, 400, 'INVALID_BODY'],
  ['a file over 10 MB', { type: 'pdf', content: 'A'.repeat(14_000_000) }, 413, 'PAYLOAD_TOO_LARGE'],
  ['text over 100,000 characters', { type: 'text', content: 'x'.repeat(100_001) }, 400, 'TEXT_TOO_LONG'],
])('refuses %s with a specific code', (_name, body, status, code) => {
  expect(() => validateImportSource(body as never)).toThrow(expect.objectContaining({ status, code }))
})

it('emits one validation summary per extraction and per-row logs only for rejected rows', async () => {
  provider.generateContent.mockResolvedValue({ text: JSON.stringify({ flights: [
    { origin: 'LHR', destination: 'JFK', airline_iata: 'BA', date: '2025-01-01' },
    { origin: 'JFK', destination: 'LHR', airline_iata: 'BA', date: '2025-01-02' },
    { origin: 'X', destination: 'LHR', airline_iata: 'BA', date: '2025-01-03' },
  ] }) })
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  try {
    expect((await parseImport(context('/api/import/parse', JSON.stringify({ type: 'text', content: 'Flight details' })))).status).toBe(200)
    const events = log.mock.calls.map(([line]) => JSON.parse(String(line)) as { event: string })
    expect(events.filter(entry => entry.event === 'validation_complete')).toEqual([{ event: 'validation_complete', valid: 2, total: 3, rejected: 1 }])
    expect(events.filter(entry => entry.event === 'flight_rejected')).toHaveLength(1)
  } finally { log.mockRestore() }
})

it('logs exactly one compact summary when every extracted row is rejected, without source content', async () => {
  provider.generateContent.mockResolvedValue({ text: JSON.stringify({ flights: [
    { origin: 'PRIVATE-canary', destination: 'LHR', airline_iata: 'BA' }, null,
  ], raw_text: 'PRIVATE-canary' }) })
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  try {
    const response = await parseImport(context('/api/import/parse', JSON.stringify({ type: 'text', content: 'PRIVATE-canary' })))
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE' })
    const events = log.mock.calls.map(([line]) => JSON.parse(String(line)) as { event: string })
    expect(events.filter(entry => entry.event === 'validation_complete')).toEqual([{ event: 'validation_complete', valid: 0, total: 2, rejected: 2 }])
    expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE-canary')
  } finally { log.mockRestore() }
})

it.each([
  { status: 'INVALID_ARGUMENT' },
  { status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID', domain: 'googleapis.com' }] },
  { status: 'PERMISSION_DENIED', details: [{ reason: 'LOCATION_POLICY_VIOLATED', domain: 'googleapis.com' }] },
  { status: 'INVALID_ARGUMENT', details: [{ reason: 'UNKNOWN_REASON' }] },
])('keeps ambiguous or configuration SDK error envelopes generic without disclosing payloads: %j', async error => {
  provider.generateContent.mockRejectedValue(new ApiError({ status: 400, message: JSON.stringify({ error: { ...error, message: 'PRIVATE-provider-canary' } }) }))
  const response = await parseImport(context('/api/import/parse', JSON.stringify({ type: 'pdf', content: 'JVBERi0x' })))
  const body = await response.json()
  expect(body).toMatchObject({ code: 'PROVIDER_ERROR', flights: [] })
  expect(JSON.stringify(body)).not.toContain('PRIVATE-provider-canary')
})
