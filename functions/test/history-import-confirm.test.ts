// ADR 0008 confirmation: answers and group answers, explicit clock times, the receipt, atomic creates, re-import
// matching, and the privacy of the source cells. Real route handlers over local D1.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  allRows,
  bawRecord as baw,
  clock,
  csvOf,
  confirmAllReady,
  createFlight,
  daysAfter,
  deleteFlight,
  fixtureCsv,
  getArchive,
  getFlight,
  getPage,
  historyAccount,
  historyKey,
  OTHER,
  patchFlight,
  patchRow,
  postConfirm,
  postGroup,
  snapshot,
  uploadCsv,
  USER,
} from './history-fixture'
import { readPublicProfile } from '../api/_services/publicProfiles'

const IMPORT_AT = new Date('2026-11-10T12:00:00.000Z')

let db: D1Database
let dispose: () => Promise<void>
beforeEach(async () => {
  ;({ db, dispose } = await historyAccount())
  clock(IMPORT_AT)
})
afterEach(async () => {
  vi.useRealTimers()
  await dispose()
})

const flightsOf = async () =>
  (await db.prepare('SELECT * FROM flights WHERE user_id = ? ORDER BY id').bind(USER.id).all<any>())
    .results
const rowSql = (ordinal: number, runId: string) =>
  db
    .prepare('SELECT * FROM history_import_rows WHERE run_id = ? AND ordinal = ?')
    .bind(runId, ordinal)
    .first<any>()

/** Answer the four shared questions, settle the DST fold and drop the empty record, then confirm everything. */
async function reviewFixture(runId: string) {
  let revision = (await getPage(db, runId)).body.run.revision
  for (const [group, answer] of [
    ['airline:THA', 'TG'],
    ['airline:XQZ', null],
    ['airport:ZZZ', 'SVO'],
    ['canceled:', false],
  ] as const) {
    const reply = await postGroup(db, runId, { group, answer, revision })
    expect(reply.status, JSON.stringify(reply.body)).toBe(200)
    revision = reply.body.run.revision
  }
  const rows = await snapshot(db, runId)
  const dst = rows.find((row) => row.ordinal === 8)!
  const fold = dst.issues.find((issue) => issue.code === 'AMBIGUOUS_TIME')!
  expect(fold.offsets).toContain(-240)
  const settled = await patchRow(db, runId, dst.id, {
    version: dst.version,
    answers: { times: { offsets: { [fold.header!]: -240 } } },
  })
  expect(settled.status, JSON.stringify(settled.body)).toBe(200)
  const empty = rows.find((row) => row.ordinal === 9)!
  expect(empty.state).toBe('error')
  const ignored = await patchRow(db, runId, empty.id, { version: empty.version, ignore: true })
  expect(ignored.status).toBe(200)
  return confirmAllReady(db, runId)
}

describe('the observed fixture end to end', () => {
  it('creates flights with exact explicit instants and never turns a cancellation into a flight', async () => {
    const { runId, run } = await uploadCsv(db, fixtureCsv())
    expect(run.status).toBe('review')
    expect((await getPage(db, runId)).body.run.groups.map((group) => group.group).sort()).toEqual([
      'airline:THA',
      'airline:XQZ',
      'airport:ZZZ',
      'canceled:',
    ])
    await reviewFixture(runId)

    const page = (await getPage(db, runId)).body
    expect(page.run.status).toBe('completed')
    expect(page.run.totals.states).toMatchObject({
      created: 9,
      preserved_only: 1,
      ignored: 1,
      ready: 0,
      needs_review: 0,
      error: 0,
    })
    expect(Object.values(page.run.totals.states).reduce((a, b) => a + b, 0)).toBe(11)

    const flights = await flightsOf()
    expect(flights).toHaveLength(9)
    // Date line: Tokyo departure 2026-03-11 00:30 JST lands in Honolulu the previous UTC day.
    const dateLine = flights.find((flight) => flight.origin === 'HND')
    expect(dateLine).toMatchObject({
      destination: 'HNL',
      departure_utc: '2026-03-10T15:30:00.000Z',
      arrival_utc: '2026-03-10T22:30:00.000Z',
      duration_minutes: 420,
      utc_explicit: 1,
    })
    expect(flights.find((flight) => flight.origin === 'FRA')).toMatchObject({ destination: 'BOS' })
    // The settled fold: 01:30 EDT is 05:30Z and 02:40 EST is 07:40Z.
    expect(
      flights.find((flight) => flight.origin === 'JFK' && flight.destination === 'BOS'),
    ).toMatchObject({
      departure_utc: '2026-11-01T05:30:00.000Z',
      arrival_utc: '2026-11-01T07:40:00.000Z',
      duration_minutes: 130,
    })
    // A record without clock times infers nothing explicit.
    expect(flights.find((flight) => flight.origin === 'SVO')).toMatchObject({ utc_explicit: 0 })

    const cancelled = (await snapshot(db, runId)).find((row) => row.ordinal === 2)!
    expect(cancelled).toMatchObject({ state: 'preserved_only', flightId: null })
    expect(flights.some((flight) => flight.origin === 'CDG')).toBe(false)
    const countries = (
      await db
        .prepare('SELECT country_code FROM country_visit_evidence WHERE user_id = ? ORDER BY 1')
        .bind(USER.id)
        .all<{ country_code: string }>()
    ).results.map((row) => row.country_code)
    expect(countries).toEqual(expect.arrayContaining(['GB', 'JP', 'US']))
    expect(countries).not.toContain('FR')
  })

  it('keeps PNR and notes private to the owner', async () => {
    const { runId } = await uploadCsv(db, fixtureCsv())
    await reviewFixture(runId)

    const archive = await getArchive(db, runId)
    expect(archive.status).toBe(200)
    expect(archive.body.records[0].cells).toEqual(
      expect.arrayContaining(['SYN001', 'Window seat, "great" view']),
    )
    expect((await getArchive(db, runId, OTHER)).status).toBe(404)
    expect((await getArchive(db, runId, null)).status).toBe(401)

    const flightId = (await snapshot(db, runId)).find((row) => row.ordinal === 0)!.flightId!
    const own = await getFlight(db, flightId)
    expect(own.status).toBe(200)
    expect(JSON.stringify(own.body)).not.toMatch(/SYN001|great/)
    await db
      .prepare("UPDATE profiles SET username = 'flyer', is_public = 1 WHERE id = ?")
      .bind(USER.id)
      .run()
    expect(JSON.stringify(await readPublicProfile(db, 'flyer'))).not.toMatch(/SYN001|great/)
  })
})

describe('confirmation receipt and atomicity', () => {
  const single = () => uploadCsv(db, csvOf([baw()]))
  const readyRow = async (runId: string) =>
    (await getPage(db, runId, { state: 'ready' })).body.rows[0]

  it('replays a lost answer with the same flight, and a second key on a committed row is refused', async () => {
    const { runId } = await single()
    const row = await readyRow(runId)
    const key = historyKey()
    const first = await postConfirm(db, runId, [{ rowId: row.id, version: row.version, key }])
    expect(first.body.results[0]).toMatchObject({ status: 'created', state: 'created' })
    const flightId =
      first.body.results[0].status === 'error' ? null : first.body.results[0].flightId
    expect(flightId).toBeTypeOf('number')

    const again = await postConfirm(db, runId, [{ rowId: row.id, version: row.version, key }])
    expect(again.body.results[0]).toMatchObject({ status: 'replayed', flightId })
    const other = await postConfirm(db, runId, [
      { rowId: row.id, version: row.version + 1, key: historyKey() },
    ])
    expect(other.body.results[0]).toMatchObject({ status: 'error', code: 'HISTORY_ROW_CONFIRMED' })
    expect(await flightsOf()).toHaveLength(1)
  })

  it('two concurrent confirms of one row with different keys create exactly one flight', async () => {
    const { runId } = await single()
    const row = await readyRow(runId)
    const attempts = await Promise.all(
      [historyKey(), historyKey()].map((key) =>
        postConfirm(db, runId, [{ rowId: row.id, version: row.version, key }]),
      ),
    )
    const outcomes = attempts.map((attempt) => attempt.body.results[0].status)
    expect(outcomes.filter((status) => status === 'created')).toHaveLength(1)
    expect(await flightsOf()).toHaveLength(1)
    expect(
      (await db
        .prepare('SELECT COUNT(*) AS n FROM flight_idempotency WHERE flight_id IS NOT NULL')
        .first<{ n: number }>())!.n,
    ).toBe(1)
  })

  it('rolls the whole chain back when its last statement fails, and the retry then succeeds', async () => {
    const { runId } = await single()
    const row = await readyRow(runId)
    await db
      .prepare(
        "CREATE TRIGGER fail_created BEFORE UPDATE OF state ON history_import_rows WHEN NEW.state = 'created' BEGIN SELECT RAISE(ABORT, 'x'); END",
      )
      .run()
    try {
      const failed = await postConfirm(db, runId, [
        { rowId: row.id, version: row.version, key: historyKey() },
      ]).catch(() => null)
      expect(failed?.body.results?.[0]?.status ?? 'error').toBe('error')
      expect(await flightsOf()).toHaveLength(0)
      expect(
        (await db.prepare('SELECT COUNT(*) AS n FROM flight_idempotency').first<{ n: number }>())!
          .n,
      ).toBe(0)
      expect(await rowSql(0, runId)).toMatchObject({
        state: 'ready',
        version: row.version,
        flight_id: null,
        operation_key: null,
      })
    } finally {
      await db.prepare('DROP TRIGGER fail_created').run()
    }
    const retry = await postConfirm(db, runId, [
      { rowId: row.id, version: row.version, key: historyKey() },
    ])
    expect(retry.body.results[0].status).toBe('created')
  })
})

describe('matching against earlier imports and the journal', () => {
  it('links a repeated export without new flights and keeps owner edits', async () => {
    const first = await uploadCsv(db, fixtureCsv())
    await reviewFixture(first.runId)
    const created = (await snapshot(db, first.runId)).find((row) => row.ordinal === 0)!.flightId!
    expect((await patchFlight(db, created, { flight_number: '999' })).status).toBe(200)
    const before = await flightsOf()

    clock(daysAfter(38, IMPORT_AT))
    const second = await uploadCsv(db, fixtureCsv())
    const rows = await snapshot(db, second.runId)
    // Ten committed records are exact repeats; the empty record was never committed and stays an error.
    expect(rows.filter((row) => row.finding?.kind === 'previous_import')).toHaveLength(10)
    expect(rows.find((row) => row.ordinal === 9)).toMatchObject({ state: 'error' })
    await confirmAllReady(db, second.runId)

    expect(await flightsOf()).toEqual(before)
    const after = await snapshot(db, second.runId)
    expect(after.filter((row) => row.state === 'duplicate')).toHaveLength(10)
    expect(after.find((row) => row.ordinal === 0)).toMatchObject({
      state: 'duplicate',
      flightId: created,
    })
    expect(before.find((flight) => flight.id === created)).toMatchObject({ flight_number: '999' })
  })

  it('asks before re-adding a flight the owner deleted', async () => {
    const csv = csvOf([
      baw(),
      baw({
        Date: '2026-05-09',
        From: 'LHR',
        To: 'JFK',
        'Flight Flighty ID': 'f0000000-0000-4000-8000-0000000000bb',
        'Gate Departure (Actual)': '2026-05-09T10:00',
        'Gate Arrival (Actual)': '2026-05-09T13:00',
      }),
    ])
    const first = await uploadCsv(db, csv)
    await confirmAllReady(db, first.runId)
    const [gone, kept] = await snapshot(db, first.runId)
    expect((await deleteFlight(db, gone.flightId!)).status).toBe(200)
    expect(await flightsOf()).toHaveLength(1)

    clock(daysAfter(38, IMPORT_AT))
    const second = await uploadCsv(db, csv)
    const rows = await snapshot(db, second.runId)
    expect(rows[0]).toMatchObject({ state: 'needs_review', finding: { kind: 'previous_deleted' } })
    expect(rows[1]).toMatchObject({
      state: 'ready',
      action: 'link',
      finding: { kind: 'previous_import', flightId: kept.flightId },
    })
    const attempt = await postConfirm(db, second.runId, [
      { rowId: rows[0].id, version: rows[0].version, key: historyKey() },
    ])
    expect(attempt.body.results[0]).toMatchObject({
      status: 'error',
      code: 'HISTORY_ROW_NOT_READY',
    })
    expect(await flightsOf()).toHaveLength(1)
  })

  it('treats a changed record with the same Flighty ID as a decision, never an overwrite', async () => {
    const first = await uploadCsv(db, csvOf([baw()]))
    await confirmAllReady(db, first.runId)
    clock(daysAfter(38, IMPORT_AT))
    const second = await uploadCsv(
      db,
      csvOf([baw({ 'Gate Arrival (Actual)': '2026-05-02T07:10' })]),
    )
    const [row] = await snapshot(db, second.runId)
    expect(row).toMatchObject({ state: 'needs_review', finding: { kind: 'source_changed' } })
    expect(await flightsOf()).toHaveLength(1)
  })

  it('needs a decision for each of two records with the same date and route in one file', async () => {
    const csv = csvOf([
      baw({ 'Flight Flighty ID': 'f0000000-0000-4000-8000-0000000000c1' }),
      baw({ Flight: '179', 'Flight Flighty ID': 'f0000000-0000-4000-8000-0000000000c2' }),
    ])
    const { runId } = await uploadCsv(db, csv)
    const rows = await snapshot(db, runId)
    expect(rows.map((row) => [row.state, row.finding?.kind])).toEqual([
      ['needs_review', 'repeated_in_file'],
      ['needs_review', 'repeated_in_file'],
    ])
    for (const row of rows) {
      const answered = await patchRow(db, runId, row.id, {
        version: row.version,
        answers: { match: 'new' },
      })
      expect(answered.status, JSON.stringify(answered.body)).toBe(200)
    }
    await confirmAllReady(db, runId)
    expect(await flightsOf()).toHaveLength(2)
  })

  it('does not let a re-import multiply an occurrence: a repeat receipt is not a second accepted record', async () => {
    const csv = csvOf([baw()])
    const first = await uploadCsv(db, csv)
    await confirmAllReady(db, first.runId)
    clock(daysAfter(38, IMPORT_AT))
    const second = await uploadCsv(db, csv)
    await confirmAllReady(db, second.runId)
    expect((await snapshot(db, second.runId))[0]).toMatchObject({ state: 'duplicate' })

    clock(daysAfter(76, IMPORT_AT))
    const third = await uploadCsv(db, csvOf([baw(), baw()]))
    const rows = await snapshot(db, third.runId)
    expect(rows.filter((row) => row.state === 'ready' && row.action === 'link')).toHaveLength(1)
    expect(rows.filter((row) => row.state === 'needs_review')).toHaveLength(1)
    expect(await confirmAllReady(db, third.runId)).toHaveLength(1)
    expect(await flightsOf()).toHaveLength(1)
  })

  it('keeps the same-date-and-route guard when a new_since_import record is answered new', async () => {
    const first = await uploadCsv(db, csvOf([baw()]))
    await confirmAllReady(db, first.runId)
    clock(daysAfter(38, IMPORT_AT))
    const later = baw({
      Date: '2026-06-01',
      'Flight Flighty ID': 'f0000000-0000-4000-8000-0000000000dd',
      'Gate Departure (Actual)': '2026-06-01T19:00',
      'Gate Arrival (Actual)': '2026-06-02T07:00',
    })
    const second = await uploadCsv(db, csvOf([baw(), later]))
    const revision = (await getPage(db, second.runId)).body.run.revision
    const answered = await postGroup(db, second.runId, {
      group: 'match:new_since_import',
      answer: 'new',
      revision,
    })
    expect(answered.status, JSON.stringify(answered.body)).toBe(200)
    const row = (await snapshot(db, second.runId)).find((entry) => entry.ordinal === 1)!
    expect(row).toMatchObject({ state: 'ready', action: 'create' })

    // A manual flight lands on that date and route before the owner confirms.
    const manual = await createFlight(db, { date: '2026-06-01', origin: 'JFK', destination: 'LHR' })
    expect(manual.status, JSON.stringify(manual.body)).toBe(201)
    const attempt = await postConfirm(db, second.runId, [
      { rowId: row.id, version: row.version, key: historyKey() },
    ])
    expect(attempt.body.results[0]).toMatchObject({ status: 'error', code: 'HISTORY_DUPLICATE' })
    expect(await flightsOf()).toHaveLength(2)
    expect((await snapshot(db, second.runId)).find((entry) => entry.ordinal === 1)).toMatchObject({
      state: 'needs_review',
      finding: { kind: 'existing_flight', flightId: manual.body.id },
    })
  })

  it('sends a link row back to review when its target flight was deleted before confirmation', async () => {
    const csv = csvOf([baw()])
    const first = await uploadCsv(db, csv)
    await confirmAllReady(db, first.runId)
    clock(daysAfter(38, IMPORT_AT))
    const second = await uploadCsv(db, csv)
    const [row] = await snapshot(db, second.runId)
    expect(row).toMatchObject({ state: 'ready', finding: { kind: 'previous_import' } })
    const flightId = row.finding!.flightId!
    expect((await deleteFlight(db, flightId)).status).toBe(200)

    const attempt = await postConfirm(db, second.runId, [
      { rowId: row.id, version: row.version, key: historyKey() },
    ])
    expect(attempt.body.results[0]).toMatchObject({
      status: 'error',
      code: 'HISTORY_ROW_NEEDS_REVIEW',
    })
    const [reopened] = await snapshot(db, second.runId)
    expect(reopened).toMatchObject({
      state: 'needs_review',
      version: row.version + 1,
      finding: { kind: 'previous_deleted', flightId: null, rowId: row.finding!.rowId },
    })

    const answered = await patchRow(db, second.runId, reopened.id, {
      version: reopened.version,
      answers: { match: 'new' },
    })
    expect(answered.status, JSON.stringify(answered.body)).toBe(200)
    await confirmAllReady(db, second.runId)
    expect(await flightsOf()).toHaveLength(1)
  })

  it('asks before re-adding a record that was only linked to a flight the owner deleted', async () => {
    const manual = await createFlight(db, { date: '2026-05-01', origin: 'JFK', destination: 'LHR' })
    expect(manual.status, JSON.stringify(manual.body)).toBe(201)
    const first = await uploadCsv(db, csvOf([baw()]))
    const [row] = await snapshot(db, first.runId)
    const linked = await patchRow(db, first.runId, row.id, {
      version: row.version,
      answers: { match: 'link' },
    })
    expect(linked.status, JSON.stringify(linked.body)).toBe(200)
    await confirmAllReady(db, first.runId)
    expect((await snapshot(db, first.runId))[0]).toMatchObject({
      action: 'link',
      flightId: manual.body.id,
    })
    expect((await deleteFlight(db, manual.body.id)).status).toBe(200)

    clock(daysAfter(38, IMPORT_AT))
    const second = await uploadCsv(db, csvOf([baw()]))
    const [again] = await snapshot(db, second.runId)
    expect(again).toMatchObject({ state: 'needs_review', finding: { kind: 'previous_deleted' } })
    expect(await flightsOf()).toHaveLength(0)
  })
  it('flags a manually created flight with the same date and route', async () => {
    const manual = await createFlight(db, { date: '2026-05-01', origin: 'JFK', destination: 'LHR' })
    expect(manual.status, JSON.stringify(manual.body)).toBe(201)
    const { runId } = await uploadCsv(db, csvOf([baw()]))
    const [row] = await snapshot(db, runId)
    expect(row).toMatchObject({
      state: 'needs_review',
      finding: { kind: 'existing_flight', flightId: manual.body.id },
    })
    expect(await allRows(db, runId, 'ready')).toHaveLength(0)
  })
})
