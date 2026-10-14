// Shared T11 runtime: the real import Worker and its Durable Object on Wrangler's Miniflare, with a fake provider.
import { afterEach, beforeAll, expect } from 'vitest'
import type { Miniflare as Runtime, MiniflareOptions } from 'miniflare'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { applyMigrations } from '../../scripts/_migrations'
import { csrfRequest } from './harness'

// Wrangler's installed runtime supports the required keep-alive date; the root Miniflare is older.
const require = createRequire(import.meta.url)
type Runtime5 = Runtime
const { Miniflare, convertV4MiniflareOptions } = createRequire(require.resolve('wrangler'))(
  'miniflare',
) as {
  Miniflare: new (options: MiniflareOptions) => Runtime5
  convertV4MiniflareOptions: (options: MiniflareOptions) => MiniflareOptions
}
let bundle: string
beforeAll(async () => {
  const esbuild = createRequire(require.resolve('wrangler'))('esbuild')
  const result = await esbuild.build({
    entryPoints: ['functions/test/import-worker-fixture.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'esnext',
    alias: { '@google/genai': './functions/test/import-fake-provider.ts' },
  })
  bundle = result.outputFiles[0].text
})
export let mf: Runtime5 | undefined
let persistence: string | undefined
export let feed: ReadableStreamDefaultController<Uint8Array>
export const encode = new TextEncoder()
export async function dispatch(
  path: string,
  method = 'GET',
  body?: unknown,
  user = 'u1',
  signal?: AbortSignal,
) {
  const request = csrfRequest(path, method, body, { 'X-Test-User': user })
  return mf!.dispatchFetch(request.url, {
    method,
    signal,
    headers: Object.fromEntries(request.headers),
    ...(body === undefined ? {} : { body: await request.text() }),
  })
}
export async function runtime(
  failAbort = false,
  checker: 'verified' | 'failed' | 'held' = 'verified',
) {
  let calls = 0
  let checkerCalls = 0
  let releaseChecker: () => void = () => undefined
  const checkerGate = new Promise<void>((resolve) => {
    releaseChecker = resolve
  })
  let providerInput: Record<string, any> | undefined
  mkdirSync('.wrangler', { recursive: true })
  persistence = mkdtempSync('.wrangler/t11-runtime-')
  const options = {
    ...convertV4MiniflareOptions({
      name: 'import-test',
      modules: true,
      script: bundle,
      compatibilityDate: '2026-10-01',
      compatibilityFlags: ['enable_request_signal', 'request_signal_passthrough'],
      d1Databases: { DB: 'import-runtime-test' },
      durableObjects: { IMPORT_JOBS: { className: 'TestImportJob', useSQLite: true } },
      unsafeDirectSockets: [{ host: '127.0.0.1', port: 0 }],
      bindings: {
        GEMINI_API_KEY: 'fake',
        GEMINI_IMPORT_MODEL: 'fixture-model',
        FAIL_ABORT: failAbort,
      },
      serviceBindings: {
        CHECKER: async (request: { json(): Promise<unknown> }) => {
          checkerCalls++
          const input = (await request.json()) as { questions: Record<string, unknown> }
          if (checker === 'held') await checkerGate
          if (checker === 'failed') return new Response(null, { status: 502 })
          return Response.json({
            answers: Object.fromEntries(
              Object.keys(input.questions).map((key) => [key, { type: 'noul', noul: 1 }]),
            ),
          })
        },
        FAKE: async (request: { json(): Promise<unknown> }) => {
          providerInput = (await request.json()) as Record<string, any>
          const body = new ReadableStream<Uint8Array>({
            start(controller) {
              feed = controller
            },
          })
          // Counted only once `feed` is this call's stream: `start()` waits for the count before tests send chunks.
          calls++
          return new Response(body)
        },
      },
    }),
    resourcePersistencePath: persistence,
  }
  mf = new Miniflare(options)
  const db = await mf.getD1Database('DB')
  await applyMigrations(db)
  for (const id of ['u1', 'u2'])
    await db
      .prepare('INSERT INTO users(id,email,password_hash) VALUES(?,?,?)')
      .bind(id, `${id}@example.test`, 'hash')
      .run()
  const chunk = (value: Record<string, unknown>) =>
    feed.enqueue(encode.encode(JSON.stringify(value) + '\n'))
  const send = (text: string) => chunk({ text })
  const start = async (type = 'text', content = 'private fixture input') => {
    const response = await dispatch('/api/import/jobs', 'POST', {
      type,
      content,
      submissionOperationId: 'runtime-op-0001',
    })
    expect(response.status).toBe(202)
    const { batchId } = (await response.json()) as { batchId: string }
    await expect.poll(() => calls).toBe(1)
    return batchId
  }
  const batch = (id: string) =>
    db
      .prepare(
        'SELECT status,stage,sequence,generation,error_code,retry_after FROM import_batches WHERE id = ?',
      )
      .bind(id)
      .first<Record<string, any>>()
  const rows = (id: string) =>
    db
      .prepare(
        'SELECT id,ordinal,fields_json,selected,version,confidence FROM import_drafts WHERE batch_id = ? ORDER BY ordinal',
      )
      .bind(id)
      .all<{
        id: string
        ordinal: number
        fields_json: string
        selected: number
        version: number
        confidence: number
      }>()
  const restart = async () => {
    await mf!.dispose()
    mf = new Miniflare(options)
    return mf.getD1Database('DB')
  }
  return {
    db,
    send,
    chunk,
    start,
    batch,
    rows,
    restart,
    checkerCalls: () => checkerCalls,
    releaseChecker,
    calls: () => calls,
    input: () => providerInput,
  }
}
afterEach(async () => {
  await mf?.dispose()
  mf = undefined
  if (persistence) rmSync(persistence, { recursive: true, force: true })
  persistence = undefined
})
export async function readRow(reader: ReadableStreamDefaultReader<Uint8Array>) {
  let pending = ''
  const decoder = new TextDecoder()
  for (;;) {
    const next = await reader.read()
    if (next.done) throw new Error('Events ended before a row notification')
    pending += decoder.decode(next.value)
    for (const message of pending.split('\n\n').slice(0, -1)) {
      const data = message.split('\n').find((line) => line.startsWith('data: '))
      if (!data) continue
      const event = JSON.parse(data.slice(6)) as { sequence: number; rowIds: string[] }
      if (event.rowIds.length) return event
    }
    pending = pending.split('\n\n').at(-1)!
  }
}

export async function closedEvents(
  response: Awaited<ReturnType<typeof dispatch>>,
  timeout = 2_000,
) {
  const reader = response.body!.getReader()
  let text = ''
  let closed = false
  const reading = (async () => {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) {
        closed = true
        return text
      }
      text += new TextDecoder().decode(chunk.value)
    }
  })()
  try {
    await expect.poll(() => closed, { timeout }).toBe(true)
    return await reading
  } finally {
    await reader.cancel().catch(() => undefined)
    await reading
  }
}
