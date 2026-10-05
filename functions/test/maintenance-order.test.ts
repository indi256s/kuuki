// T09 / ADR 0001 §8: maintenance ordering (transitions, dirty repair, leaderboards, cleanup, status), fairness caps,
// retryable incomplete cycles and the cleanup contracts. Every cycle runs with MAINTENANCE_MODE unset; the held
// state is covered in due-transitions.test.ts (A9).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { accountWith, flightStatement, USER, type FixtureFlight } from './country-fixture'
import { hasSql, instrumentDb } from './db-hooks'
import { lifecycleOf } from './lifecycle-fixture'
import { DUE_TRANSITION_LIMIT } from '../api/_services/lifecycle'
import maintenance from '../../workers/maintenance/index'

const NOW = new Date('2026-10-05T12:00:00.000Z')
const DAY = 86_400_000
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString()
afterEach(() => { vi.useRealTimers() })

const cycle = (db: D1Database) => maintenance.scheduled({} as ScheduledEvent, { DB: db, MAINTENANCE_MODE: 'false' })
const status = (db: D1Database) => db.prepare('SELECT last_success_at, last_failure_at, last_error FROM maintenance_status WHERE id = 1')
  .first<{ last_success_at: string | null; last_failure_at: string | null; last_error: string | null }>()
const upcoming = (id: number, over: Partial<FixtureFlight> = {}): FixtureFlight => ({
  id, date: '2026-10-03', origin: 'TBS', destination: 'IST', state: 'upcoming',
  awaitingAfter: '2026-10-04T00:00:00.000Z', autoAfter: '2026-10-11T00:00:00.000Z', ...over,
})
const clock = () => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW) }
const addUser = (db: D1Database, id: string) => db.batch([
  db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(id, `${id}@example.test`, 'hash'),
  db.prepare("INSERT INTO profiles (id, created_at) VALUES (?, '2020-01-01T00:00:00.000Z')").bind(id),
])
const lifecycleStates = (db: D1Database) => db.prepare('SELECT user_id, id, lifecycle_state AS s FROM flights ORDER BY id').all().then(r => r.results)

describe('order', () => {
  it('runs transitions, dirty repair, leaderboards, cleanup and the status update in that order', async () => {
    const { db: raw, dispose } = await accountWith([upcoming(1), upcoming(2, { date: '2026-09-20', awaitingAfter: '2026-09-21T00:00:00.000Z', autoAfter: '2026-09-28T00:00:00.000Z' })])
    try {
      clock()
      const { db, hooks } = instrumentDb(raw)
      await cycle(db)
      const first = (needle: string) => { const index = hooks.sql.findIndex(sql => sql.includes(needle)); expect(index, needle).toBeGreaterThanOrEqual(0); return index }
      const order = [
        first("SET lifecycle_state = 'awaiting'"),
        first("confirmation_source = 'automatic'"),
        first('INSERT INTO country_visit_evidence'),
        first('DELETE FROM leaderboard_cache'),
        first('DELETE FROM lifecycle_operation_receipts'),
        first('SET last_success_at'),
      ]
      expect(order).toEqual([...order].sort((a, b) => a - b))
      expect(await lifecycleStates(raw)).toEqual([{ user_id: 'u1', id: 1, s: 'awaiting' }, { user_id: 'u1', id: 2, s: 'logged' }])
      expect((await status(raw))!.last_error).toBeNull()
      expect((await status(raw))!.last_success_at).not.toBeNull()
      // The transitions were published by the same cycle: no stale user is left behind.
      expect(await raw.prepare('SELECT COUNT(*) AS n FROM user_derived_state WHERE revision != published_revision OR evidence_revision != published_revision').first()).toEqual({ n: 0 })
    } finally { await dispose() }
  })

  it('does nothing and reports no failure when nothing is due', async () => {
    const { db, dispose } = await accountWith([])
    try {
      clock()
      await cycle(db)
      expect(await status(db)).toMatchObject({ last_error: null })
    } finally { await dispose() }
  })
})

describe('fairness', () => {
  it('serves at most 50 users per cycle by oldest deadline; the remainder makes the cycle a retryable failure, then catches up', async () => {
    const { db, dispose } = await accountWith([])
    try {
      clock()
      // u1 is the newest deadline; 50 other users have older ones, so u1 waits for the second cycle.
      await db.batch([
        flightStatement(db, upcoming(1, { awaitingAfter: '2026-10-04T12:00:00.000Z' })),
        ...Array.from({ length: 50 }, (_, i) => `v${i}`).flatMap((id, i) => [
          db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(id, `${id}@example.test`, 'hash'),
          db.prepare("INSERT INTO profiles (id, created_at) VALUES (?, '2020-01-01T00:00:00.000Z')").bind(id),
          flightStatement(db, upcoming(100 + i, { user: id, awaitingAfter: new Date(Date.parse('2026-10-01T00:00:00.000Z') + i * 60_000).toISOString() })),
        ]),
      ])
      await expect(cycle(db)).rejects.toThrow('MAINTENANCE_CYCLE_FAILED')
      expect(await status(db)).toMatchObject({ last_error: 'MAINTENANCE_CYCLE_FAILED', last_success_at: null })
      expect((await lifecycleOf(db, 1))!.lifecycle_state).toBe('upcoming') // newest deadline waits, its eligibility untouched
      expect(await db.prepare("SELECT COUNT(*) AS n FROM flights WHERE lifecycle_state = 'awaiting'").first()).toEqual({ n: 50 })
      await cycle(db)
      expect((await lifecycleOf(db, 1))).toMatchObject({ lifecycle_state: 'awaiting', awaiting_after: '2026-10-04T12:00:00.000Z' })
      expect((await status(db))!.last_success_at).not.toBeNull()
    } finally { await dispose() }
  }, 120_000)

  it('caps work per user: a backlog beyond the per-user limit fails the cycle and drains on the next', async () => {
    const flights = Array.from({ length: DUE_TRANSITION_LIMIT + 5 }, (_, i) => upcoming(i + 1, { awaitingAfter: new Date(Date.parse('2026-10-01T00:00:00.000Z') + i * 60_000).toISOString() }))
    const { db, dispose } = await accountWith(flights)
    try {
      clock()
      await expect(cycle(db)).rejects.toThrow('MAINTENANCE_CYCLE_FAILED')
      expect(await db.prepare("SELECT COUNT(*) AS n FROM flights WHERE lifecycle_state = 'awaiting'").first()).toEqual({ n: DUE_TRANSITION_LIMIT })
      await cycle(db)
      expect(await db.prepare("SELECT COUNT(*) AS n FROM flights WHERE lifecycle_state = 'awaiting'").first()).toEqual({ n: DUE_TRANSITION_LIMIT + 5 })
    } finally { await dispose() }
  }, 120_000)
})

describe('retryable incomplete cycles and recovery', () => {
  it('a publication that fails after the transitions committed is a failed cycle, never a false success; the next cycle recovers', async () => {
    const { db: raw, dispose } = await accountWith([upcoming(1, { date: '2026-09-20', awaitingAfter: '2026-09-21T00:00:00.000Z', autoAfter: '2026-09-28T00:00:00.000Z' })])
    try {
      clock()
      const { db, hooks } = instrumentDb(raw)
      hooks.failBatch(hasSql('INSERT INTO country_visit_evidence'), 5)
      await expect(cycle(db)).rejects.toThrow('MAINTENANCE_CYCLE_FAILED')
      expect((await lifecycleOf(raw, 1))).toMatchObject({ lifecycle_state: 'logged', confirmation_source: 'automatic' }) // the transition is canonical
      expect(await status(raw)).toMatchObject({ last_error: 'MAINTENANCE_CYCLE_FAILED', last_success_at: null })
      expect(await raw.prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?').bind(USER.id).first<{ revision: number; published_revision: number }>())
        .toSatisfy((row: { revision: number; published_revision: number }) => row.revision > row.published_revision)
      await cycle(raw) // the outage is over: nothing is due, the dirty user is repaired
      expect(await status(raw)).toMatchObject({ last_error: null })
      expect((await status(raw))!.last_success_at).not.toBeNull()
      expect(await raw.prepare('SELECT revision = published_revision AND evidence_revision = published_revision AS ready FROM user_derived_state WHERE user_id = ?').bind(USER.id).first()).toEqual({ ready: 1 })
    } finally { await dispose() }
  })

  it('a missed-cron outage catches up without resetting eligibility', async () => {
    const { db, dispose } = await accountWith([
      upcoming(1, { date: '2026-08-01', awaitingAfter: '2026-08-02T00:00:00.000Z', autoAfter: '2026-08-09T00:00:00.000Z' }),
      upcoming(2, { date: '2026-09-30', awaitingAfter: '2026-10-01T00:00:00.000Z', autoAfter: '2026-10-08T00:00:00.000Z' }),
    ])
    try {
      clock()
      await cycle(db)
      expect(await lifecycleOf(db, 1)).toMatchObject({ lifecycle_state: 'logged', confirmation_source: 'automatic', confirmed_at: NOW.toISOString(), auto_confirm_after: '2026-08-09T00:00:00.000Z' })
      expect(await lifecycleOf(db, 2)).toMatchObject({ lifecycle_state: 'awaiting', auto_confirm_after: '2026-10-08T00:00:00.000Z' })
    } finally { await dispose() }
  })
})

describe('cleanup contracts', () => {
  it('keeps what is inside its retention window and removes what is past it', async () => {
    const { db, dispose } = await accountWith([])
    try {
      clock()
      const receipt = (id: string, kind: string, createdAt: string) => db.prepare(
        `INSERT INTO lifecycle_operation_receipts (user_id, operation_id, kind, request_digest, batch_nonce, expected_count, created_at) VALUES (?,?,?,?,?,0,?)`)
        .bind(USER.id, id, kind, 'd', 'n', createdAt)
      const batch = (id: string, expires: string, extra = "'review'") => db.prepare(
        `INSERT INTO import_batches (id,user_id,source_type,status,submission_operation_id,created_at,updated_at,expires_at) VALUES (?,?,'text',${extra},?,?,?,?)`)
        .bind(id, USER.id, `op-${id}`, ago(40), ago(40), expires)
      const draft = (id: string, batchId: string) => db.prepare(
        `INSERT INTO import_drafts (id,user_id,batch_id,ordinal,fields_json,created_at,updated_at) VALUES (?,?,?,0,'{}',?,?)`).bind(id, USER.id, batchId, ago(40), ago(40))
      const conv = (key: string, createdAt: string) => db.prepare(
        `INSERT INTO import_conversion_receipts (user_id,operation_key,draft_id,batch_id,request_digest,flight_id,created_at) VALUES (?,?,?,?,?,?,?)`)
        .bind(USER.id, key, `draft-${key}`, 'b', 'd', 1, createdAt)
      await db.batch([
        receipt('receipt-old-1', 'confirm', ago(14.5)), receipt('receipt-new-1', 'confirm', ago(13)),
        db.prepare('INSERT INTO flight_idempotency (user_id,key,payload_digest,flight_id,created_at) VALUES (?,?,?,NULL,?)').bind(USER.id, 'idem-old-001', 'd', ago(8)),
        db.prepare('INSERT INTO flight_idempotency (user_id,key,payload_digest,flight_id,created_at) VALUES (?,?,?,NULL,?)').bind(USER.id, 'idem-new-001', 'd', ago(6)),
        batch('alive', new Date(NOW.getTime() + DAY).toISOString()), draft('d-alive', 'alive'),
        batch('expired-recent', ago(1)), draft('d-expired-recent', 'expired-recent'),
        batch('expired-old', ago(8)), draft('d-expired-old', 'expired-old'),
        conv('conv-old-001', ago(38)), conv('conv-new-001', ago(36)),
        batch('stuck-with-rows', new Date(NOW.getTime() + DAY).toISOString(), "'processing'"), draft('d-stuck', 'stuck-with-rows'),
        batch('stuck-empty', new Date(NOW.getTime() + DAY).toISOString(), "'processing'"),
        batch('still-running', new Date(NOW.getTime() + DAY).toISOString(), "'processing'"),
      ])
      await db.batch([
        db.prepare("UPDATE import_batches SET processing_deadline = ? WHERE id IN ('stuck-with-rows','stuck-empty')").bind(ago(0.01)),
        db.prepare("UPDATE import_batches SET processing_deadline = ? WHERE id = 'still-running'").bind(new Date(NOW.getTime() + 60_000).toISOString()),
      ])
      await cycle(db)
      const ids = (sql: string) => db.prepare(sql).all<{ id: string }>().then(r => r.results.map(row => row.id).sort())
      expect(await ids('SELECT operation_id AS id FROM lifecycle_operation_receipts')).toEqual(['receipt-new-1'])
      expect(await ids('SELECT key AS id FROM flight_idempotency')).toEqual(['idem-new-001'])
      expect(await ids('SELECT operation_key AS id FROM import_conversion_receipts')).toEqual(['conv-new-001'])
      // Drafts of expired batches go at expires_at; the batch row itself at expires_at + 7 days.
      expect(await ids('SELECT id FROM import_drafts')).toEqual(['d-alive', 'd-stuck'])
      expect(await ids('SELECT id FROM import_batches')).toEqual(['alive', 'expired-recent', 'still-running', 'stuck-empty', 'stuck-with-rows'])
      const stuck = await db.prepare("SELECT id, status, error_code, generation, sequence FROM import_batches WHERE id LIKE 'stuck%' OR id = 'still-running' ORDER BY id").all()
      expect(stuck.results).toEqual([
        { id: 'still-running', status: 'processing', error_code: null, generation: 1, sequence: 0 },
        { id: 'stuck-empty', status: 'failed', error_code: 'JOB_INTERRUPTED', generation: 2, sequence: 1 },
        { id: 'stuck-with-rows', status: 'partial', error_code: 'JOB_INTERRUPTED', generation: 2, sequence: 1 },
      ])
      void addUser
    } finally { await dispose() }
  })
})
