import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import { onRequestPost } from '../api/enrich/aircraft'
import { createApiDatabase, csrfRequest, testOrigin } from './harness'

let api: Awaited<ReturnType<typeof createApiDatabase>>
beforeAll(async () => {
  api = await createApiDatabase()
})
afterAll(async () => {
  await api.dispose()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
const flight = {
  id: 'f1',
  date: '2025-01-01',
  origin: 'AAA',
  destination: 'BBB',
  airline_iata: 'BA',
  flight_number: '123',
}
const quote = 'BA123 AAA-BBB 2025-01-01 operated Boeing 737-800 N123AB.'
function context(overrides: Partial<typeof flight> = {}) {
  return {
    request: csrfRequest(
      '/api/enrich/aircraft',
      'POST',
      JSON.stringify({ flights: [{ ...flight, ...overrides }] }),
    ),
    env: {
      ENRICH_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'test',
      ANTHROPIC_WORKSPACE_ID: 'workspace-test',
      PAGES_ORIGIN: testOrigin,
      DB: api.db,
    },
    data: { user: { id: 'u1', email: 'u1@example.test' } },
    params: {},
    waitUntil() {},
  } as never
}
const usage = {
  input_tokens: 100,
  output_tokens: 50,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
  server_tool_use: { web_search_requests: 1 },
}
function research() {
  return {
    stop_reason: 'end_turn',
    usage,
    content: [
      {
        type: 'web_search_tool_result',
        tool_use_id: 'search-1',
        content: [
          {
            type: 'web_search_result',
            url: 'https://example.test/BA123/2025-01-01',
            title: 'Dated record',
            encrypted_content: 'opaque',
          },
        ],
      },
      {
        type: 'text',
        text: quote,
        citations: [
          {
            type: 'web_search_result_location',
            url: 'https://example.test/BA123/2025-01-01',
            title: 'Dated record',
            cited_text: quote,
          },
        ],
      },
    ],
  }
}
function extracted(overrides = {}) {
  return {
    stop_reason: 'end_turn',
    usage: { ...usage, server_tool_use: { web_search_requests: 0 } },
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          results: [
            {
              index: 1,
              icao: 'B738',
              confidence: 0.99,
              equipment_basis: 'actual',
              evidence_date: flight.date,
              evidence_origin: 'AAA',
              evidence_destination: 'BBB',
              evidence_flight: 'BA123',
              evidence: quote,
              evidence_quote: quote,
              source_ids: [0],
              registration: 'N123AB',
              ...overrides,
            },
          ],
        }),
      },
    ],
  }
}
function provider(
  second: Record<string, unknown> = extracted(),
  first: Record<string, unknown> = research(),
) {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(first))
    .mockResolvedValueOnce(Response.json(second))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

it('uses Haiku cited evidence without requiring a Gemini key', async () => {
  const fetcher = provider()
  const response = await onRequestPost(context())
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    results: [
      {
        aircraft_icao: 'B738',
        equipment_basis: 'actual',
        source: 'anthropic',
        sources: [{ url: 'https://example.test/BA123/2025-01-01' }],
      },
    ],
  })
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it.each([
  ['invented quote', { evidence_quote: 'The invented flight has an A380.' }],
  ['unretrieved source', { source_ids: [99] }],
  ['another date', { evidence_date: '2025-01-02' }],
])('leaves Haiku %s unknown', async (_label, overrides) => {
  provider(extracted(overrides))
  const response = await onRequestPost(context())
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ results: [{ aircraft_icao: null, confidence: 0 }] })
})

it('does not pay for extraction when research has no citations', async () => {
  const fetcher = provider(extracted(), { ...research(), content: [{ type: 'text', text: quote }] })
  const response = await onRequestPost(context())
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ results: [{ aircraft_icao: null }] })
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it.each(['pause_turn', 'max_tokens'])(
  'reports an incomplete Haiku %s without retry',
  async (stop_reason) => {
    const fetcher = provider(extracted(), { ...research(), stop_reason })
    const response = await onRequestPost(context())
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ code: 'PROVIDER_INCOMPLETE', results: [] })
    expect(fetcher).toHaveBeenCalledTimes(1)
  },
)

it('maps Haiku quota failure without exposing provider text', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ error: { message: 'secret provider content' } }, { status: 429 }),
    )
  vi.stubGlobal('fetch', fetcher)
  const response = await onRequestPost(context())
  expect(response.status).toBe(503)
  const body = await response.json()
  expect(body).toMatchObject({ code: 'PROVIDER_QUOTA', results: [] })
  expect(JSON.stringify(body)).not.toContain('secret provider content')
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('does not attach a real cited excerpt from another flight to copied request identity', async () => {
  const otherQuote = 'BA456 AAA-BBB 2025-01-01 operated Boeing 737-800 N123AB.'
  const first = research()
  const textBlock = first.content.find((block) => block.type === 'text')!
  textBlock.text = otherQuote
  textBlock.citations![0].cited_text = otherQuote
  provider(extracted({ evidence_quote: otherQuote }), first)
  const response = await onRequestPost(context())
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ results: [{ aircraft_icao: null }] })
})

it.each([
  ['reversed route', 'BA123 BBB-AAA 2025-01-01 operated Boeing 737-800.'],
  ['scheduled equipment claimed as actual', 'BA123 AAA-BBB 2025-01-01 scheduled Boeing 737-800.'],
])('rejects a cited %s despite copied identity fields', async (_label, evidence_quote) => {
  const first = research()
  const block = first.content.find((block) => block.type === 'text')!
  block.text = evidence_quote
  block.citations![0].cited_text = evidence_quote
  provider(extracted({ evidence_quote }), first)
  const response = await onRequestPost(context())
  expect(await response.json()).toMatchObject({ results: [{ aircraft_icao: null }] })
})

it('supports a spelled calendar date and spaced full flight number in the actual cited record', async () => {
  const evidence_quote = 'BA 0123 AAA-BBB 1 January 2025 operated Boeing 737-800 N123AB.'
  const first = research()
  const block = first.content.find((block) => block.type === 'text')!
  block.text = evidence_quote
  block.citations![0].cited_text = evidence_quote
  provider(extracted({ evidence_quote }), first)
  const response = await onRequestPost(context())
  expect(await response.json()).toMatchObject({ results: [{ aircraft_icao: 'B738' }] })
})

it.each([
  [
    'a hyphenated competing flight',
    'BA123 AAA-BBB 2025-01-01 operated Airbus A320. BA-456 AAA-BBB 2025-01-01 operated Boeing 737-800.',
    {},
    {},
  ],
  [
    'a competing flight resembling a type code',
    'BA123 AAA-BBB 2025-01-01 operated Airbus A320. SU95 AAA-BBB 2025-01-01 operated Boeing 737-800.',
    {},
    {},
  ],
  [
    'a competing flight equal to the proposed aircraft code',
    'BA123 AAA-BBB 2025-01-01 operated Boeing 777-300ER. SU95 AAA-BBB 2025-01-01 operated Boeing 737-800.',
    { icao: 'SU95' },
    {},
  ],
  [
    'two flight records',
    'BA123 AAA-BBB 2025-01-01 operated Airbus A320. BA456 AAA-BBB 2025-01-01 operated Boeing 737-800.',
    {},
    {},
  ],
  [
    'a duration mistaken for an ATR model',
    'BA123 AAA-BBB 2025-01-01 operated Boeing 737-800 with a delay of 72 minutes.',
    { icao: 'AT72' },
    {},
  ],
  [
    'a different ATR variant',
    'BA123 AAA-BBB 2025-01-01 operated ATR 72-600.',
    { icao: 'AT72' },
    {},
  ],
  [
    'a valid airport token after a misleading prefix',
    'BA123 seasonal LHR-SEA 2025-01-01 operated Boeing 737-800.',
    { evidence_origin: 'SEA', evidence_destination: 'LHR' },
    { origin: 'SEA', destination: 'LHR' },
  ],
  [
    'an airport code inside another word',
    'BA123 seasonal-LHR 2025-01-01 operated Boeing 737-800.',
    { evidence_origin: 'SEA', evidence_destination: 'LHR' },
    { origin: 'SEA', destination: 'LHR' },
  ],
])('rejects %s in cited evidence', async (_label, evidence_quote, fields, input) => {
  const first = research()
  const block = first.content.find((block) => block.type === 'text')!
  block.text = evidence_quote
  block.citations![0].cited_text = evidence_quote
  provider(extracted({ ...fields, evidence_quote }), first)
  const response = await onRequestPost(context(input))
  expect(await response.json()).toMatchObject({ results: [{ aircraft_icao: null }] })
})
