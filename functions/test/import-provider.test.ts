import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '@google/genai'
import { onRequestPost as parseImport } from '../api/import/parse'
import { onRequestPost as enrichAircraft } from '../api/enrich/aircraft'
import { decodedBase64Size } from '../api/import/_body'

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

const origin = 'https://kuuki.test'
const kv = { get: async () => null, put: async () => undefined }

function context(path: string, body: BodyInit) {
  const request = new Request(`${origin}${path}`, {
    method: 'POST',
    headers: {
      Origin: origin,
      Cookie: 'kuuki_csrf=test-csrf',
      'X-CSRF-Token': 'test-csrf',
      'Content-Type': 'application/json',
    },
    body,
    ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  } as RequestInit & { duplex?: 'half' })
  return {
    request,
    env: { GEMINI_API_KEY: 'test', PAGES_ORIGIN: origin, IMPORT_JOBS: kv },
    data: { user: { id: 'u1', email: 'u1@example.test' } },
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

it('rejects a chunked oversized import body before contacting the provider', async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(14 * 1024 * 1024 + 1))
      controller.close()
    },
  })
  const response = await parseImport(context('/api/import/parse', stream))
  expect(response.status).toBe(413)
  expect(await response.json()).toMatchObject({ code: 'BODY_TOO_LARGE' })
  expect(provider.generateContent).not.toHaveBeenCalled()
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
  expect(provider.generateContent.mock.calls[0][0].model).toBe('gemini-3.5-flash-lite')
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

it('does not report malformed enrichment JSON as an empty success', async () => {
  provider.generateContent.mockResolvedValue({ text: '{bad-json' })
  const response = await enrichAircraft(context(
    '/api/enrich/aircraft',
    JSON.stringify({ flights: [{ id: 'f1', date: '2025-01-01', origin: 'AAA', destination: 'BBB' }] }),
  ))
  expect(response.status).toBe(502)
  expect(await response.json()).toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE', results: [] })
})

it('surfaces an unsupported structured import response as an error', async () => {
  provider.generateContent.mockResolvedValue({ text: 'not-json' })
  const response = await parseImport(context(
    '/api/import/parse',
    JSON.stringify({ type: 'text', content: 'Flight details' }),
  ))
  expect(response.status).toBe(502)
  expect(await response.json()).toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE', flights: [] })
})

it('enforces the enrichment byte cap without trusting Content-Length', async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(50_001))
      controller.close()
    },
  })
  const response = await enrichAircraft(context('/api/enrich/aircraft', stream))
  expect(response.status).toBe(413)
  expect(provider.generateContent).not.toHaveBeenCalled()
})
