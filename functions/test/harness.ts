import { readFileSync } from 'node:fs'
import { Miniflare } from 'miniflare'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/** Each test gets a private in-process D1 database with production's baseline schema. */
export async function createApiDatabase() {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    d1Databases: { DB: 'kuuki-api-test' },
  })
  const db = await mf.getD1Database('DB')
  for (const migration of ['0001_init.sql', '0002_auth_activation.sql', '0003_derived_recovery.sql']) {
    const schema = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), `../../db/migrations/${migration}`), 'utf8')
    for (const statement of schema.replace(/--[^\n]*/g, '').split(';').map(part => part.trim()).filter(Boolean)) {
      await db.prepare(statement).run()
    }
  }
  return { db, dispose: () => mf.dispose() }
}

/** Invoke a Pages Function at its public request boundary with a real D1 binding. */
export function apiContext(db: D1Database, request: Request, next: () => Promise<Response> = async () => new Response('next')) {
  return { request, env: { DB: db }, data: { user: null }, next, params: {}, waitUntil() {}, passThroughOnException() {} }
}
