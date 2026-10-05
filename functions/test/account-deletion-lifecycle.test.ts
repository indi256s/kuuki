// ADR 0001 §6 (T07): account deletion leaves no lifecycle receipts, drafts, batches or evidence rows.
import { expect, it } from 'vitest'
import { deleteUserCascade } from '../api/_lib/users'
import { count, createApiDatabase } from './harness'

const GONE = 'gone-user'
const KEPT = 'kept-user'
const NOW = '2026-10-05T00:00:00.000Z'

const LIFECYCLE_TABLES = [
  'import_conversion_receipts', 'import_drafts', 'import_batches', 'lifecycle_operation_receipts',
  'transit_cleanup_markers', 'country_evidence_suppressions', 'country_visit_evidence',
] as const

async function seedOwner(db: D1Database, user: string) {
  await db.batch([
    db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(user, `${user}@example.test`, 'hash'),
    db.prepare('INSERT INTO profiles (id) VALUES (?)').bind(user),
    db.prepare("INSERT INTO flights (user_id,date,origin,destination,is_upcoming,enrichment_status) VALUES (?,'2026-09-01','TBS','IST',0,'skipped')").bind(user),
    db.prepare(`INSERT INTO import_batches (id,user_id,source_type,status,submission_operation_id,created_at,updated_at,expires_at)
      VALUES (?,?,'text','review',?,?,?,?)`).bind(`batch-${user}`, user, `op-${user}`, NOW, NOW, '2026-11-04T00:00:00.000Z'),
    db.prepare("INSERT INTO import_drafts (id,user_id,batch_id,ordinal,fields_json,created_at,updated_at) VALUES (?,?,?,0,'{}',?,?)")
      .bind(`draft-${user}`, user, `batch-${user}`, NOW, NOW),
    db.prepare(`INSERT INTO import_conversion_receipts (user_id,operation_key,draft_id,batch_id,request_digest,flight_id,created_at)
      VALUES (?,?,?,?,'d',1,?)`).bind(user, `key-${user}`, `draft-${user}`, `batch-${user}`, NOW),
    db.prepare(`INSERT INTO lifecycle_operation_receipts (user_id,operation_id,kind,request_digest,batch_nonce,expected_count,created_at)
      VALUES (?,?,'confirm','d','nonce',1,?)`).bind(user, `operation-${user}`, NOW),
    db.prepare("INSERT INTO transit_cleanup_markers (user_id,status,candidate_set_digest,updated_at) VALUES (?,'dismissed','d',?)").bind(user, NOW),
    db.prepare("INSERT INTO country_evidence_suppressions (user_id,flight_id,endpoint,country_code) VALUES (?,1,'destination','TR')").bind(user),
    db.prepare("INSERT INTO country_visit_evidence (user_id,country_code,status,logged_visit_count) VALUES (?,'TR','pressed',1)").bind(user),
  ])
}

it('removes every lifecycle receipt, draft, batch and evidence row with the account and keeps other accounts intact', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seedOwner(db, GONE)
    await seedOwner(db, KEPT)
    for (const table of LIFECYCLE_TABLES) expect(await count(db, table), table).toBe(2)

    await deleteUserCascade(db, GONE)

    for (const table of LIFECYCLE_TABLES) {
      expect((await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).bind(GONE).first<{ n: number }>())?.n, table).toBe(0)
      expect((await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).bind(KEPT).first<{ n: number }>())?.n, table).toBe(1)
    }
    expect((await db.prepare('SELECT COUNT(*) AS n FROM flights WHERE user_id = ?').bind(GONE).first<{ n: number }>())?.n).toBe(0)
    expect(await count(db, 'users')).toBe(1)
  } finally { await dispose() }
})

it('deletes the new tables explicitly, children before parents and ahead of flights, in the one atomic batch', async () => {
  // D1 always enforces ON DELETE CASCADE, so row counts cannot prove the explicit deletes: record the batch instead.
  const { db, dispose } = await createApiDatabase()
  try {
    await seedOwner(db, GONE)
    const batches: string[][] = []
    const text = new WeakMap<object, string>()
    const recording = { prepare: (sql: string) => ({ bind: (...values: unknown[]) => {
      const bound = db.prepare(sql).bind(...values)
      text.set(bound, sql)
      return bound
    } }), batch: async (statements: D1PreparedStatement[]) => {
      batches.push(statements.map(statement => text.get(statement) ?? ''))
      return db.batch(statements)
    } } as unknown as D1Database
    await deleteUserCascade(recording, GONE)

    expect(batches).toHaveLength(1)
    const tables = batches[0].map(sql => /^DELETE FROM (\w+)/.exec(sql)?.[1])
    const position = (table: string) => tables.indexOf(table)
    for (const table of LIFECYCLE_TABLES) expect(position(table), table).toBeGreaterThanOrEqual(0)
    expect(position('import_conversion_receipts')).toBeLessThan(position('import_drafts'))
    expect(position('import_drafts')).toBeLessThan(position('import_batches'))
    for (const table of LIFECYCLE_TABLES) expect(position(table), table).toBeLessThan(position('flights'))
    expect(position('flights')).toBeLessThan(position('users'))
    expect(await count(db, 'users')).toBe(0)
  } finally { await dispose() }
})
