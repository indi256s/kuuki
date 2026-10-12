import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImportJob } from '../../workers/import/ImportJob'
import { cancelBatch, createProcessingBatch } from '../api/_services/importDrafts'
import { importAccount, postJob, providerFlight, providerText } from './import-fixture'

const provider = vi.hoisted(() => ({
  stream: vi.fn(
    (_input: { config: { abortSignal: AbortSignal } }): Promise<AsyncIterable<{ text: string }>> =>
      new Promise(() => undefined),
  ),
}))
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContentStream: provider.stream,
      generateContent: vi.fn(async () => ({ text: providerText([providerFlight()]) })),
    }
  },
  Type: {
    OBJECT: 'OBJECT',
    ARRAY: 'ARRAY',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    BOOLEAN: 'BOOLEAN',
  },
  ApiError: class extends Error {},
}))
let dispose: (() => Promise<void>) | undefined
afterEach(async () => {
  vi.useRealTimers()
  provider.stream.mockClear()
  await dispose?.()
})
it('hands acceptance to the bound job once and returns the same batch on replay', async () => {
  const fixture = await importAccount()
  dispose = fixture.dispose
  const fetch = vi.fn(async () => {
    expect(await fixture.db.prepare('SELECT status,stage FROM import_batches').first()).toEqual({
      status: 'processing',
      stage: 'accepted',
    })
    await fixture.db.prepare("UPDATE import_batches SET stage = 'recognizing'").run()
    return new Response(null, { status: 202 })
  })
  const namespace = { idFromName: vi.fn((name) => name), get: vi.fn(() => ({ fetch })) }
  const operation = 'stream-submission-0001'
  const first = await postJob(
    fixture.db,
    { submissionOperationId: operation },
    undefined,
    {},
    { IMPORT_JOBS: namespace },
  )
  expect(first.status).toBe(202)
  expect(first.body).toEqual({ batchId: expect.any(String) })
  const replay = await postJob(
    fixture.db,
    { submissionOperationId: operation },
    undefined,
    {},
    { IMPORT_JOBS: namespace },
  )
  expect(replay.body).toEqual(first.body)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(namespace.idFromName).toHaveBeenCalledWith(`u1:${first.body.batchId}`)
  expect(await fixture.db.prepare('SELECT status,stage FROM import_batches').first()).toEqual({
    status: 'processing',
    stage: 'recognizing',
  })
  expect((await fixture.db.prepare('SELECT COUNT(*) AS n FROM import_drafts').first())?.n).toBe(0)
})
it('forwards the flown requirement to the bound job with the source, and nothing else new', async () => {
  const fixture = await importAccount()
  dispose = fixture.dispose
  const fetch = vi.fn(
    async (_url: string, _init: RequestInit) => new Response(null, { status: 202 }),
  )
  const namespace = { idFromName: (name: string) => name, get: () => ({ fetch }) }
  const result = await postJob(
    fixture.db,
    { type: 'pdf', content: 'JVBERi0x', requireFlownConfirmation: true },
    undefined,
    {},
    { IMPORT_JOBS: namespace },
  )
  expect(result.status).toBe(202)
  expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({
    fence: { userId: 'u1', batchId: result.body.batchId, generation: 1 },
    source: { type: 'pdf', content: 'JVBERi0x' },
    requireFlownConfirmation: true,
  })
})
it('does not require an API-side provider secret when the bound worker owns extraction', async () => {
  const fixture = await importAccount()
  dispose = fixture.dispose
  const namespace = {
    idFromName: (name: string) => name,
    get: () => ({ fetch: async () => new Response(null, { status: 202 }) }),
  }
  const result = await postJob(
    fixture.db,
    {},
    undefined,
    {},
    { IMPORT_JOBS: namespace, GEMINI_API_KEY: undefined },
  )
  expect(result.status).toBe(202)
})
it('refuses invalid file input with a structured code before dispatch', async () => {
  const fixture = await importAccount()
  dispose = fixture.dispose
  const fetch = vi.fn()
  const namespace = { idFromName: (name: string) => name, get: () => ({ fetch }) }
  const result = await postJob(
    fixture.db,
    { type: 'pdf', content: 'not-base64' },
    undefined,
    {},
    { IMPORT_JOBS: namespace },
  )
  expect(result.status).toBe(400)
  expect(result.body.code).toBe('INVALID_FILE')
  expect(fetch).not.toHaveBeenCalled()
})

it('enforces 90 seconds and aborts even a provider that ignores the signal', async () => {
  const fixture = await importAccount()
  dispose = fixture.dispose
  const batchId = crypto.randomUUID()
  await createProcessingBatch(
    fixture.db,
    {
      id: batchId,
      userId: 'u1',
      sourceType: 'text',
      sourceLabel: null,
      operationId: 'deadline-op-0001',
    },
    new Date(),
  )
  const pending: Promise<unknown>[] = []
  const state = {
    storage: {
      get: async () => undefined,
      put: async () => undefined,
      setAlarm: async () => undefined,
      deleteAlarm: async () => undefined,
      deleteAll: async () => undefined,
    },
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn(),
    waitUntil: (work: Promise<unknown>) => pending.push(work),
  } as unknown as DurableObjectState
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  const started = Date.now()
  const job = new ImportJob(state, { DB: fixture.db, GEMINI_API_KEY: 'fake' })
  expect(
    (
      await job.fetch(
        new Request('https://import.internal/start', {
          method: 'POST',
          body: JSON.stringify({
            fence: { userId: 'u1', batchId, generation: 1 },
            source: { type: 'text', content: 'private fixture' },
          }),
        }),
      )
    ).status,
  ).toBe(202)
  await vi.waitFor(() => expect(provider.stream).toHaveBeenCalledTimes(1))
  const signal = provider.stream.mock.calls[0][0].config.abortSignal
  await vi.advanceTimersByTimeAsync(90_000 - (Date.now() - started) - 1)
  expect(signal.aborted).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  await Promise.all(pending)
  expect(signal.aborted).toBe(true)
  expect(
    await fixture.db
      .prepare('SELECT status,error_code FROM import_batches WHERE id = ?')
      .bind(batchId)
      .first(),
  ).toEqual({ status: 'failed', error_code: 'PROVIDER_TIMEOUT' })
})
it('keeps the interruption alarm when a database outage prevents finalization', async () => {
  const fixture = await importAccount()
  dispose = fixture.dispose
  const batchId = crypto.randomUUID()
  await createProcessingBatch(
    fixture.db,
    {
      id: batchId,
      userId: 'u1',
      sourceType: 'text',
      sourceLabel: null,
      operationId: 'db-outage-op-0001',
    },
    new Date(),
  )
  let writes = 0
  const db = {
    prepare: fixture.db.prepare.bind(fixture.db),
    batch: async (statements: D1PreparedStatement[]) => {
      if (++writes > 1) throw new Error('Database unavailable')
      return fixture.db.batch(statements)
    },
  } as D1Database
  provider.stream.mockResolvedValueOnce(
    (async function* () {
      yield { text: providerText([providerFlight()]) }
    })(),
  )
  const pending: Promise<unknown>[] = []
  const deleteAlarm = vi.fn(async () => undefined)
  const state = {
    storage: {
      get: async () => undefined,
      put: async () => undefined,
      setAlarm: async () => undefined,
      deleteAlarm,
      deleteAll: async () => undefined,
    },
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn(),
    waitUntil: (work: Promise<unknown>) => pending.push(work),
  } as unknown as DurableObjectState
  const job = new ImportJob(state, { DB: db, GEMINI_API_KEY: 'fake' })
  expect(
    (
      await job.fetch(
        new Request('https://import.internal/start', {
          method: 'POST',
          body: JSON.stringify({
            fence: { userId: 'u1', batchId, generation: 1 },
            source: { type: 'text', content: 'private fixture' },
          }),
        }),
      )
    ).status,
  ).toBe(202)
  await Promise.all(pending)
  expect(deleteAlarm).not.toHaveBeenCalled()
  await job.alarm()
  expect(
    await fixture.db
      .prepare('SELECT status,error_code,generation FROM import_batches WHERE id = ?')
      .bind(batchId)
      .first(),
  ).toEqual({ status: 'failed', error_code: 'JOB_INTERRUPTED', generation: 2 })
})

it('a duplicate still in accepted stage waits for durable ownership before acknowledging', async () => {
  const fixture = await importAccount()
  dispose = fixture.dispose
  const batchId = crypto.randomUUID()
  await createProcessingBatch(
    fixture.db,
    {
      id: batchId,
      userId: 'u1',
      sourceType: 'text',
      sourceLabel: null,
      operationId: 'ownership-op-0001',
    },
    new Date(),
  )
  let acknowledge: () => void = () => undefined
  const accepted = new Promise<void>((resolve) => {
    acknowledge = resolve
  })
  const fetch = vi.fn(async () => {
    await accepted
    return new Response(null, { status: 202 })
  })
  const namespace = { idFromName: (name: string) => name, get: () => ({ fetch }) }
  let settled = false
  const submission = postJob(
    fixture.db,
    { submissionOperationId: 'ownership-op-0001' },
    undefined,
    {},
    { IMPORT_JOBS: namespace },
  ).then((result) => {
    settled = true
    return result
  })
  try {
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(settled).toBe(false)
  } finally {
    acknowledge()
  }
  expect(await submission).toMatchObject({ status: 202, body: { batchId } })
})

it('rechecks D1 after registration when cancellation races the initial events read', async () => {
  const fixture = await importAccount()
  dispose = fixture.dispose
  const batchId = crypto.randomUUID()
  await createProcessingBatch(
    fixture.db,
    {
      id: batchId,
      userId: 'u1',
      sourceType: 'text',
      sourceLabel: null,
      operationId: 'subscribe-race-0001',
    },
    new Date(),
  )
  let raced = false
  const db = {
    prepare: (sql: string) => {
      const statement = fixture.db.prepare(sql)
      return {
        bind: (...values: unknown[]) => {
          const bound = statement.bind(...values)
          return {
            first: async () => {
              const row = await bound.first()
              if (!raced) {
                raced = true
                await cancelBatch(fixture.db, 'u1', batchId, new Date())
              }
              return row
            },
          }
        },
      }
    },
  } as unknown as D1Database
  const state = {
    storage: {
      get: async () => undefined,
      deleteAlarm: async () => undefined,
      deleteAll: async () => undefined,
    },
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn(),
  } as unknown as DurableObjectState
  const job = new ImportJob(state, { DB: db, GEMINI_API_KEY: 'fake' })
  const response = await job.fetch(
    new Request(`https://import.internal/events?userId=u1&batchId=${batchId}`),
  )
  const reader = response.body!.getReader()
  let text = ''
  let closed = false
  const reading = (async () => {
    for (;;) {
      const next = await reader.read()
      if (next.done) {
        closed = true
        return
      }
      text += new TextDecoder().decode(next.value)
    }
  })()
  try {
    await expect.poll(() => closed).toBe(true)
    expect(text).toContain('event: snapshot')
    expect(text).toContain('event: end')
    expect(text).toContain('"status":"cancelled"')
  } finally {
    await reader.cancel()
    await reading
  }
})

it('distinguishes oversized files from invalid files before dispatch', async () => {
  const fixture = await importAccount()
  dispose = fixture.dispose
  const fetch = vi.fn()
  const namespace = { idFromName: (name: string) => name, get: () => ({ fetch }) }
  const result = await postJob(
    fixture.db,
    { type: 'pdf', content: Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64') },
    undefined,
    {},
    { IMPORT_JOBS: namespace },
  )
  expect(result.status).toBe(413)
  expect(result.body.code).toBe('PAYLOAD_TOO_LARGE')
  expect(fetch).not.toHaveBeenCalled()
})

it('the unbound events endpoint sends a final snapshot and end with the same cache contract', async () => {
  const fixture = await importAccount()
  dispose = fixture.dispose
  const batchId = crypto.randomUUID()
  await createProcessingBatch(
    fixture.db,
    {
      id: batchId,
      userId: 'u1',
      sourceType: 'text',
      sourceLabel: null,
      operationId: 'unbound-events-0001',
    },
    new Date(),
  )
  await cancelBatch(fixture.db, 'u1', batchId, new Date())
  const { onRequestGet } = await import('../api/import/batches/[id]/events')
  const response = await onRequestGet({
    request: new Request(`https://kuuki.test/api/import/batches/${batchId}/events`),
    env: { DB: fixture.db },
    data: { user: { id: 'u1' } },
    params: { id: batchId },
  } as never)
  expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform')
  const text = await response.text()
  expect(text).toContain('event: snapshot')
  expect(text).toContain('event: end')
  expect(text).toContain('"status":"cancelled"')
  expect(text).not.toMatch(/^id:/m)
})

it('logs one validation summary per job and per-row logs only for rejected rows', async () => {
  const fixture = await importAccount()
  dispose = fixture.dispose
  const batchId = crypto.randomUUID()
  await createProcessingBatch(
    fixture.db,
    {
      id: batchId,
      userId: 'u1',
      sourceType: 'text',
      sourceLabel: null,
      operationId: 'log-summary-op-0001',
    },
    new Date(),
  )
  provider.stream.mockResolvedValueOnce(
    (async function* () {
      yield {
        text: providerText([
          providerFlight(),
          providerFlight({ flight_number: '8' }),
          { origin: 'X', destination: 'LHR', airline_iata: 'BA' },
        ]),
      }
    })(),
  )
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  try {
    const pending: Promise<unknown>[] = []
    const state = {
      storage: {
        get: async () => undefined,
        put: async () => undefined,
        setAlarm: async () => undefined,
        deleteAlarm: async () => undefined,
        deleteAll: async () => undefined,
      },
      blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn(),
      waitUntil: (work: Promise<unknown>) => pending.push(work),
    } as unknown as DurableObjectState
    const job = new ImportJob(state, { DB: fixture.db, GEMINI_API_KEY: 'fake' })
    expect(
      (
        await job.fetch(
          new Request('https://import.internal/start', {
            method: 'POST',
            body: JSON.stringify({
              fence: { userId: 'u1', batchId, generation: 1 },
              source: { type: 'text', content: 'private fixture' },
            }),
          }),
        )
      ).status,
    ).toBe(202)
    await Promise.all(pending)
    const events = log.mock.calls.map(([line]) => JSON.parse(String(line)) as { event: string })
    expect(events.filter((entry) => entry.event === 'validation_complete')).toEqual([
      { event: 'validation_complete', valid: 2, total: 3, rejected: 1 },
    ])
    expect(events.filter((entry) => entry.event === 'flight_rejected')).toEqual([
      { event: 'flight_rejected', index: 2 },
    ])
  } finally {
    log.mockRestore()
  }
  expect(
    await fixture.db
      .prepare('SELECT status,error_code FROM import_batches WHERE id = ?')
      .bind(batchId)
      .first(),
  ).toEqual({ status: 'partial', error_code: 'ROWS_REJECTED' })
})

it.each(['review', 'partial', 'failed', 'completed', 'cancelled'])(
  'reports no cancellation for a batch already %s',
  async (status) => {
    const fixture = await importAccount()
    dispose = fixture.dispose
    const batchId = crypto.randomUUID()
    await createProcessingBatch(
      fixture.db,
      {
        id: batchId,
        userId: 'u1',
        sourceType: 'text',
        sourceLabel: null,
        operationId: 'finished-op-0001',
      },
      new Date(),
    )
    await fixture.db
      .prepare('UPDATE import_batches SET status = ? WHERE id = ?')
      .bind(status, batchId)
      .run()
    const { onRequestPost } = await import('../api/import/batches/[id]/cancel')
    const { csrfRequest } = await import('./harness')
    const fetch = vi.fn()
    const response = await onRequestPost({
      request: csrfRequest(`/api/import/batches/${batchId}/cancel`, 'POST'),
      env: {
        DB: fixture.db,
        IMPORT_JOBS: { idFromName: (name: string) => name, get: () => ({ fetch }) },
      },
      data: { user: { id: 'u1' } },
      params: { id: batchId },
    } as never)
    expect(await response.json()).toEqual({ cancelled: false, status })
    expect(fetch).not.toHaveBeenCalled()
    expect(
      await fixture.db
        .prepare('SELECT generation,status FROM import_batches WHERE id = ?')
        .bind(batchId)
        .first(),
    ).toEqual({ generation: 1, status })
  },
)
it('keeps cancelled review rows discoverable in the owned queue until dismissed', async () => {
  const fixture = await importAccount()
  dispose = fixture.dispose
  const { persistDraftRows } = await import('../api/_services/importDrafts')
  const { rowOf } = await import('../api/_services/importJob')
  const { readAwaitingQueue } = await import('../api/_services/queue')
  const batchId = crypto.randomUUID()
  await createProcessingBatch(
    fixture.db,
    {
      id: batchId,
      userId: 'u1',
      sourceType: 'text',
      sourceLabel: null,
      operationId: 'queue-cancel-0001',
    },
    new Date(),
  )
  await persistDraftRows(
    fixture.db,
    { userId: 'u1', batchId, generation: 1 },
    [rowOf(providerFlight()), rowOf(providerFlight())],
    null,
  )
  await cancelBatch(fixture.db, 'u1', batchId)
  expect(await readAwaitingQueue(fixture.db, 'u1')).toMatchObject({
    draftRowCount: 2,
    drafts: [{ batchId, status: 'cancelled', reviewRowCount: 2 }],
  })
  expect((await readAwaitingQueue(fixture.db, 'u2')).drafts).toEqual([])
  await fixture.db
    .prepare("UPDATE import_drafts SET status = 'dismissed' WHERE batch_id = ?")
    .bind(batchId)
    .run()
  expect(await readAwaitingQueue(fixture.db, 'u1')).toMatchObject({ draftRowCount: 0, drafts: [] })
})
it('deleting an account aborts its active provider after reauthentication and the durable deletion fence', async () => {
  const fixture = await importAccount()
  dispose = fixture.dispose
  const { hashPassword } = await import('../api/_lib/crypto')
  const { onRequestDelete } = await import('../api/auth/account')
  const { csrfRequest } = await import('./harness')
  const secret = 'synthetic-pepper'
  await fixture.db
    .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(await hashPassword('password-123', secret), 'u1')
    .run()
  const batchId = crypto.randomUUID()
  await createProcessingBatch(
    fixture.db,
    {
      id: batchId,
      userId: 'u1',
      sourceType: 'text',
      sourceLabel: null,
      operationId: 'delete-active-0001',
    },
    new Date(),
  )
  const pending: Promise<unknown>[] = []
  const state = {
    storage: {
      get: async () => undefined,
      put: async () => undefined,
      setAlarm: async () => undefined,
      deleteAlarm: async () => undefined,
      deleteAll: async () => undefined,
    },
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn(),
    waitUntil: (work: Promise<unknown>) => pending.push(work),
  } as unknown as DurableObjectState
  const job = new ImportJob(state, { DB: fixture.db, GEMINI_API_KEY: 'fake' })
  await job.fetch(
    new Request('https://import.internal/start', {
      method: 'POST',
      body: JSON.stringify({
        fence: { userId: 'u1', batchId, generation: 1 },
        source: { type: 'text', content: 'private fixture' },
      }),
    }),
  )
  await vi.waitFor(() => expect(provider.stream).toHaveBeenCalledTimes(1))
  const signal = provider.stream.mock.calls[0][0].config.abortSignal
  const idFromName = vi.fn((name: string) => name)
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    expect(
      await fixture.db.prepare('SELECT id FROM users WHERE id = ?').bind('u1').first(),
    ).toBeNull()
    return job.fetch(new Request(url, init))
  })
  const call = (password: string) =>
    onRequestDelete({
      request: csrfRequest('/api/auth/account', 'DELETE', { password }),
      env: {
        DB: fixture.db,
        AUTH_SECRET: secret,
        IMPORT_JOBS: { idFromName, get: () => ({ fetch }) },
      },
      data: { user: { id: 'u1' } },
    } as never)
  try {
    expect((await call('wrong-password')).status).toBe(401)
    expect(fetch).not.toHaveBeenCalled()
    expect(signal.aborted).toBe(false)
    expect((await call('password-123')).status).toBe(200)
    expect(idFromName).toHaveBeenCalledWith(`u1:${batchId}`)
    expect(signal.aborted).toBe(true)
    expect(
      await fixture.db.prepare('SELECT id FROM users WHERE id = ?').bind('u2').first(),
    ).not.toBeNull()
  } finally {
    await job.fetch(new Request('https://import.internal/abort', { method: 'POST' }))
    await Promise.all(pending)
  }
})

it('captures a job submitted immediately before the atomic account deletion, then aborts it', async () => {
  const fixture = await importAccount()
  dispose = fixture.dispose
  const { hashPassword } = await import('../api/_lib/crypto')
  const { onRequestDelete } = await import('../api/auth/account')
  const { csrfRequest } = await import('./harness')
  const { instrumentDb, hasSql } = await import('./db-hooks')
  const secret = 'synthetic-pepper'
  await fixture.db
    .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(await hashPassword('password-123', secret), 'u1')
    .run()
  const batchId = crypto.randomUUID()
  const { db, hooks } = instrumentDb(fixture.db)
  hooks.beforeBatch(hasSql('DELETE FROM users'), async () => {
    expect(
      await createProcessingBatch(
        fixture.db,
        {
          id: batchId,
          userId: 'u1',
          sourceType: 'text',
          sourceLabel: null,
          operationId: 'delete-race-0001',
        },
        new Date(),
      ),
    ).toBe(true)
  })
  const idFromName = vi.fn((name: string) => name)
  const fetch = vi.fn(async () => {
    expect(
      await fixture.db.prepare('SELECT id FROM import_batches WHERE id = ?').bind(batchId).first(),
    ).toBeNull()
    return new Response(null, { status: 204 })
  })
  const response = await onRequestDelete({
    request: csrfRequest('/api/auth/account', 'DELETE', { password: 'password-123' }),
    env: { DB: db, AUTH_SECRET: secret, IMPORT_JOBS: { idFromName, get: () => ({ fetch }) } },
    data: { user: { id: 'u1' } },
  } as never)
  expect(response.status).toBe(200)
  expect(idFromName).toHaveBeenCalledWith(`u1:${batchId}`)
  expect(fetch).toHaveBeenCalledWith('https://import.internal/abort', { method: 'POST' })
})

it('persists complete fitting rows from one oversized provider chunk and ends partial with OUTPUT_LIMIT', async () => {
  const fixture = await importAccount()
  dispose = fixture.dispose
  const batchId = crypto.randomUUID()
  await createProcessingBatch(
    fixture.db,
    {
      id: batchId,
      userId: 'u1',
      sourceType: 'text',
      sourceLabel: null,
      operationId: 'crossing-output-0001',
    },
    new Date(),
  )
  provider.stream.mockResolvedValueOnce(
    (async function* () {
      yield {
        text: providerText(
          [
            providerFlight(),
            providerFlight({ flight_number: '8' }),
            providerFlight({ flight_number: '9' }),
          ],
          { raw_text: 'x'.repeat(1024 * 1024) },
        ),
      }
    })(),
  )
  const pending: Promise<unknown>[] = []
  const state = {
    storage: {
      get: async () => undefined,
      put: async () => undefined,
      setAlarm: async () => undefined,
      deleteAlarm: async () => undefined,
      deleteAll: async () => undefined,
    },
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn(),
    waitUntil: (work: Promise<unknown>) => pending.push(work),
  } as unknown as DurableObjectState
  const job = new ImportJob(state, { DB: fixture.db, GEMINI_API_KEY: 'fake' })
  await job.fetch(
    new Request('https://import.internal/start', {
      method: 'POST',
      body: JSON.stringify({
        fence: { userId: 'u1', batchId, generation: 1 },
        source: { type: 'text', content: 'private fixture' },
      }),
    }),
  )
  await Promise.all(pending)
  expect(
    await fixture.db
      .prepare('SELECT status,error_code FROM import_batches WHERE id = ?')
      .bind(batchId)
      .first(),
  ).toEqual({ status: 'partial', error_code: 'OUTPUT_LIMIT' })
  expect(
    (
      await fixture.db
        .prepare('SELECT ordinal,status FROM import_drafts WHERE batch_id = ? ORDER BY ordinal')
        .bind(batchId)
        .all()
    ).results,
  ).toEqual([0, 1, 2].map((ordinal) => ({ ordinal, status: 'review' })))
})

describe('bound job draft caps by source', () => {
  const list = (count: number) =>
    [
      'KUUKI FLIGHTS v2',
      ...Array.from(
        { length: count },
        (_, index) =>
          `${new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10)} | JFK → LHR | British Airways BA ${index + 1}`,
      ),
    ].join('\n')

  async function start(source: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    const fixture = await importAccount()
    dispose = fixture.dispose
    const batchId = crypto.randomUUID()
    await createProcessingBatch(
      fixture.db,
      {
        id: batchId,
        userId: 'u1',
        sourceType: 'text',
        sourceLabel: null,
        operationId: `cap-${batchId}`,
      },
      new Date(),
    )
    const pending: Promise<unknown>[] = []
    const state = {
      storage: {
        get: async () => undefined,
        put: async () => undefined,
        setAlarm: async () => undefined,
        deleteAlarm: async () => undefined,
        deleteAll: async () => undefined,
      },
      blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn(),
      waitUntil: (work: Promise<unknown>) => pending.push(work),
    } as unknown as DurableObjectState
    const job = new ImportJob(state, { DB: fixture.db, GEMINI_API_KEY: 'fake' })
    await job.fetch(
      new Request('https://import.internal/start', {
        method: 'POST',
        body: JSON.stringify({
          fence: { userId: 'u1', batchId, generation: 1 },
          source,
          ...extra,
        }),
      }),
    )
    await Promise.all(pending)
    return { fixture, batchId }
  }

  async function run(content: string) {
    const { fixture, batchId } = await start({ type: 'text', content })
    return {
      batch: await fixture.db
        .prepare('SELECT status,error_code FROM import_batches WHERE id = ?')
        .bind(batchId)
        .first(),
      drafts: (
        await fixture.db
          .prepare('SELECT COUNT(*) AS n FROM import_drafts WHERE batch_id = ?')
          .bind(batchId)
          .first<{ n: number }>()
      )?.n,
    }
  }

  it('keeps 450 locally parsed rows without a provider call', async () => {
    expect(await run(list(450))).toEqual({
      batch: { status: 'review', error_code: null },
      drafts: 450,
    })
    expect(provider.stream).not.toHaveBeenCalled()
  })

  it('truncates 600 locally parsed rows at 500', async () => {
    expect(await run(list(600))).toEqual({
      batch: { status: 'partial', error_code: 'ROWS_TRUNCATED' },
      drafts: 500,
    })
    expect(provider.stream).not.toHaveBeenCalled()
  })

  it('truncates a long compact paste at 500 without tripping the provider output cap', async () => {
    // About 92,000 characters of input: under MAX_TEXT_LENGTH, but over a megabyte once every row is serialized.
    const compact = [
      'KUUKI FLIGHTS v2',
      ...Array.from(
        { length: 4000 },
        (_, index) =>
          `${new Date(Date.UTC(2000, 0, 1 + index)).toISOString().slice(0, 10)} | JFK → LHR`,
      ),
    ].join('\n')
    expect(compact.length).toBeLessThan(100_000)
    expect(await run(compact)).toEqual({
      batch: { status: 'partial', error_code: 'ROWS_TRUNCATED' },
      drafts: 500,
    })
  })

  it('truncates 150 model-extracted rows at 100', async () => {
    provider.stream.mockResolvedValueOnce(
      (async function* () {
        yield {
          text: providerText(
            Array.from({ length: 150 }, (_, index) =>
              providerFlight({ flight_number: String(index) }),
            ),
          ),
        }
      })(),
    )
    expect(await run('Flight details')).toEqual({
      batch: { status: 'partial', error_code: 'ROWS_TRUNCATED' },
      drafts: 100,
    })
  })

  it('persists the flown requirement on every row the bound job writes', async () => {
    provider.stream.mockResolvedValueOnce(
      (async function* () {
        yield { text: providerText([providerFlight(), providerFlight({ origin: 'LHR' })]) }
      })(),
    )
    const { fixture, batchId } = await start(
      { type: 'pdf', content: 'JVBERi0x' },
      { requireFlownConfirmation: true },
    )
    const rows = await fixture.db
      .prepare('SELECT fields_json FROM import_drafts WHERE batch_id = ? ORDER BY ordinal')
      .bind(batchId)
      .all<{ fields_json: string }>()
    expect(rows.results.map((row) => JSON.parse(row.fields_json).flown_required)).toEqual([
      true,
      true,
    ])
  })
})
