import { afterEach, expect, it, vi } from 'vitest'
import { ImportJob } from '../../workers/import/ImportJob'
import { cancelBatch, createProcessingBatch } from '../api/_services/importDrafts'
import { importAccount, postJob, providerFlight, providerText } from './import-fixture'

const provider = vi.hoisted(() => ({ stream: vi.fn((_input: { config: { abortSignal: AbortSignal } }): Promise<AsyncIterable<{ text: string }>> => new Promise(() => undefined)) }))
vi.mock('@google/genai', () => ({
  GoogleGenAI: class { models = { generateContentStream: provider.stream, generateContent: vi.fn(async () => ({ text: providerText([providerFlight()]) })) } },
  Type: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN' },
  ApiError: class extends Error {},
}))
let dispose: (() => Promise<void>) | undefined
afterEach(async () => { vi.useRealTimers(); provider.stream.mockClear(); await dispose?.() })
it('hands acceptance to the bound job once and returns the same batch on replay', async () => {
  const fixture = await importAccount(); dispose = fixture.dispose
  const fetch = vi.fn(async () => {
    expect(await fixture.db.prepare('SELECT status,stage FROM import_batches').first()).toEqual({ status: 'processing', stage: 'accepted' })
    await fixture.db.prepare("UPDATE import_batches SET stage = 'recognizing'").run()
    return new Response(null, { status: 202 })
  })
  const namespace = { idFromName: vi.fn(name => name), get: vi.fn(() => ({ fetch })) }
  const operation = 'stream-submission-0001'
  const first = await postJob(fixture.db, { submissionOperationId: operation }, undefined, {}, { IMPORT_JOBS: namespace })
  expect(first.status).toBe(202)
  expect(first.body).toEqual({ batchId: expect.any(String) })
  const replay = await postJob(fixture.db, { submissionOperationId: operation }, undefined, {}, { IMPORT_JOBS: namespace })
  expect(replay.body).toEqual(first.body)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(namespace.idFromName).toHaveBeenCalledWith(`u1:${first.body.batchId}`)
  expect(await fixture.db.prepare('SELECT status,stage FROM import_batches').first()).toEqual({ status: 'processing', stage: 'recognizing' })
  expect((await fixture.db.prepare('SELECT COUNT(*) AS n FROM import_drafts').first())?.n).toBe(0)
})
it('does not require an API-side provider secret when the bound worker owns extraction', async () => {
  const fixture = await importAccount(); dispose = fixture.dispose
  const namespace = { idFromName: (name: string) => name, get: () => ({ fetch: async () => new Response(null, { status: 202 }) }) }
  const result = await postJob(fixture.db, {}, undefined, {}, { IMPORT_JOBS: namespace, GEMINI_API_KEY: undefined })
  expect(result.status).toBe(202)
})
it('refuses invalid file input with a structured code before dispatch', async () => {
  const fixture = await importAccount(); dispose = fixture.dispose
  const fetch = vi.fn(); const namespace = { idFromName: (name: string) => name, get: () => ({ fetch }) }
  const result = await postJob(fixture.db, { type: 'pdf', content: 'not-base64' }, undefined, {}, { IMPORT_JOBS: namespace })
  expect(result.status).toBe(400); expect(result.body.code).toBe('INVALID_FILE'); expect(fetch).not.toHaveBeenCalled()
})

it('enforces 90 seconds and aborts even a provider that ignores the signal', async () => {
  const fixture = await importAccount(); dispose = fixture.dispose
  const batchId = crypto.randomUUID()
  await createProcessingBatch(fixture.db, { id: batchId, userId: 'u1', sourceType: 'text', sourceLabel: null, operationId: 'deadline-op-0001' }, new Date())
  const pending: Promise<unknown>[] = []
  const state = {
    storage: { get: async () => undefined, put: async () => undefined, setAlarm: async () => undefined, deleteAlarm: async () => undefined, deleteAll: async () => undefined },
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn(), waitUntil: (work: Promise<unknown>) => pending.push(work),
  } as unknown as DurableObjectState
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  const started = Date.now()
  const job = new ImportJob(state, { DB: fixture.db, GEMINI_API_KEY: 'fake' })
  expect((await job.fetch(new Request('https://import.internal/start', { method: 'POST', body: JSON.stringify({
    fence: { userId: 'u1', batchId, generation: 1 }, source: { type: 'text', content: 'private fixture' },
  }) }))).status).toBe(202)
  await vi.waitFor(() => expect(provider.stream).toHaveBeenCalledTimes(1))
  const signal = provider.stream.mock.calls[0][0].config.abortSignal
  await vi.advanceTimersByTimeAsync(90_000 - (Date.now() - started) - 1)
  expect(signal.aborted).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  await Promise.all(pending)
  expect(signal.aborted).toBe(true)
  expect(await fixture.db.prepare('SELECT status,error_code FROM import_batches WHERE id = ?').bind(batchId).first()).toEqual({ status: 'failed', error_code: 'PROVIDER_TIMEOUT' })
})
it('keeps the interruption alarm when a database outage prevents finalization', async () => {
  const fixture = await importAccount(); dispose = fixture.dispose
  const batchId = crypto.randomUUID()
  await createProcessingBatch(fixture.db, { id: batchId, userId: 'u1', sourceType: 'text', sourceLabel: null, operationId: 'db-outage-op-0001' }, new Date())
  let writes = 0
  const db = { prepare: fixture.db.prepare.bind(fixture.db), batch: async (statements: D1PreparedStatement[]) => {
    if (++writes > 1) throw new Error('Database unavailable')
    return fixture.db.batch(statements)
  } } as D1Database
  provider.stream.mockResolvedValueOnce((async function* () { yield { text: providerText([providerFlight()]) } })())
  const pending: Promise<unknown>[] = []; const deleteAlarm = vi.fn(async () => undefined)
  const state = {
    storage: { get: async () => undefined, put: async () => undefined, setAlarm: async () => undefined, deleteAlarm, deleteAll: async () => undefined },
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn(), waitUntil: (work: Promise<unknown>) => pending.push(work),
  } as unknown as DurableObjectState
  const job = new ImportJob(state, { DB: db, GEMINI_API_KEY: 'fake' })
  expect((await job.fetch(new Request('https://import.internal/start', { method: 'POST', body: JSON.stringify({
    fence: { userId: 'u1', batchId, generation: 1 }, source: { type: 'text', content: 'private fixture' },
  }) }))).status).toBe(202)
  await Promise.all(pending)
  expect(deleteAlarm).not.toHaveBeenCalled()
  await job.alarm()
  expect(await fixture.db.prepare('SELECT status,error_code,generation FROM import_batches WHERE id = ?').bind(batchId).first())
    .toEqual({ status: 'failed', error_code: 'JOB_INTERRUPTED', generation: 2 })
})

it('a duplicate still in accepted stage waits for durable ownership before acknowledging', async () => {
  const fixture = await importAccount(); dispose = fixture.dispose
  const batchId = crypto.randomUUID()
  await createProcessingBatch(fixture.db, { id: batchId, userId: 'u1', sourceType: 'text', sourceLabel: null, operationId: 'ownership-op-0001' }, new Date())
  let acknowledge: () => void = () => undefined
  const accepted = new Promise<void>(resolve => { acknowledge = resolve })
  const fetch = vi.fn(async () => { await accepted; return new Response(null, { status: 202 }) })
  const namespace = { idFromName: (name: string) => name, get: () => ({ fetch }) }
  let settled = false
  const submission = postJob(fixture.db, { submissionOperationId: 'ownership-op-0001' }, undefined, {}, { IMPORT_JOBS: namespace })
    .then(result => { settled = true; return result })
  try {
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(settled).toBe(false)
  } finally { acknowledge() }
  expect(await submission).toMatchObject({ status: 202, body: { batchId } })
})

it('rechecks D1 after registration when cancellation races the initial events read', async () => {
  const fixture = await importAccount(); dispose = fixture.dispose
  const batchId = crypto.randomUUID()
  await createProcessingBatch(fixture.db, { id: batchId, userId: 'u1', sourceType: 'text', sourceLabel: null, operationId: 'subscribe-race-0001' }, new Date())
  let raced = false
  const db = { prepare: (sql: string) => {
    const statement = fixture.db.prepare(sql)
    return { bind: (...values: unknown[]) => {
      const bound = statement.bind(...values)
      return { first: async () => {
        const row = await bound.first()
        if (!raced) { raced = true; await cancelBatch(fixture.db, 'u1', batchId, new Date()) }
        return row
      } }
    } }
  } } as unknown as D1Database
  const state = { storage: { get: async () => undefined, deleteAlarm: async () => undefined, deleteAll: async () => undefined },
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn() } as unknown as DurableObjectState
  const job = new ImportJob(state, { DB: db, GEMINI_API_KEY: 'fake' })
  const response = await job.fetch(new Request(`https://import.internal/events?userId=u1&batchId=${batchId}`))
  const reader = response.body!.getReader(); let text = ''; let closed = false
  const reading = (async () => { for (;;) {
    const next = await reader.read(); if (next.done) { closed = true; return }
    text += new TextDecoder().decode(next.value)
  } })()
  try {
    await expect.poll(() => closed).toBe(true)
    expect(text).toContain('event: snapshot')
    expect(text).toContain('event: end')
    expect(text).toContain('"status":"cancelled"')
  } finally { await reader.cancel(); await reading }
})

it('distinguishes oversized files from invalid files before dispatch', async () => {
  const fixture = await importAccount(); dispose = fixture.dispose
  const fetch = vi.fn(); const namespace = { idFromName: (name: string) => name, get: () => ({ fetch }) }
  const result = await postJob(fixture.db, { type: 'pdf', content: Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64') }, undefined, {}, { IMPORT_JOBS: namespace })
  expect(result.status).toBe(413); expect(result.body.code).toBe('PAYLOAD_TOO_LARGE')
  expect(fetch).not.toHaveBeenCalled()
})

it('the unbound events endpoint sends a final snapshot and end with the same cache contract', async () => {
  const fixture = await importAccount(); dispose = fixture.dispose
  const batchId = crypto.randomUUID()
  await createProcessingBatch(fixture.db, { id: batchId, userId: 'u1', sourceType: 'text', sourceLabel: null, operationId: 'unbound-events-0001' }, new Date())
  await cancelBatch(fixture.db, 'u1', batchId, new Date())
  const { onRequestGet } = await import('../api/import/batches/[id]/events')
  const response = await onRequestGet({ request: new Request(`https://kuuki.test/api/import/batches/${batchId}/events`),
    env: { DB: fixture.db }, data: { user: { id: 'u1' } }, params: { id: batchId } } as never)
  expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform')
  const text = await response.text()
  expect(text).toContain('event: snapshot')
  expect(text).toContain('event: end')
  expect(text).toContain('"status":"cancelled"')
  expect(text).not.toMatch(/^id:/m)
})
