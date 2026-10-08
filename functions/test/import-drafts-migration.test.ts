// ADR 0001 §6/§7 (T07): the additive import-draft schema, shipped separately from 0006 for a reviewable deploy order.
import { describe, expect, it } from 'vitest'
import { migrationFiles, migrationStatements } from '../../scripts/_migrations'
import { databaseThrough } from './lifecycle-fixture'

const USER = 'draft-user'
const NOW = '2026-10-05T00:00:00.000Z'

async function seedUser(db: D1Database) {
  await db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(USER, 'draft@example.test', 'hash').run()
}

const batch = (db: D1Database, id: string, over: Record<string, unknown> = {}) => {
  const row = { id, user_id: USER, source_type: 'pdf', source_label: 'ticket.pdf', status: 'review', stage: 'review_ready',
    submission_operation_id: `op-${id}`, created_at: NOW, updated_at: NOW, expires_at: '2026-11-04T00:00:00.000Z', ...over }
  const columns = Object.keys(row)
  return db.prepare(`INSERT INTO import_batches (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).bind(...Object.values(row)).run()
}

const draft = (db: D1Database, id: string, batchId: string, ordinal: number, over: Record<string, unknown> = {}) => {
  const row = { id, user_id: USER, batch_id: batchId, ordinal, fields_json: '{}', created_at: NOW, updated_at: NOW, ...over }
  const columns = Object.keys(row)
  return db.prepare(`INSERT INTO import_drafts (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).bind(...Object.values(row)).run()
}

describe('0007 import drafts schema', () => {
  it('is a separate additive migration with no destructive statements', () => {
    const files = migrationFiles()
    expect(files).toContain('0007_import_drafts.sql')
    const sql = migrationStatements('0007_import_drafts.sql').join('\n')
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|INDEX|TRIGGER)\b|\bRENAME\b|\bDELETE\s+FROM\b/i)
    expect(sql).not.toMatch(/\bALTER\s+TABLE\s+flights\b/i)
  })

  it('creates the batch, draft and receipt tables with their indexes', async () => {
    const { db, dispose } = await databaseThrough()
    try {
      const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'import_%' ORDER BY name").all<{ name: string }>()
      expect(tables.results.map(row => row.name)).toEqual(['import_batches', 'import_conversion_receipts', 'import_drafts'])
      const indexes = await db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_import_%' ORDER BY name").all<{ name: string }>()
      expect(indexes.results.map(row => row.name)).toEqual([
        'idx_import_batches_expiry', 'idx_import_batches_user', 'idx_import_conversion_receipts_created', 'idx_import_drafts_user_status',
      ])
    } finally { await dispose() }
  })

  it('constrains batches as the ADR specifies', async () => {
    const { db, dispose } = await databaseThrough()
    try {
      await seedUser(db)
      await batch(db, 'b1')
      const row = await db.prepare('SELECT status, stage, sequence, generation FROM import_batches WHERE id = ?').bind('b1').first()
      expect(row).toEqual({ status: 'review', stage: 'review_ready', sequence: 0, generation: 1 })
      await expect(batch(db, 'b2', { source_type: 'docx' })).rejects.toThrow()
      await expect(batch(db, 'b2', { status: 'queued' })).rejects.toThrow()
      await expect(batch(db, 'b2', { stage: 'done' })).rejects.toThrow()
      await expect(batch(db, 'b2', { source_label: 'x'.repeat(121) })).rejects.toThrow()
      await expect(batch(db, 'b2', { sequence: -1 })).rejects.toThrow()
      await expect(batch(db, 'b2', { user_id: 'missing-user' })).rejects.toThrow() // FK
      await expect(batch(db, 'b3', { submission_operation_id: 'op-b1' })).rejects.toThrow() // UNIQUE (user_id, submission_operation_id)
      await batch(db, 'b4', { stage: null, source_label: null, status: 'processing' })
    } finally { await dispose() }
  })

  it('constrains drafts as the ADR specifies', async () => {
    const { db, dispose } = await databaseThrough()
    try {
      await seedUser(db)
      await batch(db, 'b1')
      await draft(db, 'd1', 'b1', 0)
      const row = await db.prepare('SELECT status, version, selected, edited, year_explicit, year_confirmed, duplicate_acknowledged FROM import_drafts WHERE id = ?').bind('d1').first()
      expect(row).toEqual({ status: 'review', version: 1, selected: 0, edited: 0, year_explicit: 0, year_confirmed: 0, duplicate_acknowledged: 0 })
      await expect(draft(db, 'd2', 'b1', 0)).rejects.toThrow() // UNIQUE (batch_id, ordinal)
      await expect(draft(db, 'd2', 'b1', -1)).rejects.toThrow()
      await expect(draft(db, 'd2', 'b1', 1, { fields_json: 'x'.repeat(2049) })).rejects.toThrow()
      await expect(draft(db, 'd2', 'b1', 1, { field_confidence_json: 'x'.repeat(1025) })).rejects.toThrow()
      await expect(draft(db, 'd2', 'b1', 1, { confidence: 1.1 })).rejects.toThrow()
      await expect(draft(db, 'd2', 'b1', 1, { status: 'raw' })).rejects.toThrow()
      await expect(draft(db, 'd2', 'b1', 1, { version: 0 })).rejects.toThrow()
      await expect(draft(db, 'd2', 'b1', 1, { selected: 2 })).rejects.toThrow()
      await expect(draft(db, 'd2', 'nope', 1)).rejects.toThrow() // FK to batch
      await draft(db, 'd3', 'b1', 2, { confidence: 0.5, field_confidence_json: '{}' })
    } finally { await dispose() }
  })

  it('keeps conversion receipts as tombstones keyed by operation and by draft', async () => {
    const { db, dispose } = await databaseThrough()
    try {
      await seedUser(db)
      const receipt = (key: string, draftId: string) => db.prepare(
        'INSERT INTO import_conversion_receipts (user_id,operation_key,draft_id,batch_id,request_digest,flight_id,created_at) VALUES (?,?,?,?,?,?,?)',
      ).bind(USER, key, draftId, 'gone-batch', 'digest', 99, NOW).run()
      await receipt('key-0001', 'draft-a') // no FK to drafts, batches or flights
      await expect(receipt('key-0001', 'draft-b')).rejects.toThrow() // PRIMARY KEY (user_id, operation_key)
      await expect(receipt('key-0002', 'draft-a')).rejects.toThrow() // UNIQUE (user_id, draft_id)
      await receipt('key-0002', 'draft-b')
    } finally { await dispose() }
  })

  it('leaves 0006 state untouched: no flights or lifecycle tables change', async () => {
    const six = await databaseThrough('0006')
    const seven = await databaseThrough('0007_import_drafts.sql')
    try {
      const shape = (db: D1Database) => db.prepare("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'import_%' AND name NOT LIKE 'idx_import_%' AND name NOT LIKE 'sqlite_autoindex_import_%' ORDER BY name").all()
      expect((await shape(seven.db)).results).toEqual((await shape(six.db)).results)
    } finally { await six.dispose(); await seven.dispose() }
  })
})
