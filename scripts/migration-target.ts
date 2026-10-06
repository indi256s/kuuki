/** Explicit, isolated local D1 access and observable schema admission for migration tools. */
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { Miniflare } from 'miniflare'
import { MAX_REVIEW_AGE_MS, ROOT, SCHEMA_SQL, requiredArg } from './_cli'
import { applyMigrations } from './_migrations'

export interface LocalTargetOptions {
  target: 'local'
  databaseId: string
  persistPath: string
}

export interface LocalTarget {
  db: D1Database
  schemaSha256: string
  dispose(): Promise<void>
}

export function parseLocalTarget(argv = process.argv.slice(2)): LocalTargetOptions {
  const target = requiredArg(argv, '--target')
  if (target !== 'local') throw new Error('This command only supports --target local; remote migration is a separate approved operation')
  const databaseId = requiredArg(argv, '--database-id')
  if (!/^[-a-zA-Z0-9]{6,100}$/.test(databaseId)) throw new Error('Invalid explicit database ID')
  const persistPath = requiredArg(argv, '--persist')
  if (!isAbsolute(persistPath)) throw new Error('--persist must be an absolute isolated directory')
  const path = resolve(persistPath)
  if (path.startsWith(join(ROOT, '.wrangler')) || path === ROOT || path === '/') {
    throw new Error('Refusing shared project state as migration target')
  }
  return { target: 'local', databaseId, persistPath: path }
}

function miniflare(databaseId: string, persistPath?: string): Miniflare {
  return new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("migration-d1") } }',
    compatibilityDate: '2026-01-01',
    d1Databases: { DB: databaseId },
    d1Persist: persistPath ?? false,
  })
}

export async function schemaFingerprint(db: D1Database): Promise<string> {
  const objects = await db.prepare(SCHEMA_SQL).all()
  return schemaRowsSha256(objects.results ?? [])
}

export function applicationSchemaRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.filter((row) => {
    const name = String(row.name ?? '')
    const owner = String(row.tbl_name ?? '')
    // D1 reserves the `_cf_` prefix for internal objects (hosted `_cf_KV`, local `_cf_METADATA`).
    return !name.startsWith('sqlite_') && !name.startsWith('_cf_') && !owner.startsWith('_cf_') &&
      name !== 'd1_migrations' && owner !== 'd1_migrations'
  })
}

export function schemaRowsSha256(rows: Array<Record<string, unknown>>): string {
  const normalized = applicationSchemaRows(rows).map((row) => ({
    type: row.type, name: row.name, table: row.tbl_name,
    // SQL literals can contain significant whitespace; text drift requires admission.
    sql: typeof row.sql === 'string' ? row.sql : null,
  }))
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}

export interface SchemaAdmission {
  accountId: string
  databaseId: string
  observedApplicationSchemaSha256: string
  expectedFreshSchemaSha256: string
  reviewedAt: string
  semanticReview: true
  reviewedDimensions: string[]
}

const REVIEW_DIMENSIONS = ['columns', 'defaults', 'primaryKeys', 'foreignKeys', 'uniqueIndexes', 'indexes', 'checks']

/** Exact schema by default; a pinned, recent human semantic review admits only SQL-text variants. */
export function assessSchemaAdmission(
  observedRows: Array<Record<string, unknown>>, expectedRows: Array<Record<string, unknown>>,
  target: { accountId: string; databaseId: string }, evidencePath?: string,
): { admitted: boolean; observedSha256: string; expectedSha256: string; reason?: string } {
  const observed = applicationSchemaRows(observedRows)
  const expected = applicationSchemaRows(expectedRows)
  const observedSha256 = schemaRowsSha256(observed)
  const expectedSha256 = schemaRowsSha256(expected)
  const signature = (rows: Array<Record<string, unknown>>) => JSON.stringify(rows.map((row) =>
    [String(row.type), String(row.name), String(row.tbl_name)]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
  if (signature(observed) !== signature(expected)) {
    return { admitted: false, observedSha256, expectedSha256, reason: 'application-object-inventory-mismatch' }
  }
  if (observedSha256 === expectedSha256) return { admitted: true, observedSha256, expectedSha256 }
  if (!evidencePath) return { admitted: false, observedSha256, expectedSha256, reason: 'unreviewed-schema-variant' }
  const mode = statSync(evidencePath).mode & 0o777
  if ((mode & 0o077) !== 0) return { admitted: false, observedSha256, expectedSha256, reason: 'schema-admission-not-private' }
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as SchemaAdmission
  const reviewed = Date.parse(evidence.reviewedAt)
  const dimensions = [...(evidence.reviewedDimensions ?? [])].sort()
  if (evidence.accountId !== target.accountId || evidence.databaseId !== target.databaseId ||
      evidence.observedApplicationSchemaSha256 !== observedSha256 ||
      evidence.expectedFreshSchemaSha256 !== expectedSha256 || evidence.semanticReview !== true ||
      JSON.stringify(dimensions) !== JSON.stringify([...REVIEW_DIMENSIONS].sort()) ||
      !Number.isFinite(reviewed) || reviewed > Date.now() || Date.now() - reviewed > MAX_REVIEW_AGE_MS) {
    return { admitted: false, observedSha256, expectedSha256, reason: 'schema-admission-evidence-invalid-or-stale' }
  }
  return { admitted: true, observedSha256, expectedSha256 }
}

export async function expectedSchemaRows(): Promise<Array<Record<string, unknown>>> {
  const mf = miniflare('schema-proof-d1')
  try {
    const db = await mf.getD1Database('DB')
    await applyMigrations(db)
    return (await db.prepare(SCHEMA_SQL).all<Record<string, unknown>>()).results
  } finally { await mf.dispose() }
}

/** Build the expected hash by actually applying this checkout's migrations to fresh D1. */
export async function expectedSchemaSha256(): Promise<string> {
  return schemaRowsSha256(await expectedSchemaRows())
}

export async function openLocalTarget(options: LocalTargetOptions): Promise<LocalTarget> {
  const mf = miniflare(options.databaseId, options.persistPath)
  try {
    const db = await mf.getD1Database('DB')
    const actual = await schemaFingerprint(db)
    const expected = await expectedSchemaSha256()
    if (actual !== expected) throw new Error(`Target schema mismatch: actual=${actual} expected=${expected}`)
    return { db, schemaSha256: actual, dispose: () => mf.dispose() }
  } catch (error) {
    await mf.dispose()
    throw error
  }
}

/** An isolated schema fixture for functional tests, never the default Wrangler state. */
export async function createLocalSchemaFixture(): Promise<{ options: LocalTargetOptions; cleanup(): void }> {
  const persistPath = mkdtempSync(join(tmpdir(), 'kuuki-migration-d1-'))
  const options: LocalTargetOptions = { target: 'local', databaseId: 'local-synthetic-d1', persistPath }
  const mf = miniflare(options.databaseId, persistPath)
  try {
    const db = await mf.getD1Database('DB')
    await applyMigrations(db)
  } finally {
    await mf.dispose()
  }
  return { options, cleanup: () => rmSync(persistPath, { recursive: true, force: true }) }
}
