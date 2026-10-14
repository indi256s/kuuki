import { afterAll } from 'vitest'
import { Miniflare } from 'miniflare'
import { applyMigrations } from '../../scripts/_migrations'

// One Miniflare per test file holds a few D1 bindings. Booting workerd and replaying every migration for each test
// cost ~350 ms apiece; a binding is instead migrated once and wiped back to that state when it is handed out again.
const BINDINGS = Array.from({ length: 4 }, (_, i) => `DB${i}`)

interface Baseline {
  schema: Map<string, string>
  tables: string[]
  /** Rows the migrations themselves write (maintenance_status), restored after every wipe. */
  seeds: Array<{ table: string; rows: Record<string, unknown>[] }>
}
interface Slot {
  db: D1Database
  baseline?: Baseline
}

let pool: Promise<{ mf: Miniflare; free: Slot[] }> | undefined
afterAll(async () => {
  if (pool) await (await pool).mf.dispose()
})

async function bootPool(): Promise<{ mf: Miniflare; free: Slot[] }> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    d1Databases: Object.fromEntries(BINDINGS.map((name) => [name, `kuuki-api-test-${name}`])),
  })
  const free = await Promise.all(
    BINDINGS.map(async (name) => ({ db: await mf.getD1Database(name) })),
  )
  return { mf, free: free.reverse() }
}

const objectKey = (row: { type: string; name: string }) => `${row.type}:${row.name}`

async function schemaOf(db: D1Database) {
  const { results } = await db
    .prepare(
      "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
    )
    .all<{ type: string; name: string; sql: string | null }>()
  return new Map(results.map((row) => [objectKey(row), row.sql ?? '']))
}

async function migrate(db: D1Database): Promise<Baseline> {
  await applyMigrations(db)
  const schema = await schemaOf(db)
  const tables = [...schema.keys()]
    .filter((key) => key.startsWith('table:'))
    .map((key) => key.slice(6))
  const seeds = []
  for (const table of tables) {
    const { results } = await db.prepare(`SELECT * FROM "${table}"`).all<Record<string, unknown>>()
    if (results.length > 0) seeds.push({ table, rows: results })
  }
  return { schema, tables, seeds }
}

/** Drop what a test added (failure triggers), then empty every table. False when the migrated schema itself changed. */
async function wipe(db: D1Database, baseline: Baseline): Promise<boolean> {
  const current = await schemaOf(db)
  for (const [key, sql] of baseline.schema) if (current.get(key) !== sql) return false
  const added = [...current.keys()].filter((key) => !baseline.schema.has(key))
  for (const key of added) {
    const [type, name] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
    if (type === 'index' && current.get(key) === '') continue // dropped with its table
    await db.prepare(`DROP ${type.toUpperCase()} IF EXISTS "${name}"`).run()
  }
  await db.batch([
    db.prepare('PRAGMA defer_foreign_keys = ON'),
    ...baseline.tables.map((table) => db.prepare(`DELETE FROM "${table}"`)),
    db.prepare('DELETE FROM sqlite_sequence'),
    ...baseline.seeds.flatMap(({ table, rows }) =>
      rows.map((row) => {
        const columns = Object.keys(row)
        return db
          .prepare(
            `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          )
          .bind(...Object.values(row))
      }),
    ),
  ])
  return true
}

/** A private in-process D1 database with the full migrated schema and no rows. */
export async function createApiDatabase() {
  const { free } = await (pool ??= bootPool())
  const slot = free.pop()
  if (!slot) return isolatedDatabase()
  if (!slot.baseline || !(await wipe(slot.db, slot.baseline))) {
    if (slot.baseline) return isolatedDatabase() // a test rewrote the schema; retire this binding
    slot.baseline = await migrate(slot.db)
  }
  let released = false
  return {
    db: slot.db,
    dispose: async () => {
      if (released) return
      released = true
      free.push(slot)
    },
  }
}

/** More databases open at once than the pool holds, or a retired binding: boot a dedicated runtime as before. */
async function isolatedDatabase() {
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
