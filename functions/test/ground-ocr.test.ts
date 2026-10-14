import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import { ApiError } from '@google/genai'
import { onRequestPost as ocr } from '../api/ground-journeys/ocr'
import { count, createApiDatabase, csrfRequest, testOrigin as origin } from './harness'

const provider = vi.hoisted(() => ({ generateContent: vi.fn() }))
vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/genai')>()
  return {
    ...actual,
    GoogleGenAI: class {
      models = { generateContent: provider.generateContent }
    },
  }
})

let api: Awaited<ReturnType<typeof createApiDatabase>>
beforeAll(async () => {
  api = await createApiDatabase()
})
afterAll(async () => {
  await api.dispose()
})
afterEach(() => {
  provider.generateContent.mockReset()
})

const PATH = '/api/ground-journeys/ocr'
const b64 = (bytes: number[], pad = 0) =>
  Buffer.from([...bytes, ...Array(pad).fill(0)]).toString('base64')
const PDF = b64([...Buffer.from('%PDF-1.7\n')], 32)
const JPEG = b64([0xff, 0xd8, 0xff, 0xe0], 32)
const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 32)
const WEBP = b64([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')], 32)
const HEIC = b64([0, 0, 0, 0x18, ...Buffer.from('ftypheic')], 32)
const GIF = b64([...Buffer.from('GIF89a')], 32)
const ZIP = b64([0x50, 0x4b, 3, 4], 32)

function context(request: Request, userId: string | null = 'u1') {
  return {
    request,
    env: { GEMINI_API_KEY: 'test', PAGES_ORIGIN: origin, DB: api.db },
    data: { user: userId ? { id: userId, email: `${userId}@example.test` } : null },
    params: {},
    waitUntil() {},
  } as never
}
const post = (body: unknown, userId: string | null = 'u1') =>
  ocr(context(csrfRequest(PATH, 'POST', body), userId))

const row = (extra: Record<string, unknown> = {}) => ({
  from_station: 'Berlin Hbf',
  to_station: 'München Hbf',
  from_city: '',
  to_city: '',
  departure_year: 0,
  departure_month: 0,
  departure_day: 0,
  arrival_year: 0,
  arrival_month: 0,
  arrival_day: 0,
  departure_time: '',
  arrival_time: '',
  train_number: '',
  operator: '',
  uncertain: [],
  cancelled: null,
  other_passenger: null,
  ...extra,
})
const reply = (trains: unknown[], readable = true) =>
  provider.generateContent.mockResolvedValue({ text: JSON.stringify({ readable, trains }) })

it.each([
  ['pdf', PDF, 'application/pdf'],
  ['jpeg', JPEG, 'image/jpeg'],
  ['png', PNG, 'image/png'],
  ['webp', WEBP, 'image/webp'],
])(
  'detects %s by signature, even when the client declares another type',
  async (_n, content, mime) => {
    reply([row()])
    const response = await post({ type: 'pdf', content })
    expect(response.status).toBe(200)
    expect(provider.generateContent.mock.lastCall?.[0].contents[1].inlineData.mimeType).toBe(mime)
  },
)

it.each([
  ['HEIC', HEIC],
  ['GIF', GIF],
  ['zip', ZIP],
  ['unknown bytes', b64([1, 2, 3, 4], 32)],
])('rejects %s with UNSUPPORTED_FILE_TYPE and never defaults to JPEG', async (_n, content) => {
  const response = await post({ content })
  expect(response.status).toBe(415)
  expect(await response.json()).toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE', candidates: [] })
  expect(provider.generateContent).not.toHaveBeenCalled()
})

it('rejects a decoded file over 10 MiB before the provider and without spending quota', async () => {
  const content = 'A'.repeat(13_981_012) + 'AAAA'
  const before = await count(api.db, 'auth_rate_limits')
  const response = await post({ content }, 'u-big')
  expect(response.status).toBe(413)
  expect(await response.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' })
  expect(await count(api.db, 'auth_rate_limits')).toBe(before)
  expect(provider.generateContent).not.toHaveBeenCalled()
})

it('rejects a chunked request over 14 MiB without trusting Content-Length', async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(14 * 1024 * 1024 + 1))
      controller.close()
    },
  })
  const response = await ocr(context(csrfRequest(PATH, 'POST', stream)))
  expect(response.status).toBe(413)
  expect(await response.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE', candidates: [] })
  expect(provider.generateContent).not.toHaveBeenCalled()
})

it('reports undecodable content as UNREADABLE_FILE', async () => {
  const response = await post({ content: 'not base64!!' })
  expect(response.status).toBe(422)
  expect(await response.json()).toMatchObject({ code: 'UNREADABLE_FILE' })
  expect(provider.generateContent).not.toHaveBeenCalled()
})

it('returns two legs in document order with printed fields only', async () => {
  reply([
    row({
      from_station: 'Wien Hbf',
      to_station: 'Salzburg Hbf',
      departure_year: 2026,
      departure_month: 3,
      departure_day: 9,
      departure_time: '08:30',
      arrival_time: '11:05',
      train_number: 'RJ 63',
      operator: 'ÖBB',
      uncertain: ['operator', 'bogus'],
      cancelled: false,
    }),
    row({ from_station: 'Salzburg Hbf', to_station: 'München Hbf', from_city: 'Salzburg' }),
  ])
  const response = await post({ content: PDF })
  expect(response.status).toBe(200)
  const result = (await response.json()) as { candidates: Array<Record<string, unknown>> }
  expect(result).toEqual({
    candidates: [
      {
        fromStation: 'Wien Hbf',
        toStation: 'Salzburg Hbf',
        fromCity: null,
        toCity: null,
        departureDate: '2026-03-09',
        arrivalDate: null,
        departureTime: '08:30',
        arrivalTime: '11:05',
        trainNumber: 'RJ 63',
        operator: 'ÖBB',
        uncertain: ['operator'],
        cancelled: false,
        otherPassenger: null,
      },
      expect.objectContaining({ fromStation: 'Salzburg Hbf', fromCity: 'Salzburg' }),
    ],
    warnings: [],
  })
})

it('keeps a date without a printed year partial and never invents a year', async () => {
  reply([
    row({
      departure_month: 3,
      departure_day: 9,
      arrival_year: 2026,
      arrival_month: 2,
      arrival_day: 30,
    }),
  ])
  const { candidates } = (await (await post({ content: PNG })).json()) as {
    candidates: Array<{ departureDate: unknown; arrivalDate: unknown; uncertain: string[] }>
  }
  expect(candidates[0].departureDate).toEqual({ month: 3, day: 9 })
  expect(candidates[0].arrivalDate).toBeNull()
  expect(candidates[0].uncertain).toEqual(['arrivalDate'])
})

it('drops passenger, booking, payment and barcode data even when the model returns it', async () => {
  reply([
    row({
      passenger_name: 'SECRET-NAME',
      booking_code: 'SECRET-PNR',
      ticket_number: 'SECRET-TICKET',
      price: 'SECRET-PRICE',
      qr: 'SECRET-QR',
      raw_text: 'SECRET-EXCERPT',
    }),
  ])
  const response = await post({ content: JPEG })
  const body = await response.text()
  expect(response.status).toBe(200)
  expect(body).not.toContain('SECRET')
})

it('does not log the file, base64 or provider response', async () => {
  const logs = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error')]
  reply([row({ from_station: 'SECRET-STATION' })])
  await post({ content: JPEG })
  const logged = JSON.stringify(logs.flatMap((spy) => spy.mock.calls))
  logs.forEach((spy) => spy.mockRestore())
  expect(logged).not.toContain('SECRET-STATION')
  expect(logged).not.toContain(JPEG)
})

it('reports a file with no train legs as NO_TRAINS_FOUND', async () => {
  reply([])
  const response = await post({ content: JPEG })
  expect(response.status).toBe(422)
  expect(await response.json()).toMatchObject({ code: 'NO_TRAINS_FOUND', candidates: [] })
})

it('reports an unreadable document from the model as UNREADABLE_FILE', async () => {
  reply([], false)
  const response = await post({ content: JPEG })
  expect(response.status).toBe(422)
  expect(await response.json()).toMatchObject({ code: 'UNREADABLE_FILE' })
})

it('warns about rows with nothing to review instead of dropping them silently', async () => {
  reply([row(), row({ from_station: '', to_station: '' })])
  const result = (await (await post({ content: JPEG })).json()) as {
    candidates: unknown[]
    warnings: unknown[]
  }
  expect(result.candidates).toHaveLength(1)
  expect(result.warnings).toEqual([{ code: 'ROWS_DROPPED', count: 1 }])
})

it('flags more than 100 candidates explicitly instead of truncating', async () => {
  reply(Array.from({ length: 101 }, (_, i) => row({ train_number: String(i) })))
  const response = await post({ content: JPEG })
  expect(response.status).toBe(422)
  expect(await response.json()).toMatchObject({
    code: 'TOO_MANY_CANDIDATES',
    limit: 100,
    found: 101,
    candidates: [],
  })
})

it('accepts exactly 100 candidates', async () => {
  reply(Array.from({ length: 100 }, (_, i) => row({ train_number: String(i) })))
  const result = (await (await post({ content: JPEG })).json()) as { candidates: unknown[] }
  expect(result.candidates).toHaveLength(100)
})

it.each([
  [new ApiError({ status: 404, message: 'x' }), 502, 'MODEL_UNAVAILABLE'],
  [new ApiError({ status: 429, message: 'x' }), 503, 'PROVIDER_QUOTA'],
  [new Error('request timed out'), 504, 'PROVIDER_TIMEOUT'],
  [new Error('boom'), 502, 'PROVIDER_ERROR'],
])('maps provider failure %# to %s', async (failure, status, code) => {
  provider.generateContent.mockRejectedValue(failure)
  const response = await post({ content: JPEG })
  expect(response.status).toBe(status)
  expect(await response.json()).toMatchObject({ code, candidates: [] })
})

it('surfaces a malformed provider response as an error, not an empty success', async () => {
  provider.generateContent.mockResolvedValue({ text: '{bad' })
  const response = await post({ content: JPEG })
  expect(response.status).toBe(502)
  expect(await response.json()).toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE' })
})

it('counts every accepted file against the shared import quota, then refuses with RATE_LIMITED', async () => {
  reply([row()])
  for (let i = 0; i < 20; i++) expect((await post({ content: JPEG }, 'u-quota')).status).toBe(200)
  const response = await post({ content: JPEG }, 'u-quota')
  expect(response.status).toBe(429)
  expect(await response.json()).toMatchObject({ code: 'RATE_LIMITED', candidates: [] })
  expect(provider.generateContent).toHaveBeenCalledTimes(20)
  const key = await api.db
    .prepare('SELECT count FROM auth_rate_limits WHERE key = ?')
    .bind('import-parse:u-quota')
    .first<{ count: number }>()
  expect(key?.count).toBe(21)
})

it('requires a session', async () => {
  const response = await post({ content: JPEG }, null)
  expect(response.status).toBe(401)
  expect(provider.generateContent).not.toHaveBeenCalled()
})

it('requires the CSRF pair', async () => {
  const request = new Request(`${origin}${PATH}`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: JPEG }),
  })
  const response = await ocr(context(request))
  expect(response.status).toBe(403)
  expect(provider.generateContent).not.toHaveBeenCalled()
})

it('writes nothing to D1 beyond the quota counter', async () => {
  const tables = (
    await api.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'auth_rate_limits' AND name NOT LIKE 'd1_%'",
      )
      .all<{ name: string }>()
  ).results.map((t) => t.name)
  const snapshot = async () =>
    Promise.all(tables.map(async (table) => [table, await count(api.db, table)]))
  const before = await snapshot()
  reply([row(), row({ from_station: 'Hamburg Hbf' })])
  expect((await post({ content: PDF }, 'u-persist')).status).toBe(200)
  expect(await snapshot()).toEqual(before)
})
