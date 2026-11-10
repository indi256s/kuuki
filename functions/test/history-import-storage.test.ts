// ADR 0008 storage: migration 0020, deletion paths that must erase private source cells, retention and discard.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bawRecord,
  bulkDelete,
  clock,
  confirmAllReady,
  csvOf,
  daysAfter,
  deleteFlight,
  discardRun,
  eraseSource,
  getArchive,
  getPage,
  historyAccount,
  historyKey,
  NOW,
  OTHER,
  postConfirm,
  snapshot,
  uploadCsv,
  USER,
} from './history-fixture'
import { count } from './harness'
import { applyMigrationAtomically, databaseThrough } from './lifecycle-fixture'
import { deleteUserCascade } from '../api/_lib/users'
import { expireHistoryRunsStatements } from '../api/_services/historyImportRetention'
import maintenance from '../../workers/maintenance/index'

describe('migration 0020', () => {
  let dispose: (() => Promise<void>) | undefined
  afterEach(async () => {
    await dispose?.()
  })

  it('keeps every existing flight, visit and import batch, and adds an unset explicit-instant marker', async () => {
    const fixture = await databaseThrough('0019')
    dispose = fixture.dispose
    const { db } = fixture
    await db.batch([
      db.prepare("INSERT INTO users (id,email,password_hash) VALUES ('m1','m1@example.test','x')"),
      db.prepare(
        "INSERT INTO flights (id,user_id,date,origin,destination,departure_utc,arrival_utc,duration_minutes) VALUES (7,'m1','2020-01-01','TBS','IST','2020-01-01T10:00:00.000Z','2020-01-01T12:00:00.000Z',120),(9,'m1','2021-02-02','IST','DXB',NULL,NULL,NULL)",
      ),
      db.prepare(
        "INSERT INTO visits (user_id,country_code,airport_iata,first_visit,last_visit,visit_count) VALUES ('m1','TR','IST','2020-01-01','2021-02-02',2)",
      ),
      db.prepare(
        "INSERT INTO import_batches (id,user_id,source_type,status,submission_operation_id,created_at,updated_at,expires_at) VALUES ('b1','m1','text','review','op-b1-0001','2020-01-01','2020-01-01','2030-01-01')",
      ),
    ])
    const before = {
      flights: (await db.prepare('SELECT * FROM flights ORDER BY id').all()).results,
      visits: (await db.prepare('SELECT * FROM visits').all()).results,
      batches: (await db.prepare('SELECT * FROM import_batches').all()).results,
    }
    await applyMigrationAtomically(db, '0020_history_import.sql')

    expect((await db.prepare('SELECT * FROM flights ORDER BY id').all()).results).toEqual(
      before.flights.map((row) => ({ ...row, utc_explicit: 0 })),
    )
    expect((await db.prepare('SELECT * FROM visits').all()).results).toEqual(before.visits)
    expect((await db.prepare('SELECT * FROM import_batches').all()).results).toEqual(before.batches)
    expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
    await expect(
      db.prepare('UPDATE flights SET utc_explicit = 2 WHERE id = 7').run(),
    ).rejects.toThrow(/CHECK/)

    const run = (id: string) =>
      db
        .prepare(
          `INSERT INTO history_import_runs (id,user_id,submission_operation_id,provider,profile,mapper_version,headers_json,
             manifest_json,manifest_digest,total_records,total_chunks,status,created_at,updated_at,expires_at)
           VALUES (?, 'm1', ?, 'flighty', 'p', 1, '[]', '[]', ?, 1, 1, 'review', 'a', 'a', 'z')`,
        )
        .bind(id, `operation-${id}`, 'd'.repeat(64))
    await run('r1').run()
    const row = (cells: string, state: string) =>
      db
        .prepare(
          `INSERT INTO history_import_rows (id,user_id,run_id,ordinal,line,chunk_index,cells_json,record_digest,state,created_at,updated_at)
           VALUES (?, 'm1', 'r1', ?, 2, 0, ?, ?, ?, 'a', 'a')`,
        )
        .bind(
          `row-${state}-${cells.length}`,
          Math.floor(Math.random() * 9000),
          cells,
          'd'.repeat(64),
          state,
        )
    await expect(row(JSON.stringify('x'.repeat(70_000)), 'ready').run()).rejects.toThrow(/CHECK/)
    await expect(row('["fine"]', 'half_done').run()).rejects.toThrow(/CHECK/)
    await expect(row('["fine"]', 'ready').run()).resolves.toBeTruthy()
  })
})

describe('deleting what an import created', () => {
  let db: D1Database
  let dispose: () => Promise<void>
  beforeEach(async () => {
    ;({ db, dispose } = await historyAccount())
    clock(NOW)
  })
  afterEach(async () => {
    vi.useRealTimers()
    await dispose()
  })

  const csv = csvOf([
    bawRecord(),
    bawRecord({
      Date: '2026-05-09',
      From: 'LHR',
      To: 'JFK',
      PNR: 'SYN888',
      'Flight Flighty ID': 'f0000000-0000-4000-8000-0000000000bb',
      'Gate Departure (Actual)': '2026-05-09T10:00',
      'Gate Arrival (Actual)': '2026-05-09T13:00',
    }),
  ])
  const imported = async (user = USER) => {
    const { runId } = await uploadCsv(db, csv, user)
    await confirmAllReady(db, runId, user)
    return { runId, rows: await snapshot(db, runId, user) }
  }
  const stored = (runId: string, ordinal: number) =>
    db
      .prepare('SELECT * FROM history_import_rows WHERE run_id = ? AND ordinal = ?')
      .bind(runId, ordinal)
      .first<any>()

  it('a single flight delete erases the record cells and keeps the tombstone', async () => {
    const { runId, rows } = await imported()
    const before = await stored(runId, 0)
    expect((await deleteFlight(db, rows[0].flightId!)).status).toBe(200)

    const after = await stored(runId, 0)
    expect(after).toMatchObject({
      state: 'removed',
      cells_json: null,
      flight_id: null,
      record_digest: before.record_digest,
      flighty_flight_id: before.flighty_flight_id,
      match_key: before.match_key,
    })
    expect(after.flighty_flight_id).toBeTruthy()
    expect(JSON.stringify(after)).not.toContain('SYN777')
    expect(await stored(runId, 1)).toMatchObject({ state: 'created' })
    expect((await getArchive(db, runId)).body.records[0]).toMatchObject({
      state: 'removed',
      cells: null,
    })
  })

  it('a bulk delete tombstones its own rows and never touches another owner', async () => {
    const mine = await imported()
    const theirs = await imported(OTHER)
    const result = await bulkDelete(db, [
      mine.rows[0].flightId!,
      mine.rows[1].flightId!,
      theirs.rows[0].flightId!,
    ])
    expect(result.status).toBe(200)

    for (const ordinal of [0, 1])
      expect(await stored(mine.runId, ordinal)).toMatchObject({
        state: 'removed',
        cells_json: null,
      })
    expect(await stored(theirs.runId, 0)).toMatchObject({
      state: 'created',
      flight_id: theirs.rows[0].flightId,
    })
    expect((await stored(theirs.runId, 0)).cells_json).toContain('SYN777')
    expect(
      (await db
        .prepare('SELECT COUNT(*) AS n FROM flights WHERE user_id = ?')
        .bind(OTHER.id)
        .first<{ n: number }>())!.n,
    ).toBe(2)
  })

  it('deleting the account leaves no runs or rows behind, and only its own', async () => {
    await imported()
    const theirs = await imported(OTHER)
    await deleteUserCascade(db, USER.id)
    expect(
      (await db
        .prepare('SELECT COUNT(*) AS n FROM history_import_rows WHERE user_id = ?')
        .bind(USER.id)
        .first<{ n: number }>())!.n,
    ).toBe(0)
    expect(
      (await db
        .prepare('SELECT COUNT(*) AS n FROM history_import_runs WHERE user_id = ?')
        .bind(USER.id)
        .first<{ n: number }>())!.n,
    ).toBe(0)
    expect(await count(db, 'history_import_rows')).toBe(2)
    expect((await getPage(db, theirs.runId, {}, OTHER)).status).toBe(200)
  })

  it('discard keeps created flights, and erasing the source clears every cell but keeps the flights', async () => {
    const { runId } = await uploadCsv(db, csv)
    const [first] = (await getPage(db, runId, { state: 'ready' })).body.rows
    const confirmed = await postConfirm(db, runId, [
      { rowId: first.id, version: first.version, key: historyKey() },
    ])
    expect(confirmed.body.results[0].status).toBe('created')

    expect(await discardRun(db, runId)).toMatchObject({
      status: 200,
      body: { discarded: true, kept: 1 },
    })
    expect(await count(db, 'flights')).toBe(1)
    expect(await stored(runId, 0)).toMatchObject({ state: 'created' })
    expect(await stored(runId, 1)).toMatchObject({
      state: 'ignored',
      ignore_reason: 'discarded',
      cells_json: null,
    })

    expect((await eraseSource(db, runId)).status).toBe(200)
    expect(
      (await db
        .prepare('SELECT COUNT(*) AS n FROM history_import_rows WHERE cells_json IS NOT NULL')
        .first<{ n: number }>())!.n,
    ).toBe(0)
    expect(await count(db, 'flights')).toBe(1)
  })
})

describe('30-day staging expiry', () => {
  let db: D1Database
  let dispose: () => Promise<void>
  beforeEach(async () => {
    ;({ db, dispose } = await historyAccount())
    clock(NOW)
  })
  afterEach(async () => {
    vi.useRealTimers()
    await dispose()
  })

  const csv = csvOf(
    [
      ['2026-05-01', 'LHR'],
      ['2026-05-02', 'BOS'],
      ['2026-05-03', 'FRA'],
    ].map(([Date, To], index) =>
      bawRecord({
        Date,
        To,
        'Flight Flighty ID': `f0000000-0000-4000-8000-0000000000e${index}`,
        'Gate Departure (Actual)': '',
        'Gate Arrival (Actual)': '',
      }),
    ),
  )
  const settle = async (runId: string) => {
    const [first] = (await getPage(db, runId, { state: 'ready' })).body.rows
    await postConfirm(db, runId, [{ rowId: first.id, version: first.version, key: historyKey() }])
  }
  const cellsLeft = async (runId: string) =>
    (
      await db
        .prepare(
          'SELECT state, cells_json IS NOT NULL AS has FROM history_import_rows WHERE run_id = ? ORDER BY ordinal',
        )
        .bind(runId)
        .all<{ state: string; has: number }>()
    ).results

  it('closes an old run: open rows become ignored without cells, committed rows keep theirs, totals still add up', async () => {
    const { runId } = await uploadCsv(db, csv)
    await settle(runId)
    clock(daysAfter(31))
    await db.batch(expireHistoryRunsStatements(db, new Date().toISOString()))

    expect(await cellsLeft(runId)).toEqual([
      { state: 'created', has: 1 },
      { state: 'ignored', has: 0 },
      { state: 'ignored', has: 0 },
    ])
    const page = (await getPage(db, runId)).body
    expect(page.run.status).toBe('closed')
    expect(page.run.totals.states).toMatchObject({ created: 1, ignored: 2 })
    expect(page.run.totals.received).toBe(page.run.totals.records)
    expect(
      (await db
        .prepare("SELECT COUNT(*) AS n FROM history_import_rows WHERE ignore_reason = 'expired'")
        .first<{ n: number }>())!.n,
    ).toBe(2)
  })

  it('runs inside the maintenance cycle and leaves a younger run alone', async () => {
    const old = await uploadCsv(db, csv)
    clock(daysAfter(20))
    const young = await uploadCsv(db, csv)
    clock(daysAfter(31))
    await maintenance.scheduled({} as ScheduledEvent, { DB: db, MAINTENANCE_MODE: 'false' })

    expect((await getPage(db, old.runId)).body.run.status).toBe('closed')
    expect((await getPage(db, young.runId)).body.run.status).toBe('review')
    expect((await cellsLeft(young.runId)).every((row) => row.has === 1)).toBe(true)
    expect((await cellsLeft(old.runId)).every((row) => row.has === 0)).toBe(true)
  })
})
