// ADR 0008 admission: authentication before reads, ownership, idempotent run creation, the chunk manifest, replay,
// receiving state, late writes after a close, and a full 10 000-record file accounted for in pages.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bawRecord,
  createRun,
  csvOf,
  discardRun,
  eraseSource,
  getArchive,
  getPage,
  historyAccount,
  historyKey,
  historyOperationId,
  listRuns,
  OTHER,
  patchRow,
  postConfirm,
  postGroup,
  prepareCsv,
  putChunk,
  uploadCsv,
} from './history-fixture'
import { instrumentDb } from './db-hooks'
import { count } from './harness'

let db: D1Database
let dispose: () => Promise<void>
beforeEach(async () => {
  ;({ db, dispose } = await historyAccount())
})
afterEach(async () => {
  vi.useRealTimers()
  await dispose()
})

/** `n` clean records on distinct days: nothing to answer, nothing repeated. */
const bulkCsv = (n: number) =>
  csvOf(
    Array.from({ length: n }, (_, index) =>
      bawRecord({
        Date: new Date(Date.UTC(2000, 0, 1 + index)).toISOString().slice(0, 10),
        'Flight Flighty ID': `f0000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        'Gate Departure (Actual)': '',
        'Gate Arrival (Actual)': '',
      }),
    ),
  )
const rowCount = () => count(db, 'history_import_rows')

describe('who may call', () => {
  it('answers a guest with 401 before reading anything', async () => {
    const { runId, prepared } = await uploadCsv(db, bulkCsv(3))
    const watched = instrumentDb(db)
    const calls = [
      await createRun(watched.db, prepared.create(), null),
      await listRuns(watched.db, null),
      await getPage(watched.db, runId, {}, null),
      await getArchive(watched.db, runId, null),
      await putChunk(watched.db, runId, 0, prepared.chunkBody(0), null),
      await patchRow(watched.db, runId, 'row', { version: 1, ignore: true }, null),
      await postGroup(watched.db, runId, { group: 'canceled:', answer: false, revision: 1 }, null),
      await postConfirm(watched.db, runId, [{ rowId: 'row', version: 1, key: historyKey() }], null),
      await discardRun(watched.db, runId, null),
      await eraseSource(watched.db, runId, null),
    ]
    expect(calls.map((call) => call.status)).toEqual(Array(calls.length).fill(401))
    expect(watched.hooks.sql).toEqual([])
  })

  it("answers another user's run with 404 on every route and changes nothing", async () => {
    const { runId, prepared } = await uploadCsv(db, bulkCsv(3))
    const row = (await getPage(db, runId)).body.rows[0]
    const calls = [
      await getPage(db, runId, {}, OTHER),
      await getArchive(db, runId, OTHER),
      await putChunk(db, runId, 0, prepared.chunkBody(0), OTHER),
      await patchRow(db, runId, row.id, { version: row.version, ignore: true }, OTHER),
      await postGroup(db, runId, { group: 'canceled:', answer: false, revision: 1 }, OTHER),
      await postConfirm(
        db,
        runId,
        [{ rowId: row.id, version: row.version, key: historyKey() }],
        OTHER,
      ),
      await discardRun(db, runId, OTHER),
      await eraseSource(db, runId, OTHER),
    ]
    expect(calls.map((call) => call.status)).toEqual(Array(calls.length).fill(404))
    expect((await getPage(db, runId)).body.run.totals.states.ready).toBe(3)
    expect((await listRuns(db, OTHER)).body.runs).toEqual([])
  })
})

describe('opening a run', () => {
  it('is idempotent on the operation id and refuses the same id for another file', async () => {
    const prepared = await prepareCsv(bulkCsv(3))
    const operationId = historyOperationId()
    const first = await createRun(db, prepared.create(operationId))
    expect(first.status).toBe(201)
    const replay = await createRun(db, prepared.create(operationId))
    expect(replay.status).toBe(200)
    expect(replay.body.run.id).toBe(first.body.run.id)

    const other = await prepareCsv(bulkCsv(4))
    const conflict = await createRun(db, other.create(operationId))
    expect(conflict).toMatchObject({ status: 409, body: { code: 'IDEMPOTENCY_CONFLICT' } })
    expect(await count(db, 'history_import_runs')).toBe(1)
  })

  it('admits the 101 byte-bounded chunks that 10 000 long-note records need', async () => {
    const body = (await prepareCsv(bulkCsv(1))).create()
    const chunks = Array.from({ length: 101 }, (_, index) => ({
      count: 1,
      digest: index.toString(16).padStart(64, '0'),
    }))
    const created = await createRun(db, { ...body, totalRecords: 101, chunks })
    expect(created).toMatchObject({ status: 201, body: { run: { chunks: { total: 101 } } } })
  })
})

describe('admitting chunks', () => {
  const open = async (records = 150) => {
    const prepared = await prepareCsv(bulkCsv(records))
    const created = await createRun(db, prepared.create())
    return { prepared, runId: created.body.run.id as string }
  }

  it('refuses a payload that differs from the manifest, wrong ordinals and an oversize body', async () => {
    const { prepared, runId } = await open()
    const body = prepared.chunkBody(0)

    const tampered = structuredClone(body)
    tampered.records[3][2][0] = '2999-01-01'
    expect(await putChunk(db, runId, 0, tampered)).toMatchObject({
      status: 409,
      body: { code: 'CHUNK_DIGEST_MISMATCH' },
    })
    const shifted = { records: body.records.map(([o, l, c]) => [o + 1, l, c]) }
    expect((await putChunk(db, runId, 0, shifted)).status).toBe(400)
    const huge = JSON.stringify({ records: [[0, 2, ['x'.repeat(300 * 1024)]]] })
    expect((await putChunk(db, runId, 0, huge)).status).toBe(413)
    expect(await rowCount()).toBe(0)
  })

  it('inserts nothing when an admitted chunk is replayed', async () => {
    const { prepared, runId } = await open()
    const first = await putChunk(db, runId, 0, prepared.chunkBody(0))
    expect(first.status).toBe(201)
    const revision = first.body.run.revision
    const replay = await putChunk(db, runId, 0, prepared.chunkBody(0))
    expect(replay).toMatchObject({ status: 200, body: { inserted: 0 } })
    expect(replay.body.run.revision).toBe(revision)
    expect(await rowCount()).toBe(100)
  })

  it('stays receiving while a chunk is missing, names it and refuses decisions until it arrives', async () => {
    const { prepared, runId } = await open()
    await putChunk(db, runId, 1, prepared.chunkBody(1))
    const { run, rows } = (await getPage(db, runId, { state: 'ready' })).body
    expect(run).toMatchObject({ status: 'receiving', chunks: { total: 2, missing: [0] } })
    expect(run.totals.received).toBe(50)

    const attempt = await postConfirm(db, runId, [
      { rowId: rows[0].id, version: rows[0].version, key: historyKey() },
    ])
    expect(attempt.body.results[0]).toMatchObject({ status: 'error', code: 'HISTORY_RUN_CLOSED' })
    expect(
      await patchRow(db, runId, rows[0].id, { version: rows[0].version, ignore: true }),
    ).toMatchObject({
      status: 409,
    })
    expect(await count(db, 'flights')).toBe(0)

    const last = await putChunk(db, runId, 0, prepared.chunkBody(0))
    expect(last.body.run).toMatchObject({ status: 'review', chunks: { missing: [] } })
  })

  it('finishes a seal that an earlier attempt left receiving when any chunk is replayed', async () => {
    const { prepared, runId } = await open()
    await putChunk(db, runId, 0, prepared.chunkBody(0))
    await db
      .prepare(
        "CREATE TRIGGER abort_seal BEFORE UPDATE OF status ON history_import_runs WHEN NEW.status <> 'receiving' BEGIN SELECT RAISE(ABORT, 'x'); END",
      )
      .run()
    try {
      await putChunk(db, runId, 1, prepared.chunkBody(1)).catch(() => null)
    } finally {
      await db.prepare('DROP TRIGGER abort_seal').run()
    }
    const stranded = (await getPage(db, runId)).body.run
    expect(stranded).toMatchObject({ status: 'receiving', chunks: { missing: [] } })
    expect(await rowCount()).toBe(150)

    const replay = await putChunk(db, runId, 0, prepared.chunkBody(0))
    expect(replay).toMatchObject({ status: 200, body: { inserted: 0 } })
    expect(replay.body.run.status).toBe('review')
  })

  it('writes nothing for a late chunk after the run was discarded or its source erased', async () => {
    const discarded = await open()
    await putChunk(db, discarded.runId, 0, discarded.prepared.chunkBody(0))
    expect((await discardRun(db, discarded.runId)).status).toBe(200)
    expect((await putChunk(db, discarded.runId, 1, discarded.prepared.chunkBody(1))).status).toBe(
      404,
    )
    expect(await rowCount()).toBe(0)

    const erased = await open()
    expect((await eraseSource(db, erased.runId)).status).toBe(200)
    expect(await putChunk(db, erased.runId, 0, erased.prepared.chunkBody(0))).toMatchObject({
      status: 409,
      body: { code: 'HISTORY_RUN_CLOSED' },
    })
    expect(await rowCount()).toBe(0)
  })
})

describe('a file at the record limit', () => {
  it('accounts for all 10 000 records and pages them 50 at a time with a keyset cursor', async () => {
    const { runId, run, chunkReplies } = await uploadCsv(db, bulkCsv(10_000))
    expect(chunkReplies).toHaveLength(100)
    expect(run.status).toBe('review')
    expect(run.totals.received).toBe(10_000)
    expect(Object.values(run.totals.states).reduce((sum, n) => sum + n, 0)).toBe(10_000)
    expect(run.totals.states.ready).toBe(10_000)

    const first = (await getPage(db, runId, { state: 'ready' })).body
    expect(first.rows).toHaveLength(50)
    expect(first.nextCursor).toBe(49)
    const second = (await getPage(db, runId, { state: 'ready', cursor: first.nextCursor! })).body
    expect(second.rows.map((row) => row.ordinal)).toEqual(
      Array.from({ length: 50 }, (_, i) => 50 + i),
    )
    expect((await getPage(db, runId, { state: 'ready', limit: 51 })).status).toBe(400)

    const tail = (await getPage(db, runId, { state: 'ready', cursor: 9_949 })).body
    expect(tail.rows).toHaveLength(50)
    expect(tail.nextCursor).toBeNull()
  }, 240_000)
})
