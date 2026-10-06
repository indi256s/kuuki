import { afterEach, beforeAll, expect, it } from 'vitest'
import type { Miniflare as Runtime, MiniflareOptions } from 'miniflare'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { applyMigrations } from '../../scripts/_migrations'
import { csrfRequest } from './harness'
import { providerFlight } from './import-fixture'

// Wrangler's installed runtime supports the required keep-alive date; the root Miniflare is older.
const require = createRequire(import.meta.url)
type Runtime5 = Runtime
const { Miniflare, convertV4MiniflareOptions } = createRequire(require.resolve('wrangler'))('miniflare') as {
  Miniflare: new (options: MiniflareOptions) => Runtime5
  convertV4MiniflareOptions: (options: MiniflareOptions) => MiniflareOptions
}
let bundle: string
beforeAll(async () => {
  const esbuild = createRequire(require.resolve('wrangler'))('esbuild')
  const result = await esbuild.build({ entryPoints: ['functions/test/import-worker-fixture.ts'], bundle: true, write: false,
    format: 'esm', platform: 'browser', target: 'esnext', alias: { '@google/genai': './functions/test/import-fake-provider.ts' } })
  bundle = result.outputFiles[0].text
})
let mf: Runtime5 | undefined
let persistence: string | undefined
let feed: ReadableStreamDefaultController<Uint8Array>
const encode = new TextEncoder()
async function dispatch(path: string, method = 'GET', body?: unknown, user = 'u1', signal?: AbortSignal) {
  const request = csrfRequest(path, method, body, { 'X-Test-User': user })
  return mf!.dispatchFetch(request.url, { method, signal, headers: Object.fromEntries(request.headers), ...(body === undefined ? {} : { body: await request.text() }) })
}
async function runtime(failAbort = false) {
  let calls = 0; let providerInput: Record<string, any> | undefined
  mkdirSync('.wrangler', { recursive: true })
  persistence = mkdtempSync('.wrangler/t11-runtime-')
  const options = { ...convertV4MiniflareOptions({ name: 'import-test', modules: true, script: bundle, compatibilityDate: '2026-10-01', compatibilityFlags: ['enable_request_signal', 'request_signal_passthrough'],
    d1Databases: { DB: 'import-runtime-test' },
    durableObjects: { IMPORT_JOBS: { className: 'TestImportJob', useSQLite: true } },
    unsafeDirectSockets: [{ host: '127.0.0.1', port: 0 }],
    bindings: { GEMINI_API_KEY: 'fake', GEMINI_IMPORT_MODEL: 'fixture-model', FAIL_ABORT: failAbort },
    serviceBindings: { FAKE: async (request: { json(): Promise<unknown> }) => {
      calls++; providerInput = await request.json() as Record<string, any>
      return new Response(new ReadableStream<Uint8Array>({ start(controller) { feed = controller } }))
    } },
  }), resourcePersistencePath: persistence }
  mf = new Miniflare(options)
  const db = await mf.getD1Database('DB'); await applyMigrations(db)
  for (const id of ['u1', 'u2']) await db.prepare('INSERT INTO users(id,email,password_hash) VALUES(?,?,?)').bind(id, `${id}@example.test`, 'hash').run()
  const chunk = (value: Record<string, unknown>) => feed.enqueue(encode.encode(JSON.stringify(value) + '\n'))
  const send = (text: string) => chunk({ text })
  const start = async (type = 'text', content = 'private fixture input') => {
    const response = await dispatch('/api/import/jobs', 'POST', { type, content, submissionOperationId: 'runtime-op-0001' })
    expect(response.status).toBe(202)
    const { batchId } = await response.json() as { batchId: string }
    await expect.poll(() => calls).toBe(1)
    return batchId
  }
  const batch = (id: string) => db.prepare('SELECT status,stage,sequence,generation,error_code,retry_after FROM import_batches WHERE id = ?').bind(id).first<Record<string, any>>()
  const rows = (id: string) => db.prepare('SELECT id,ordinal,fields_json FROM import_drafts WHERE batch_id = ? ORDER BY ordinal').bind(id).all<{ id: string; ordinal: number; fields_json: string }>()
  const restart = async () => {
    await mf!.dispose()
    mf = new Miniflare(options)
    return mf.getD1Database('DB')
  }
  return { db, send, chunk, start, batch, rows, restart, calls: () => calls, input: () => providerInput }
}
afterEach(async () => { await mf?.dispose(); mf = undefined; if (persistence) rmSync(persistence, { recursive: true, force: true }); persistence = undefined })
async function readRow(reader: ReadableStreamDefaultReader<Uint8Array>) {
  let pending = ''; const decoder = new TextDecoder()
  for (;;) {
    const next = await reader.read()
    if (next.done) throw new Error('Events ended before a row notification')
    pending += decoder.decode(next.value)
    for (const message of pending.split('\n\n').slice(0, -1)) {
      const data = message.split('\n').find(line => line.startsWith('data: '))
      if (!data) continue
      const event = JSON.parse(data.slice(6)) as { sequence: number; rowIds: string[] }
      if (event.rowIds.length) return event
    }
    pending = pending.split('\n\n').at(-1)!
  }
}

it('streams structured text through the real job without a provider call and keeps partial drafts correctable', async () => {
  const { batch, rows, calls } = await runtime()
  const response = await dispatch('/api/import/jobs', 'POST', { type: 'text', submissionOperationId: 'local-list-0001', content: [
    '2026-03-10 | JFK → LHR | BA178 | 19:00 → 07:00',
    'Undated | TBS → IST | TK379 [partial booking evidence]',
    '2025-12-03 (calendar entry) [calendar only]',
  ].join('\n') })
  expect(response.status).toBe(202)
  const { batchId } = await response.json() as { batchId: string }
  await expect.poll(async () => (await batch(batchId))?.status).toBe('partial')
  expect(await batch(batchId)).toMatchObject({ error_code: 'ROWS_REJECTED', stage: 'review_ready' })
  expect(calls()).toBe(0)
  expect((await rows(batchId)).results.map(row => JSON.parse(row.fields_json))).toMatchObject([
    { date: '2026-03-10', origin: 'JFK', destination: 'LHR', flight_number: '178' },
    { date: '', origin: 'TBS', destination: 'IST', flight_number: '379' },
  ])
  const snapshot = await dispatch(`/api/import/batches/${batchId}`)
  expect((await snapshot.json() as { drafts: Array<{ selected: boolean }> }).drafts.map(d => d.selected)).toEqual([true, false])
})

it('persists before notify, keeps provider I/O alive beyond 30 s without subscribers, then resumes', async () => {
  const { db, send, start, batch, rows, calls } = await runtime()
  const id = await start() // The accepting HTTP request has finished.
  const disconnectedClient = new AbortController()
  const firstEvents = await globalThis.fetch(new URL(`/api/import/batches/${id}/events?after=0`, await mf!.unsafeGetDirectURL('import-test')), { signal: disconnectedClient.signal })
  const reader = firstEvents.body!.getReader()
  send('{"flights":[' + JSON.stringify(providerFlight()))
  const first = await readRow(reader)
  expect((await rows(id)).results.map(row => row.id)).toEqual(first.rowIds)
  expect((await batch(id))?.sequence).toBe(first.sequence)
  disconnectedClient.abort()
  await reader.cancel().catch(() => undefined) // Real HTTP disconnect; comment frames flush cancellation within 5 s.
  await new Promise(resolve => setTimeout(resolve, 36_100))
  send(',' + JSON.stringify(providerFlight({ origin: 'TBS', destination: 'IST' })))
  await expect.poll(async () => (await rows(id)).results.length).toBe(2)
  const resumedClient = new AbortController()
  const resumed = await globalThis.fetch(new URL(`/api/import/batches/${id}/events?after=${first.sequence}`, await mf!.unsafeGetDirectURL('import-test')), { signal: resumedClient.signal })
  const newReader = resumed.body!.getReader(); const second = await readRow(newReader)
  expect(second.sequence).toBe(first.sequence + 1)
  expect((await rows(id)).results[1].id).toBe(second.rowIds[0])
  resumedClient.abort(); await newReader.cancel().catch(() => undefined)
  const replay = await dispatch('/api/import/jobs', 'POST', { type: 'text', content: 'different replay input', submissionOperationId: 'runtime-op-0001' })
  expect(await replay.json()).toEqual({ batchId: id }); expect(calls()).toBe(1)
  send(']}'); feed.close()
  await expect.poll(async () => (await batch(id))?.status).toBe('review')
  const snapshot = await (await dispatch(`/api/import/batches/${id}`)).json() as { drafts: unknown[] }
  expect(snapshot.drafts).toHaveLength(2)
  expect((await db.prepare('SELECT COUNT(*) AS n FROM flights').first())?.n).toBe(0)
}, 60_000)

it('restart keeps extracted rows, requests reupload, stores only its fence and never restarts the provider', async () => {
  const { send, start, rows, calls, restart } = await runtime(); const id = await start()
  send('{"flights":[' + JSON.stringify(providerFlight({ raw_text: 'private response snippet', secret: 'private response' })))
  await expect.poll(async () => (await rows(id)).results.length).toBe(1)
  const namespace = await mf!.getDurableObjectNamespace('IMPORT_JOBS')
  const stub = namespace.get(namespace.idFromName(`u1:${id}`))
  const metadata = await (await stub.fetch('https://import.internal/__test/storage')).json()
  expect(metadata).toEqual({ fence: { userId: 'u1', batchId: id, generation: 1 } })
  const recoveredDb = await restart()
  const response = await dispatch(`/api/import/batches/${id}/events?after=0`)
  expect(await response.text()).toContain('"reupload":true')
  expect(await recoveredDb.prepare('SELECT status,error_code,generation FROM import_batches WHERE id = ?').bind(id).first()).toMatchObject({ status: 'partial', error_code: 'JOB_INTERRUPTED', generation: 2 })
  const recoveredRows = await recoveredDb.prepare('SELECT fields_json FROM import_drafts WHERE batch_id = ?').bind(id).all<{ fields_json: string }>()
  expect(recoveredRows.results).toHaveLength(1)
  expect(recoveredRows.results[0].fields_json).not.toMatch(/private|raw_text|secret/)
  expect(calls()).toBe(1)
})

it.each(['cancel', 'discard', 'account deletion'])('%s fences provider callbacks and explicit late writes', async action => {
  const { send, start, batch, rows } = await runtime(); const id = await start()
  send('{"flights":[' + JSON.stringify(providerFlight()))
  await expect.poll(async () => (await rows(id)).results.length).toBe(1)
  if (action === 'cancel') {
    expect((await dispatch(`/api/import/batches/${id}/cancel`, 'POST')).status).toBe(200)
    expect(await batch(id)).toMatchObject({ status: 'cancelled', generation: 2 })
  } else if (action === 'discard') expect((await dispatch(`/api/import/batches/${id}`, 'DELETE')).status).toBe(200)
  else expect((await dispatch('/__test/delete-account', 'POST')).status).toBe(204)
  // This provider deliberately ignores the abort signal and delivers a late chunk.
  try { send(',' + JSON.stringify(providerFlight({ origin: 'TBS' })) + ']}'); feed.close() } catch {}
  const late = await dispatch('/__test/late-write', 'POST', { batchId: id, flight: providerFlight({ origin: 'DXB' }) })
  expect(await late.json()).toBeNull()
  expect((await rows(id)).results).toHaveLength(action === 'cancel' ? 1 : 0)
  if (action !== 'cancel') expect(await batch(id)).toBeNull()
})

it.each([
  ['truncated JSON', '{"flights":[' + JSON.stringify(providerFlight()) + ',{"origin":', 'PROVIDER_INVALID_RESPONSE', 1],
  ['malformed JSON', '{"flights":[' + JSON.stringify(providerFlight()) + ',oops]}', 'PROVIDER_INVALID_RESPONSE', 1],
  ['duplicate chunk', '{"flights":[' + JSON.stringify(providerFlight()) + '{"flights":[]}', 'PROVIDER_INVALID_RESPONSE', 1],
  ['zero results', '{"flights":[]}', 'NO_FLIGHTS_FOUND', 0],
  ['invalid rows', '{"flights":[null,{}]}', 'NO_FLIGHTS_FOUND', 0],
] as const)('keeps honest bounded results for %s', async (_label, text, code, count) => {
  const { send, start, batch, rows } = await runtime(); const id = await start()
  send(text); feed.close()
  await expect.poll(async () => (await batch(id))?.error_code).toBe(code)
  expect((await batch(id))?.status).toBe(count ? 'partial' : 'failed')
  expect((await rows(id)).results).toHaveLength(count)
})

it('completion reconciles original ordinals and preserves edits rather than inserting rows twice', async () => {
  const { db, send, start, batch, rows } = await runtime(); const id = await start()
  send('{"flights":[null,' + JSON.stringify(providerFlight()))
  await expect.poll(async () => (await rows(id)).results.length).toBe(1)
  const first = (await rows(id)).results[0]
  expect(first.ordinal).toBe(1)
  await db.prepare("UPDATE import_drafts SET fields_json = json_set(fields_json,'$.flight_number','999'), edited=1, version=version+1 WHERE id = ?").bind(first.id).run()
  send(',' + JSON.stringify(providerFlight({ origin: 'TBS' })) + '],"raw_text":"private complete response"}'); feed.close()
  await expect.poll(async () => (await batch(id))?.status).toBe('partial')
  expect((await batch(id))?.error_code).toBe('ROWS_REJECTED')
  const result = (await rows(id)).results
  expect(result.map(row => row.ordinal)).toEqual([1, 2]); expect(result[0].id).toBe(first.id)
  expect(JSON.parse(result[0].fields_json).flight_number).toBe('999')
})

it('bounds output and keeps rows persisted before an oversized tail', async () => {
  const { send, start, batch, rows } = await runtime(); const id = await start()
  send('{"flights":[' + JSON.stringify(providerFlight()))
  await expect.poll(async () => (await rows(id)).results.length).toBe(1)
  send('x'.repeat(1024 * 1024)); feed.close()
  await expect.poll(async () => (await batch(id))?.error_code).toBe('OUTPUT_LIMIT')
  expect((await batch(id))?.status).toBe('partial'); expect((await rows(id)).results).toHaveLength(1)
})

it('bounds drafts and event replay, instructs snapshots on gaps and scopes foreign ids', async () => {
  const { db, send, start, batch, rows } = await runtime(); const id = await start()
  send('{"flights":[' + Array.from({ length: 105 }, () => JSON.stringify(providerFlight())).join(',') + ']}'); feed.close()
  await expect.poll(async () => (await batch(id))?.status, { timeout: 10_000 }).toBe('partial')
  expect((await batch(id))?.error_code).toBe('ROWS_TRUNCATED'); expect((await rows(id)).results).toHaveLength(100)
  const response = await dispatch(`/api/import/batches/${id}/events?after=0`)
  const replay = await response.text()
  expect(replay.match(/event: rows/g)).toHaveLength(103)
  expect(replay).toContain('event: end')
  // A revision owned by another mutation cannot be replayed from the DO's notifications.
  await db.prepare('UPDATE import_batches SET sequence = sequence + 2 WHERE id = ?').bind(id).run()
  const gap = await dispatch(`/api/import/batches/${id}/events?after=${(await batch(id))!.sequence - 1}`)
  expect(await gap.text()).toContain('event: snapshot')
  const missing = await dispatch('/api/import/batches/missing/events'); const foreign = await dispatch(`/api/import/batches/${id}/events`, 'GET', undefined, 'u2')
  expect(foreign.status).toBe(404); expect(await foreign.text()).toBe(await missing.text())
  expect((await dispatch(`/api/import/batches/${id}/events?after=-1`)).status).toBe(400)
})

it.each([[429, 'PROVIDER_QUOTA'], [404, 'MODEL_UNAVAILABLE'], [503, 'PROVIDER_ERROR'], ['timed out', 'PROVIDER_TIMEOUT']] as const)(
  'distinguishes provider failure %s without inventing a quota reset', async (failure, code) => {
    const { chunk, start, batch } = await runtime(); const id = await start()
    chunk(typeof failure === 'number' ? { status: failure } : { error: failure }); feed.close()
    await expect.poll(async () => (await batch(id))?.error_code).toBe(code)
    expect((await batch(id))?.retry_after).toBeNull()
  },
)

it.each([['text', 'synthetic document', undefined], ['pdf', 'JVBERi0x', 'application/pdf'], ['image', 'iVBORw0KGgo=', 'image/png']] as const)(
  'uses the configured streaming model, schema and existing %s input contract', async (type, content, mime) => {
    const { send, start, batch, input } = await runtime(); const id = await start(type, content)
    expect(input()).toMatchObject({ model: 'fixture-model', timeout: 90_000, mime: 'application/json', schema: { properties: { flights: expect.any(Object) } } })
    if (mime) expect(input()!.contents[1]).toMatchObject({ inlineData: { mimeType: mime } })
    else expect(input()!.contents[1]).toContain(content)
    send('{"flights":[]}'); feed.close()
    await expect.poll(async () => (await batch(id))?.error_code).toBe('NO_FLIGHTS_FOUND')
  },
)
it('concurrent duplicate submissions and direct starts still make exactly one provider call', async () => {
  const { send, calls, batch } = await runtime()
  const body = { type: 'text', content: 'private input', submissionOperationId: 'runtime-op-0001' }
  const responses = await Promise.all([dispatch('/api/import/jobs', 'POST', body), dispatch('/api/import/jobs', 'POST', body)])
  expect(responses.map(response => response.status)).toEqual([202, 202])
  const accepted = await Promise.all(responses.map(response => response.json() as Promise<{ batchId: string }>))
  expect(accepted[0]).toEqual(accepted[1])
  await expect.poll(calls).toBe(1)
  const id = accepted[0].batchId
  const namespace = await mf!.getDurableObjectNamespace('IMPORT_JOBS')
  const duplicate = await namespace.get(namespace.idFromName(`u1:${id}`)).fetch('https://import.internal/start', {
    method: 'POST', body: JSON.stringify({ fence: { batchId: id, generation: 1, userId: 'u1' }, source: { type: 'text', content: 'changed input' } }),
  })
  expect(duplicate.status).toBe(202); expect(calls()).toBe(1)
  send('{"flights":[]}'); feed.close()
  await expect.poll(async () => (await batch(id))?.status).toBe('failed')
})
it('a duplicate whose handshake meets an already finished job replays the batch instead of reporting an outage', async () => {
  const { db, batch, calls } = await runtime()
  const response = await dispatch('/__test/racing-duplicate', 'POST', { type: 'text', content: 'private input', submissionOperationId: 'runtime-op-0001' })
  expect(response.status).toBe(202)
  const { batchId } = await response.json() as { batchId: string }
  expect(await batch(batchId)).toMatchObject({ status: 'review', error_code: null })
  expect((await db.prepare('SELECT COUNT(*) AS n FROM import_batches').first())?.n).toBe(1)
  expect(calls()).toBe(0) // the refused handshake never reached the provider
})
it('enforces the shared application rate budget before dispatch and separates it from provider quota', async () => {
  const { db, calls } = await runtime()
  await db.prepare('INSERT INTO auth_rate_limits(key,count,expires_at) VALUES(?,?,?)')
    .bind('import-parse:u1', 20, Math.floor(Date.now() / 1000) + 3600).run()
  const response = await dispatch('/api/import/jobs', 'POST', { type: 'text', content: 'private input', submissionOperationId: 'rate-limited-op' })
  expect(response.status).toBe(429); expect(await response.json()).toMatchObject({ code: 'RATE_LIMITED' })
  expect(calls()).toBe(0)
  expect((await db.prepare('SELECT COUNT(*) AS n FROM import_batches').first())?.n).toBe(0)
})
it('cancel checks CSRF and ownership, and foreign ids have the same response as missing ids', async () => {
  const { send, start, batch } = await runtime(); const id = await start()
  const missing = await dispatch('/api/import/batches/missing/cancel', 'POST')
  const foreign = await dispatch(`/api/import/batches/${id}/cancel`, 'POST', undefined, 'u2')
  expect(foreign.status).toBe(404); expect(await foreign.text()).toBe(await missing.text())
  const withoutCsrf = await mf!.dispatchFetch(`https://kuuki.test/api/import/batches/${id}/cancel`, { method: 'POST' })
  expect(withoutCsrf.status).toBe(403)
  expect((await batch(id))?.status).toBe('processing')
  send('{"flights":[]}'); feed.close()
  await expect.poll(async () => (await batch(id))?.status).toBe('failed')
})
it('bounds simultaneous event subscribers and releases the slot on disconnect', async () => {
  const { send, start, batch } = await runtime(); const id = await start()
  const clients = []
  for (let index = 0; index < 8; index++) {
    const controller = new AbortController()
    clients.push({ controller, response: await globalThis.fetch(new URL(`/api/import/batches/${id}/events`, await mf!.unsafeGetDirectURL('import-test')), { signal: controller.signal }) })
  }
  const ninth = await dispatch(`/api/import/batches/${id}/events`)
  expect(ninth.status).toBe(429); expect(await ninth.json()).toMatchObject({ code: 'IMPORT_SUBSCRIBER_LIMIT' })
  for (const client of clients) { client.controller.abort(); await client.response.body!.cancel().catch(() => undefined) }
  await expect.poll(async () => {
    const retry = await dispatch(`/api/import/batches/${id}/events`)
    if (retry.ok) await retry.body!.cancel()
    return retry.status
  }, { timeout: 7_000 }).toBe(200)
  send('{"flights":[]}'); feed.close()
  await expect.poll(async () => (await batch(id))?.status).toBe('failed')
}, 10_000)

it('finishes an airline-less row as review with the placeholder defaults', async () => {
  const { db, send, start, batch, rows } = await runtime(); const id = await start()
  send('{"flights":[' + JSON.stringify(providerFlight({ airline_iata: '' })) + ']}'); feed.close()
  await expect.poll(async () => (await batch(id))?.status).toBe('review')
  expect((await batch(id))?.error_code).toBeNull()
  const row = (await rows(id)).results[0]
  expect(JSON.parse(row.fields_json).airline_iata).toBe('ZZ')
  expect(await db.prepare('SELECT selected,field_confidence_json FROM import_drafts WHERE id = ?').bind(row.id).first())
    .toMatchObject({ selected: 0, field_confidence_json: expect.stringContaining('"airline_iata":0') })
})

it('persists the question metadata of a streamed provider row and of a local pipe list in fields_json', async () => {
  const { send, start, batch, rows } = await runtime(); const id = await start()
  send('{"flights":[' + JSON.stringify(providerFlight({ date: '', origin: 'ROV', destination: '', destination_hint: 'Moscow', date_month_day: '05-21',
    review_required: true, confidence: 0.5, field_confidence: { date: 0, date_year_explicit: false, origin: 0.9, destination: 0, airline_iata: 0.9 } })) + ']}'); feed.close()
  await expect.poll(async () => (await batch(id))?.status).toBe('review')
  const stored = JSON.parse((await rows(id)).results[0].fields_json)
  expect(stored).toMatchObject({ date: '', date_month_day: '05-21', origin: 'ROV', destination: '', destination_options: ['DME', 'SVO', 'VKO'], review_required: true })
  expect(stored.origin_options).toBeUndefined()
  expect(stored.destination_hint).toBeUndefined()
  expect(JSON.stringify(stored).length).toBeLessThan(600)

  const response = await dispatch('/api/import/jobs', 'POST', { type: 'text', submissionOperationId: 'local-list-0002', content: '2015-05-21 | ROV → Moscow | S7 Airlines S7 123' })
  const { batchId } = await response.json() as { batchId: string }
  await expect.poll(async () => (await batch(batchId))?.status).toBe('review')
  expect(JSON.parse((await rows(batchId)).results[0].fields_json)).toMatchObject({ origin: 'ROV', destination: '', destination_options: ['DME', 'SVO', 'VKO'] })
  expect(JSON.parse((await rows(batchId)).results[0].fields_json).review_required).toBeUndefined()
})

async function closedEvents(response: Awaited<ReturnType<typeof dispatch>>, timeout = 2_000) {
  const reader = response.body!.getReader(); let text = ''; let closed = false
  const reading = (async () => {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) { closed = true; return text }
      text += new TextDecoder().decode(chunk.value)
    }
  })()
  try { await expect.poll(() => closed, { timeout }).toBe(true); return await reading }
  finally { await reader.cancel().catch(() => undefined); await reading }
}

it.each(['cancel with failed abort', 'account deletion', 'discard'])('%s sends a final snapshot and end to an open subscriber', async action => {
  const { send, start, batch, rows } = await runtime(action === 'cancel with failed abort'); const id = await start()
  send('{"flights":[' + JSON.stringify(providerFlight()))
  await expect.poll(async () => (await rows(id)).results.length).toBe(1)
  const response = await dispatch(`/api/import/batches/${id}/events?after=${(await batch(id))!.sequence}`)
  if (action === 'cancel with failed abort') expect((await dispatch(`/api/import/batches/${id}/cancel`, 'POST')).status).toBe(200)
  else if (action === 'discard') expect((await dispatch(`/api/import/batches/${id}`, 'DELETE')).status).toBe(200)
  else expect((await dispatch('/__test/delete-account', 'POST')).status).toBe(204)
  // Force the active writer to observe the D1 fence even if the abort transport failed.
  try { send(',' + JSON.stringify(providerFlight({ origin: 'TBS' }))); } catch {}
  const text = await closedEvents(response)
  expect(text).toContain('event: snapshot')
  expect(text).toContain('event: end')
  expect(text).toContain('"status":"' + (action === 'cancel with failed abort' ? 'cancelled' : 'deleted') + '"')
  expect(text.indexOf('event: snapshot')).toBeLessThan(text.indexOf('event: end'))
  const namespace = await mf!.getDurableObjectNamespace('IMPORT_JOBS')
  await expect.poll(async () => (await namespace.get(namespace.idFromName(`u1:${id}`)).fetch('https://import.internal/__test/storage')).json()).toEqual({})
  expect((await rows(id)).results).toHaveLength(action === 'cancel with failed abort' ? 1 : 0)
})

it('terminal completion sends end, clears storage and refuses a new provider start', async () => {
  const { send, start, batch, calls } = await runtime(); const id = await start()
  const response = await dispatch(`/api/import/batches/${id}/events`)
  send('{"flights":[' + JSON.stringify(providerFlight()) + ']}'); feed.close()
  const text = await closedEvents(response)
  expect(text).toContain('event: end')
  expect(text).toContain('"status":"review"')
  expect(text).not.toMatch(/^id:/m)
  expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform')
  const namespace = await mf!.getDurableObjectNamespace('IMPORT_JOBS')
  const stub = namespace.get(namespace.idFromName(`u1:${id}`))
  await expect.poll(async () => (await batch(id))?.status).toBe('review')
  await expect.poll(async () => (await stub.fetch('https://import.internal/__test/storage')).json()).toEqual({})
  expect((await stub.fetch('https://import.internal/start', { method: 'POST', body: JSON.stringify({
    fence: { userId: 'u1', batchId: id, generation: 1 }, source: { type: 'text', content: 'fixture' },
  }) })).status).toBe(409)
  expect(calls()).toBe(1)
})

it('an interruption alarm sends reupload only on the final snapshot', async () => {
  const { send, start, rows } = await runtime(); const id = await start()
  send('{"flights":[' + JSON.stringify(providerFlight()))
  await expect.poll(async () => (await rows(id)).results.length).toBe(1)
  const response = await dispatch(`/api/import/batches/${id}/events`)
  const namespace = await mf!.getDurableObjectNamespace('IMPORT_JOBS')
  await namespace.get(namespace.idFromName(`u1:${id}`)).fetch('https://import.internal/__test/alarm', { method: 'POST' })
  const text = await closedEvents(response)
  expect(text).toContain('event: end')
  for (const frame of text.split('\n\n').filter(frame => frame.includes('"reupload":true'))) expect(frame).toContain('event: snapshot')
  expect(text).toContain('"reupload":true')
})

it('detects outside cancellation on the heartbeat while the provider is idle', async () => {
  const { start } = await runtime(true); const id = await start()
  const response = await dispatch(`/api/import/batches/${id}/events`)
  expect((await dispatch(`/api/import/batches/${id}/cancel`, 'POST')).status).toBe(200)
  const text = await closedEvents(response, 7_000)
  expect(text).toContain('event: snapshot')
  expect(text).toContain('event: end')
  expect(text).toContain('"status":"cancelled"')
}, 10_000)
