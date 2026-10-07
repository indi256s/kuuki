import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { onRequestPost as suggest } from '../api/flights/schedule-suggestions'
import { onRequestPost as accept } from '../api/flights/schedule-batch'
import { onRequestPatch as patch } from '../api/flights/[id]'
import { findAirport } from '../../packages/data/src/airport-lookup'
import { apiContext, createApiDatabase, csrfRequest } from './harness'
import { hasSql, instrumentDb } from './db-hooks'

const provider = vi.hoisted(() => ({ generateContent: vi.fn() }))
vi.mock('@google/genai', async importOriginal => ({
  ...await importOriginal<typeof import('@google/genai')>(),
  GoogleGenAI: class { models = { generateContent: provider.generateContent } },
}))
const user = { id: 'schedule-owner', email: 'schedule@example.test' }
let api: Awaited<ReturnType<typeof createApiDatabase>>
beforeEach(async () => {
  api = await createApiDatabase()
  await api.db.batch([
    ...[user, { id: 'other', email: 'other@example.test' }].flatMap(u => [
      api.db.prepare('INSERT INTO users(id,email,password_hash) VALUES(?,?,?)').bind(u.id, u.email, 'synthetic'),
      api.db.prepare('INSERT INTO profiles(id) VALUES(?)').bind(u.id),
    ]),
    ...['TBS', 'IST'].map(iata => {
      const a = findAirport(iata)!
      return api.db.prepare('INSERT INTO airports_reference(iata,name,city,country,country_code,latitude,longitude) VALUES(?,?,?,?,?,?,?)')
        .bind(iata, a.name, a.city, a.country, a.countryCode, a.latitude, a.longitude)
    }),
    ...[1, 2, 3, 4, 5].map(id => api.db.prepare(`INSERT INTO flights(id,user_id,date,origin,destination,airline_iata,flight_number,
      duration_minutes,duration_source,lifecycle_state,confirmation_source)
      VALUES(?,?,'2025-01-01','TBS','IST',?,?,150,?,'logged','legacy')`)
      .bind(id, id === 5 ? 'other' : user.id, id === 4 ? null : 'TK', id === 3 ? null : '381', id === 2 ? 'times' : 'estimate')),
  ])
  provider.generateContent.mockResolvedValue({ text: JSON.stringify({ results: [
    { index: 1, departureTime: '10:00', arrivalTime: '11:00', confidence: 0.9, evidence: 'Published schedule' },
  ] }) })
})
afterEach(async () => { vi.restoreAllMocks(); provider.generateContent.mockReset(); await api.dispose() })
const context = (path: string, body: unknown, db = api.db, key: string | null = 'synthetic') => ({
  ...apiContext(db, csrfRequest(path, 'POST', body)), env: { DB: db, GEMINI_API_KEY: key ?? undefined }, data: { user },
} as never)
const suggestRequest = (ids: unknown, db = api.db, key: string | undefined = 'synthetic') =>
  suggest(context('/api/flights/schedule-suggestions', { ids }, db, key))
const acceptRequest = (items: unknown, db = api.db) => accept(context('/api/flights/schedule-batch', { items }, db))
const item = { id: 1, departure_time: '10:00', arrival_time: '11:00' }

it('suggestions never write flights, preferences or derived state', async () => {
  const tracked = instrumentDb(api.db)
  const before = (await api.db.prepare('SELECT * FROM flights ORDER BY id').all()).results
  const response = await suggestRequest([1], tracked.db)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ results: [{ id: 1, departureTime: '10:00', arrivalTime: '11:00', confidence: 0.9, evidence: 'Published schedule' }] })
  expect((await api.db.prepare('SELECT * FROM flights ORDER BY id').all()).results).toEqual(before)
  // Paid-quota counters may be written; suggestions never accept a schedule or dirty user projections.
  expect(tracked.hooks.sql.filter(sql => /^(INSERT|UPDATE|DELETE)/i.test(sql.trim()))).toEqual([
    expect.stringContaining('INSERT INTO auth_rate_limits'),
  ])
  const call = provider.generateContent.mock.lastCall![0]
  expect(call.config.tools).toEqual([{ googleSearch: {} }])
  expect(call.config.httpOptions.timeout).toBe(20_000)
  expect(call.config.abortSignal).toBeInstanceOf(AbortSignal)
})

it('only estimate flights with an airline and a number are eligible', async () => {
  const response = await suggestRequest([1, 2, 3, 4])
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ results: [{ id: 1 }] })
  const prompt = provider.generateContent.mock.lastCall![0].contents as string
  expect(prompt).toContain('TK')
  expect(prompt).toContain('381')
  provider.generateContent.mockClear()
  expect(await (await suggestRequest([2, 3, 4])).json()).toEqual({ results: [] })
  expect(provider.generateContent).not.toHaveBeenCalled()
})

it('missing key is 503 without contacting the provider or reading private flights', async () => {
  const db = { prepare: vi.fn() } as unknown as D1Database
  const response = await suggest(context('/api/flights/schedule-suggestions', { ids: [1] }, db, null))
  expect(response.status).toBe(503)
  expect(await response.json()).toMatchObject({ code: 'PROVIDER_DISABLED' })
  expect(db.prepare).not.toHaveBeenCalled()
  expect(provider.generateContent).not.toHaveBeenCalled()
})

it('foreign and missing IDs cannot reach the provider', async () => {
  for (const id of [5, 999]) expect((await suggestRequest([id])).status).toBe(404)
  expect(provider.generateContent).not.toHaveBeenCalled()
})

it.each([[], [1, 1], [0], ['1'], Array.from({ length: 21 }, (_, i) => i + 1)].map(ids => [ids]))('rejects invalid bounded ID requests %j', async ids => {
  expect((await suggestRequest(ids)).status).toBeGreaterThanOrEqual(400)
  expect(provider.generateContent).not.toHaveBeenCalled()
})

it.each([suggest, accept])('requires authentication and CSRF before private reads', async handler => {
  const db = { prepare: vi.fn() } as unknown as D1Database
  expect((await handler({ ...apiContext(db, csrfRequest('/api/flights/schedule-batch', 'POST', {})) } as never)).status).toBe(401)
  expect((await handler({ ...apiContext(db, new Request('https://kuuki.test/api/flights/schedule-batch', { method: 'POST' })), data: { user } } as never)).status).toBe(403)
  expect(db.prepare).not.toHaveBeenCalled()
})

it.each([
  '{invalid',
  JSON.stringify({ results: [{ index: 2, departureTime: '10:00', arrivalTime: '11:00', confidence: 0.9 }] }),
  JSON.stringify({ results: [{ index: 1, departureTime: '25:00', arrivalTime: '11:00', confidence: 0.9 }] }),
  JSON.stringify({ results: [{ index: 1, departureTime: '10:00', arrivalTime: null, confidence: 0.9 }] }),
  JSON.stringify({ results: [{ index: 1, departureTime: null, arrivalTime: null, confidence: 2 }] }),
])('invalid provider output returns a stable error without writing times', async text => {
  provider.generateContent.mockResolvedValue({ text })
  const response = await suggestRequest([1])
  expect(response.status).toBe(502)
  expect(await response.json()).toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE', results: [] })
  expect(await api.db.prepare('SELECT departure_time,duration_source FROM flights WHERE id=1').first())
    .toEqual({ departure_time: null, duration_source: 'estimate' })
})

it('a suggestion without evidence supplies no inferred times', async () => {
  provider.generateContent.mockResolvedValue({ text: JSON.stringify({ results: [
    { index: 1, departureTime: '10:00', arrivalTime: '11:00', confidence: 0.9, evidence: null },
  ] }) })
  expect(await (await suggestRequest([1])).json()).toEqual({ results: [
    { id: 1, departureTime: null, arrivalTime: null, confidence: 0, evidence: null },
  ] })
})

it('accept stores schedule source and times, invalidates data, and replay is an absolute set', async () => {
  const tracked = instrumentDb(api.db)
  const response = await acceptRequest([item], tracked.db)
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ results: [{ id: 1, status: 'accepted', flight: {
    departure_time: '10:00', arrival_time: '11:00', duration_source: 'schedule', duration_minutes: 120,
  } }], derived_state: 'ready' })
  expect(await api.db.prepare('SELECT revision,published_revision FROM user_derived_state WHERE user_id=?').bind(user.id).first())
    .toEqual({ revision: 1, published_revision: 1 })
  const before = await api.db.prepare('SELECT * FROM flights WHERE id=1').first()
  expect((await acceptRequest([item])).status).toBe(200)
  expect(await api.db.prepare('SELECT * FROM flights WHERE id=1').first()).toEqual(before)
})

it('owner edit of times turns schedule into times; unchanged times preserve schedule across number and date edits', async () => {
  await acceptRequest([item])
  const update = async (body: unknown) => {
    const response = await patch({ ...apiContext(api.db, csrfRequest('/api/flights/1', 'PATCH', body)), data: { user }, params: { id: '1' } } as never)
    expect(response.status).toBe(200)
    return response.json() as Promise<{ duration_source: string; duration_minutes: number }>
  }
  expect(await update({ departure_time: '10:00', arrival_time: '11:00' })).toMatchObject({ duration_source: 'schedule' })
  expect(await update({ flight_number: '382', date: '2025-01-02' })).toMatchObject({ duration_source: 'schedule' })
  expect(await update({ arrival_time: '12:00' })).toMatchObject({ duration_source: 'times', duration_minutes: 180 })
})

it('accept reports per-item errors and leaves other owners and invalid values untouched', async () => {
  const response = await acceptRequest([item, { ...item, id: 5 }, { ...item, id: 2, departure_time: '25:00' },
    { ...item, id: 3 }, { ...item, id: 3 }, { id: 4, departure_time: null, arrival_time: '11:00' }])
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ results: [
    { id: 1, status: 'accepted' }, { id: 5, status: 'error', code: 'NOT_FOUND' },
    { id: 2, status: 'error', code: 'INVALID_FLIGHT' }, { id: 3, status: 'error', code: 'DUPLICATE_ID' },
    { id: 3, status: 'error', code: 'DUPLICATE_ID' }, { id: 4, status: 'error' },
  ] })
  expect(await api.db.prepare('SELECT departure_time FROM flights WHERE id=5').first()).toEqual({ departure_time: null })
})

it('a concurrent time edit is not overwritten by stale accepted metrics', async () => {
  const tracked = instrumentDb(api.db)
  tracked.hooks.beforeBatch(hasSql('UPDATE flights SET'), async () => {
    await api.db.prepare("UPDATE flights SET departure_time='09:00',duration_source='times' WHERE id=1").run()
  })
  const response = await acceptRequest([item], tracked.db)
  expect(await response.json()).toMatchObject({ results: [{ id: 1, status: 'error', code: 'STATE_CONFLICT' }] })
  expect(await api.db.prepare('SELECT departure_time,duration_source FROM flights WHERE id=1').first())
    .toEqual({ departure_time: '09:00', duration_source: 'times' })
})

it('times and the dirty marker roll back together', async () => {
  await api.db.prepare(`CREATE TRIGGER reject_schedule_revision BEFORE INSERT ON user_derived_state
    BEGIN SELECT RAISE(ABORT,'fixture failure'); END`).run()
  expect((await acceptRequest([item])).status).toBe(500)
  expect(await api.db.prepare('SELECT departure_time,duration_source FROM flights WHERE id=1').first())
    .toEqual({ departure_time: null, duration_source: 'estimate' })
})

it('mixed accepted and stale items mark only successful updates dirty', async () => {
  const tracked = instrumentDb(api.db)
  tracked.hooks.beforeBatch(hasSql('UPDATE flights SET'), async () => {
    await api.db.prepare('UPDATE flights SET zones_overflown=99 WHERE id=3').run()
  })
  const response = await acceptRequest([item, { ...item, id: 3 }], tracked.db)
  expect(await response.json()).toMatchObject({ results: [
    { id: 1, status: 'accepted' }, { id: 3, status: 'error', code: 'STATE_CONFLICT' },
  ], derived_state: 'ready' })
  expect(await api.db.prepare('SELECT revision,published_revision FROM user_derived_state WHERE user_id=?').bind(user.id).first())
    .toEqual({ revision: 1, published_revision: 1 })
  expect(await api.db.prepare('SELECT departure_time,zones_overflown FROM flights WHERE id=3').first())
    .toEqual({ departure_time: null, zones_overflown: 99 })
})

it('a pooled measured median still outranks accepted schedule times', async () => {
  await api.db.batch([6, 7].map((id, i) => api.db.prepare(`INSERT INTO flights(id,user_id,date,origin,destination,
    airline_iata,flight_number,duration_minutes,duration_source,lifecycle_state,confirmation_source)
    VALUES(?,'other','2025-01-01','TBS','IST','TK','381',?,'times','logged','legacy')`).bind(id, 160 + i * 10)))
  const response = await acceptRequest([item])
  expect(await response.json()).toMatchObject({ results: [{ status: 'accepted', flight: {
    departure_time: '10:00', arrival_time: '11:00', duration_source: 'route_median', duration_minutes: 160,
  } }] })
})

it('paid suggestions are rate-limited before the provider call', async () => {
  await api.db.prepare('INSERT INTO auth_rate_limits(key,count,expires_at) VALUES(?,30,?)')
    .bind(`schedule-suggestions:${user.id}`, Math.floor(Date.now() / 1000) + 3600).run()
  expect((await suggestRequest([1])).status).toBe(429)
  expect(provider.generateContent).not.toHaveBeenCalled()
})

it('a provider that ignores abort cannot hold the request past its local deadline', async () => {
  provider.generateContent.mockImplementation(() => new Promise(() => {}))
  const realTimer = globalThis.setTimeout
  vi.spyOn(globalThis, 'setTimeout').mockImplementation((handler, delay, ...args) =>
    realTimer(handler, delay === 20_000 ? 1 : delay, ...args))
  const response = await suggestRequest([1])
  expect(response.status).toBe(504)
  expect(await response.json()).toMatchObject({ code: 'PROVIDER_TIMEOUT', results: [] })
  expect(provider.generateContent.mock.lastCall![0].config.abortSignal.aborted).toBe(true)
})

it('accept bounds batch size and rejects an oversized streamed body before reading flights', async () => {
  expect((await acceptRequest([])).status).toBe(400)
  expect((await acceptRequest(Array.from({ length: 21 }, () => item))).status).toBe(413)
  const db = { prepare: vi.fn() } as unknown as D1Database
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(16 * 1024 + 1)); controller.close() } })
  expect((await accept(context('/api/flights/schedule-batch', stream, db))).status).toBe(413)
  expect(db.prepare).not.toHaveBeenCalled()
})
