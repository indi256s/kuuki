import { Miniflare } from 'miniflare'
import { applyMigrations } from '../../scripts/_migrations'

/** Each test gets a private in-process D1 database with the full migrated schema. */
export async function createApiDatabase() {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    d1Databases: { DB: 'kuuki-api-test' },
  })
  const db = await mf.getD1Database('DB')
  await applyMigrations(db)
  return { db, dispose: () => mf.dispose() }
}

/** Invoke a Pages Function at its public request boundary with a real D1 binding. */
export function apiContext(
  db: D1Database,
  request: Request,
  next: () => Promise<Response> = async () => new Response('next'),
) {
  return {
    request,
    env: { DB: db },
    data: { user: null },
    next,
    params: {},
    waitUntil() {},
    passThroughOnException() {},
  }
}

export const testOrigin = 'https://kuuki.test'

/** Build a same-origin request carrying the CSRF cookie/header pair; a string or stream body is sent as-is, anything else as JSON. */
export function csrfRequest(
  path: string,
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const raw = typeof body === 'string' || body instanceof ReadableStream
  return new Request(`${testOrigin}${path}`, {
    method,
    headers: {
      Origin: testOrigin,
      Cookie: 'kuuki_csrf=test-csrf',
      'X-CSRF-Token': 'test-csrf',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: (raw ? body : JSON.stringify(body)) as BodyInit }),
    ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  } as RequestInit & { duplex?: 'half' })
}

export async function count(db: D1Database, table: string): Promise<number> {
  return (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n ?? 0
}
