// ADR 0001 §6 (T10): draft conversion. Receipt-first replay, the guarded statement chain, per-item classification,
// A4 (two tabs, replay after 8 and 36 days, 410 tombstone), partial-conversion retries and the T09 carry-over
// (the awaiting queue's draft summaries against real conversions).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import maintenance from '../../workers/maintenance/index'
import { count, csrfRequest } from './harness'
import { hasSql, instrumentDb } from './db-hooks'
import { getAwaiting } from './queue-fixture'
import { onRequestPost as bulkRoute } from '../api/flights/bulk'
import {
  NOW, OTHER, USER, clock, confirm, daysAfter, getBatch, importAccount, itemKey, patchDraft, postJob, providerFlight, providerText, seedBatch,
} from './import-fixture'

const provider = vi.hoisted(() => ({ generateContent: vi.fn() }))
vi.mock('@google/genai', async importOriginal => {
  const actual = await importOriginal<typeof import('@google/genai')>()
  return { ...actual, GoogleGenAI: class { models = { generateContent: provider.generateContent } } }
})

let account: Awaited<ReturnType<typeof importAccount>>
let db: D1Database
beforeAll(async () => { account = await importAccount(); db = account.db })
afterAll(async () => { await account.dispose() })
afterEach(async () => {
  vi.useRealTimers()
  provider.generateContent.mockReset()
  await db.batch(['import_conversion_receipts', 'import_drafts', 'import_batches', 'auth_rate_limits', 'flight_idempotency', 'flights',
    'user_derived_state', 'user_stats', 'visits'].map(table => db.prepare(`DELETE FROM ${table}`)))
  await db.prepare('DROP TRIGGER IF EXISTS fail_receipt').run()
  await db.prepare('DROP TRIGGER IF EXISTS fail_flight').run()
  await db.prepare('DROP TRIGGER IF EXISTS fail_complete').run()
})

const seed = (flights: unknown[], user = USER) => seedBatch(db, list => provider.generateContent.mockResolvedValue({ text: providerText(list) }), flights, user)
const flightRows = () => db.prepare('SELECT * FROM flights ORDER BY id').all<Record<string, any>>().then(r => r.results)
const draftRow = (id: string) => db.prepare('SELECT * FROM import_drafts WHERE id = ?').bind(id).first<Record<string, any>>()
const receipts = () => db.prepare('SELECT * FROM import_conversion_receipts ORDER BY draft_id').all<Record<string, any>>().then(r => r.results)
const cycle = () => maintenance.scheduled({} as ScheduledEvent, { DB: db, MAINTENANCE_MODE: 'false' })
const item = (draft: { id: string; version: number }, key = itemKey()) => ({ draftId: draft.id, version: draft.version, key })
const codes = (results: Array<Record<string, any>>) => results.map(result => result.status === 'error' ? result.code : result.status)

describe('conversion', () => {
  it('creates ai_import flights through the shared create path, flips the drafts and writes a receipt each', async () => {
    clock()
    const created = await seed([providerFlight(), providerFlight({ date: '2026-03-11', origin: 'LHR', destination: 'JFK' }), providerFlight({ date: '2026-12-01', origin: 'TBS', destination: 'IST' })])
    expect(await count(db, 'flights')).toBe(0)
    const items = created.drafts.map(draft => item(draft))
    const { status, body } = await confirm(db, created.batch.id, { items, timezone: 'UTC' })
    expect(status).toBe(200)
    expect(codes(body.results)).toEqual(['created', 'created', 'created'])
    expect(body).toMatchObject({ derived_state: 'ready', batch: { id: created.batch.id, status: 'completed', reviewRowCount: 0 } })
    expect(body.batch.sequence).toBeGreaterThan(created.batch.sequence)
    const flights = await flightRows()
    expect(flights.map(row => [row.origin, row.destination, row.source, row.lifecycle_state, row.confirmation_source, row.enrichment_status]))
      .toEqual([['JFK', 'LHR', 'ai_import', 'logged', 'save', 'skipped'], ['LHR', 'JFK', 'ai_import', 'logged', 'save', 'skipped'], ['TBS', 'IST', 'ai_import', 'upcoming', null, 'skipped']])
    expect(flights[0]).toMatchObject({ airline_iata: 'BA', flight_number: '178', aircraft_icao: 'B738', departure_time: '19:00' })
    expect(flights[0].distance_km).toBeGreaterThan(0)
    expect(body.results.map((r: any) => r.flight.id)).toEqual(flights.map(row => row.id))
    for (const [index, draft] of created.drafts.entries()) {
      expect(await draftRow(draft.id)).toMatchObject({ status: 'converted', version: 2, converted_flight_id: flights[index].id })
    }
    expect((await receipts()).map(row => [row.operation_key, row.flight_id, row.batch_id, row.user_id]).sort())
      .toEqual(items.map((entry, index) => [entry.key, flights[index].id, created.batch.id, USER.id]).sort())
    expect(await count(db, 'flight_idempotency')).toBe(3)
    // Only now do the stats move: the drafts alone never did.
    expect(await db.prepare('SELECT total_flights FROM user_stats WHERE user_id = ?').bind(USER.id).first()).toEqual({ total_flights: 2 }) // the upcoming flight does not count yet
    expect((await getBatch(db, created.batch.id)).body.drafts.map((d: any) => [d.status, d.convertedFlightId, d.duplicateFlightId]))
      .toEqual(flights.map(row => ['converted', row.id, null]))
  })

  it('answers a replay with the same key from the receipt, without writing again', async () => {
    clock()
    const created = await seed([providerFlight()])
    const items = [item(created.drafts[0])]
    const first = await confirm(db, created.batch.id, { items })
    const replay = await confirm(db, created.batch.id, { items })
    expect(codes(first.body.results)).toEqual(['created'])
    expect(codes(replay.body.results)).toEqual(['replayed'])
    expect(replay.body.results[0].flight.id).toBe(first.body.results[0].flight.id)
    expect(replay.body).toMatchObject({ derived_state: 'ready' })
    expect(await count(db, 'flights')).toBe(1)
    expect(await count(db, 'import_conversion_receipts')).toBe(1)
  })

  it('A4: two tabs converting the same draft under different keys create exactly one flight', async () => {
    clock()
    const created = await seed([providerFlight()])
    const tabA = [item(created.drafts[0], 'tab-a-key-00001')]
    const tabB = [item(created.drafts[0], 'tab-b-key-00001')]
    const [a, b] = await Promise.all([confirm(db, created.batch.id, { items: tabA }), confirm(db, created.batch.id, { items: tabB })])
    expect([...codes(a.body.results), ...codes(b.body.results)].sort()).toEqual(['DRAFT_ALREADY_CONVERTED', 'created'])
    const loser = [...a.body.results, ...b.body.results].find((result: any) => result.status === 'error')
    expect(loser).toMatchObject({ http_status: 409, flightId: (await flightRows())[0].id })
    expect(await count(db, 'flights')).toBe(1)
    expect(await count(db, 'import_conversion_receipts')).toBe(1)
    expect(await count(db, 'flight_idempotency')).toBe(1)
  })

  it('A4: a tab that read the draft before the other tab converted it writes nothing and is told so', async () => {
    clock()
    const created = await seed([providerFlight()])
    const { db: tracked, hooks } = instrumentDb(db)
    const tabB = [item(created.drafts[0], 'tab-b-key-00002')]
    hooks.beforeBatch(hasSql('INSERT INTO import_conversion_receipts'), async () => {
      expect(codes((await confirm(db, created.batch.id, { items: tabB })).body.results)).toEqual(['created'])
    })
    const a = await confirm(tracked, created.batch.id, { items: [item(created.drafts[0], 'tab-a-key-00002')] })
    expect(a.body.results[0]).toMatchObject({ status: 'error', code: 'DRAFT_ALREADY_CONVERTED', http_status: 409 })
    expect(await count(db, 'flights')).toBe(1)
    expect(await count(db, 'flight_idempotency')).toBe(1) // tab A's guarded ledger insert wrote nothing
    expect(await count(db, 'import_conversion_receipts')).toBe(1)
    expect((await receipts())[0].operation_key).toBe('tab-b-key-00002')
  })

  it('answers concurrent same-key confirms with one created and one replayed', async () => {
    clock()
    const created = await seed([providerFlight()])
    const items = [item(created.drafts[0], 'same-key-000001')]
    const [a, b] = await Promise.all([confirm(db, created.batch.id, { items }), confirm(db, created.batch.id, { items })])
    expect([...codes(a.body.results), ...codes(b.body.results)].sort()).toEqual(['created', 'replayed'])
    expect(a.body.results[0].flight.id).toBe(b.body.results[0].flight.id)
    expect(await count(db, 'flights')).toBe(1)
  })

  it('A4: replays after 8 days (ledger purged) and after 36 days (batch expired, drafts deleted), then ages out at 37', async () => {
    clock()
    const created = await seed([providerFlight()])
    const items = [item(created.drafts[0], 'replay-key-0001')]
    const first = await confirm(db, created.batch.id, { items })
    const flightId = first.body.results[0].flight.id

    clock(daysAfter(8))
    await cycle()
    expect(await count(db, 'flight_idempotency')).toBe(0)
    const day8 = await confirm(db, created.batch.id, { items })
    expect(day8.status).toBe(200)
    expect(day8.body.results[0]).toMatchObject({ status: 'replayed', flight: { id: flightId } })

    clock(daysAfter(36))
    await cycle()
    expect(await count(db, 'import_drafts')).toBe(0) // expired batch: drafts are gone ...
    expect(await count(db, 'import_batches')).toBe(1) // ... its row stays until expiry + 7 days
    expect(await count(db, 'import_conversion_receipts')).toBe(1)
    const day36 = await confirm(db, created.batch.id, { items })
    expect(day36.status).toBe(200)
    expect(day36.body.results[0]).toMatchObject({ status: 'replayed', flight: { id: flightId } })
    expect(await count(db, 'flights')).toBe(1)

    clock(daysAfter(38))
    await cycle()
    expect(await count(db, 'import_conversion_receipts')).toBe(0)
    expect((await confirm(db, created.batch.id, { items })).status).toBe(404)
    expect(await count(db, 'flights')).toBe(1)
  })

  it('A4: a deleted converted flight is a 410 tombstone and is never recreated', async () => {
    clock()
    const created = await seed([providerFlight()])
    const items = [item(created.drafts[0], 'tombstone-key-1')]
    const first = await confirm(db, created.batch.id, { items })
    const flightId = first.body.results[0].flight.id
    await db.prepare('DELETE FROM flights WHERE id = ?').bind(flightId).run()

    const replay = await confirm(db, created.batch.id, { items })
    expect(replay.status).toBe(200)
    expect(replay.body.results[0]).toMatchObject({ status: 'error', http_status: 410, code: 'CONVERTED_FLIGHT_DELETED', flightId })
    // Another key for the same draft cannot resurrect it either.
    const other = await confirm(db, created.batch.id, { items: [item(created.drafts[0], 'tombstone-key-2')] })
    expect(other.body.results[0]).toMatchObject({ status: 'error', code: 'DRAFT_ALREADY_CONVERTED', flightId })
    expect(await count(db, 'flights')).toBe(0)
    expect(await count(db, 'import_conversion_receipts')).toBe(1)

    clock(daysAfter(36))
    await cycle()
    expect((await confirm(db, created.batch.id, { items })).body.results[0]).toMatchObject({ http_status: 410, code: 'CONVERTED_FLIGHT_DELETED' })
    expect(await count(db, 'flights')).toBe(0)
  })

  it('refuses a key reused for another draft or another version, writing nothing for it', async () => {
    clock()
    const created = await seed([providerFlight(), providerFlight({ date: '2026-03-11' })])
    const [one, two] = created.drafts
    await confirm(db, created.batch.id, { items: [item(one, 'reused-key-0001')] })
    const otherDraft = await confirm(db, created.batch.id, { items: [{ draftId: two.id, version: two.version, key: 'reused-key-0001' }] })
    expect(otherDraft.body.results[0]).toMatchObject({ status: 'error', code: 'IDEMPOTENCY_CONFLICT', http_status: 409 })
    const otherVersion = await confirm(db, created.batch.id, { items: [{ draftId: one.id, version: one.version + 5, key: 'reused-key-0001' }] })
    expect(otherVersion.body.results[0]).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
    expect(await draftRow(two.id)).toMatchObject({ status: 'review', version: 1 })
    expect(await count(db, 'flights')).toBe(1)
  })

  it('refuses a key already in the flight ledger from a plain create, writing nothing', async () => {
    clock()
    const created = await seed([providerFlight()])
    const plain = await bulkRoute({ request: csrfRequest('/api/flights/bulk', 'POST', { items: [{ key: 'plain-key-00001', flight: { date: '2026-01-01', origin: 'TBS', destination: 'IST' } }] }),
      env: { DB: db }, data: { user: USER }, params: {}, waitUntil() {} } as never)
    expect(plain.status).toBe(200)
    const result = await confirm(db, created.batch.id, { items: [item(created.drafts[0], 'plain-key-00001')] })
    expect(result.body.results[0]).toMatchObject({ status: 'error', code: 'IDEMPOTENCY_CONFLICT', http_status: 409 })
    expect(await draftRow(created.drafts[0].id)).toMatchObject({ status: 'review', version: 1 })
    expect(await count(db, 'flights')).toBe(1)
    expect(await count(db, 'import_conversion_receipts')).toBe(0)
  })

  it('refuses a stale version and a dismissed row, and converts the version the member reviewed', async () => {
    clock()
    const created = await seed([providerFlight(), providerFlight({ date: '2026-03-11' })])
    const [one, two] = created.drafts
    expect((await patchDraft(db, one.id, { version: 1, fields: { flight_number: '999' } })).status).toBe(200)
    expect((await patchDraft(db, two.id, { version: 1, dismissed: true })).status).toBe(200)
    const stale = await confirm(db, created.batch.id, { items: [item(one), item({ id: two.id, version: 2 })] })
    expect(codes(stale.body.results)).toEqual(['DRAFT_VERSION_CONFLICT', 'DRAFT_VERSION_CONFLICT'])
    expect(await count(db, 'flights')).toBe(0)
    expect(await count(db, 'flight_idempotency')).toBe(0)
    const fresh = await confirm(db, created.batch.id, { items: [item({ id: one.id, version: 2 })] })
    expect(codes(fresh.body.results)).toEqual(['created'])
    expect((await flightRows())[0].flight_number).toBe('999')
    expect(fresh.body.batch).toMatchObject({ status: 'completed', reviewRowCount: 0 }) // nothing is left in review: converted and dismissed rows are done
  })

  it('keeps an invalid reference as a correctable draft and a retry creates only the failed flight', async () => {
    clock()
    const created = await seed([providerFlight(), providerFlight({ date: '2026-03-11', origin: 'XXX' }), providerFlight({ date: '2026-03-12', aircraft_icao: 'QQQQ' })])
    const items = created.drafts.map(draft => item(draft))
    const first = await confirm(db, created.batch.id, { items })
    expect(codes(first.body.results)).toEqual(['created', 'UNKNOWN_AIRPORT', 'UNKNOWN_AIRCRAFT'])
    expect(first.body.results[1]).toMatchObject({ http_status: 400 })
    expect(await count(db, 'flights')).toBe(1)
    expect(await draftRow(created.drafts[1].id)).toMatchObject({ status: 'review', version: 1 })
    expect(first.body.batch).toMatchObject({ status: 'review', reviewRowCount: 2 })

    // The member corrects both rows; the retry reuses every key. The converted row is not created twice.
    const fixedAirport = await patchDraft(db, created.drafts[1].id, { version: 1, fields: { origin: 'TBS' } })
    const fixedAircraft = await patchDraft(db, created.drafts[2].id, { version: 1, fields: { aircraft_icao: 'B738' } })
    expect([fixedAirport.status, fixedAircraft.status]).toEqual([200, 200])
    const retry = await confirm(db, created.batch.id, { items: [items[0], { ...items[1], version: 2 }, { ...items[2], version: 2 }] })
    expect(codes(retry.body.results)).toEqual(['replayed', 'created', 'created'])
    expect(await count(db, 'flights')).toBe(3)
    expect(await count(db, 'import_conversion_receipts')).toBe(3)
    expect(retry.body.batch).toMatchObject({ status: 'completed', reviewRowCount: 0 })
  })

  it('requires the year decision and the duplicate acknowledgement before a row converts', async () => {
    clock()
    await db.prepare("INSERT INTO flights (user_id,date,origin,destination,is_upcoming,lifecycle_state,confirmation_source) VALUES (?,'2026-03-10','JFK','LHR',0,'logged','legacy')").bind(USER.id).run()
    const created = await seed([providerFlight(), providerFlight({ date: '2026-03-12', field_confidence: { date_year_explicit: false } })])
    const [duplicate, noYear] = created.drafts
    const first = await confirm(db, created.batch.id, { items: [item(duplicate), item(noYear)] })
    expect(codes(first.body.results)).toEqual(['DUPLICATE_NOT_ACKNOWLEDGED', 'YEAR_NOT_CONFIRMED'])
    expect(first.body.results[0]).toMatchObject({ http_status: 409, flightId: (await flightRows())[0].id })
    expect(await count(db, 'flights')).toBe(1)
    expect(await count(db, 'flight_idempotency')).toBe(0)

    // A date typed in without the explicit year decision still does not convert; the decision does.
    const typed = await patchDraft(db, noYear.id, { version: 1, fields: { date: '2026-03-12' } })
    expect(codes((await confirm(db, created.batch.id, { items: [item({ id: noYear.id, version: 2 })] })).body.results)).toEqual(['YEAR_NOT_CONFIRMED'])
    expect(typed.status).toBe(200)
    const ackDup = await patchDraft(db, duplicate.id, { version: 1, duplicateAcknowledged: true })
    const ackYear = await patchDraft(db, noYear.id, { version: 2, yearConfirmed: true })
    expect([ackDup.status, ackYear.status]).toEqual([200, 200])
    const second = await confirm(db, created.batch.id, { items: [item({ id: duplicate.id, version: 2 }), item({ id: noYear.id, version: 3 })] })
    expect(codes(second.body.results)).toEqual(['created', 'created'])
    expect(await count(db, 'flights')).toBe(3)
  })

  it('refuses an expired batch, delivers a replay in the same request, and finds a discarded batch missing', async () => {
    clock()
    const created = await seed([providerFlight(), providerFlight({ date: '2026-03-11' })])
    const [one, two] = created.drafts
    const done = [item(one, 'expiry-key-0001')]
    await confirm(db, created.batch.id, { items: done })

    clock(daysAfter(31))
    const expired = await confirm(db, created.batch.id, { items: [item(two)] })
    expect(expired.status).toBe(410)
    expect(expired.body.code).toBe('IMPORT_BATCH_EXPIRED')
    const mixed = await confirm(db, created.batch.id, { items: [...done, item(two)] })
    expect(mixed.status).toBe(200)
    expect(codes(mixed.body.results)).toEqual(['replayed', 'IMPORT_BATCH_EXPIRED'])
    expect(mixed.body.results[1]).toMatchObject({ http_status: 410 })
    expect(await draftRow(two.id)).toMatchObject({ status: 'review', version: 1 })
    expect(await count(db, 'flights')).toBe(1)

    clock()
    await db.prepare('DELETE FROM import_drafts WHERE batch_id = ?').bind(created.batch.id).run()
    await db.prepare('DELETE FROM import_batches WHERE id = ?').bind(created.batch.id).run()
    expect((await confirm(db, created.batch.id, { items: [item(two)] })).status).toBe(404)
    expect(codes((await confirm(db, created.batch.id, { items: done })).body.results)).toEqual(['replayed']) // the receipt outlives the batch
  })

  it('validates the request, the owner and the batch before writing', async () => {
    clock()
    const created = await seed([providerFlight()])
    const mine = await seed([providerFlight({ date: '2026-03-15' })])
    const [draft] = created.drafts
    const good = [item(draft)]
    expect((await confirm(db, created.batch.id, { items: good }, null)).status).toBe(401)
    expect((await confirm(db, created.batch.id, { items: good }, USER, { 'X-CSRF-Token': 'forged' })).status).toBe(403)
    expect((await confirm(db, created.batch.id, { items: good }, OTHER)).status).toBe(404)
    expect((await confirm(db, 'no-such-batch', { items: good })).status).toBe(404)
    for (const body of [{}, { items: [] }, { items: 'x' }, { items: [null] }, { items: [{ draftId: draft.id, version: 0, key: 'valid-key-0001' }] },
      { items: [{ draftId: draft.id, version: 1, key: 'short' }] }, { items: [{ version: 1, key: 'valid-key-0001' }] },
      { items: [item(draft, 'dup-key-000001'), item(draft, 'dup-key-000002')] }, { items: good, timezone: 'Nowhere/Land' }]) {
      expect((await confirm(db, created.batch.id, body)).status, JSON.stringify(body)).toBe(400)
    }
    const tooMany = Array.from({ length: 51 }, (_, i) => ({ draftId: `d${i}`, version: 1, key: `many-key-${String(i).padStart(5, '0')}` }))
    expect((await confirm(db, created.batch.id, { items: tooMany })).status).toBe(413)
    // A draft of another batch of the same owner is not found in this one.
    expect((await confirm(db, created.batch.id, { items: [item(mine.drafts[0])] })).body.results[0]).toMatchObject({ code: 'DRAFT_NOT_FOUND', http_status: 404 })
    // A processing batch does not convert.
    await db.prepare("UPDATE import_batches SET status = 'processing' WHERE id = ?").bind(created.batch.id).run()
    const processing = await confirm(db, created.batch.id, { items: good })
    expect(processing.status).toBe(409)
    expect(processing.body.code).toBe('IMPORT_BATCH_PROCESSING')
    expect(await count(db, 'flights')).toBe(0)
    expect(await count(db, 'flight_idempotency')).toBe(0)
  })

  it('rolls back flight, ledger, draft and receipt together when the last statement fails', async () => {
    clock()
    const created = await seed([providerFlight()])
    const items = [item(created.drafts[0], 'rollback-key-01')]
    await db.prepare("CREATE TRIGGER fail_receipt BEFORE INSERT ON import_conversion_receipts BEGIN SELECT RAISE(ABORT, 'synthetic receipt failure'); END").run()
    const failed = await confirm(db, created.batch.id, { items })
    expect(failed.status).toBe(500)
    expect(await count(db, 'flights')).toBe(0)
    expect(await count(db, 'flight_idempotency')).toBe(0)
    expect(await draftRow(created.drafts[0].id)).toMatchObject({ status: 'review', version: 1, converted_flight_id: null })
    await db.prepare('DROP TRIGGER fail_receipt').run()
    expect(codes((await confirm(db, created.batch.id, { items })).body.results)).toEqual(['created'])
    expect(await count(db, 'flights')).toBe(1)
  })

  it('leaves every other item committed when one item fails validation, with one dirty mark', async () => {
    clock()
    const created = await seed([providerFlight(), providerFlight({ date: '2026-03-11', destination: 'XXX' }), providerFlight({ date: '2026-03-12' })])
    const { body } = await confirm(db, created.batch.id, { items: created.drafts.map(draft => item(draft)) })
    expect(codes(body.results)).toEqual(['created', 'UNKNOWN_AIRPORT', 'created'])
    expect((await db.prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?').bind(USER.id).first())).toEqual({ revision: 1, published_revision: 1 })
  })
})

describe('T15 review fixes', () => {
  it('C1: keeps a batch with impossible calendar dates readable and refuses only those rows', async () => {
    clock()
    provider.generateContent.mockResolvedValue({ text: providerText([
      providerFlight({ date: '2026-13-10' }), providerFlight({ date: '2026-02-30' }), providerFlight({ date: '2026-03-11', origin: 'LHR', destination: 'JFK' }),
    ]) })
    const job = await postJob(db, {})
    expect(job.status).toBe(201)
    const snapshot = await getBatch(db, job.body.batch.id)
    expect(snapshot.status).toBe(200)
    const [month, day, valid] = snapshot.body.drafts
    expect(snapshot.body.drafts.map((draft: any) => draft.fields.date)).toEqual(['2026-13-10', '2026-02-30', '2026-03-11'])
    for (const invalid of [month, day]) {
      expect(invalid).toMatchObject({ status: 'review', duplicateFlightId: null, issue: { code: 'INVALID_FLIGHT' } })
    }
    expect(valid).toMatchObject({ status: 'review', duplicateFlightId: null, issue: null })

    const { status, body } = await confirm(db, job.body.batch.id, { items: [item(month), item(day), item(valid)] })
    expect(status).toBe(200)
    expect(codes(body.results)).toEqual(['INVALID_FLIGHT', 'INVALID_FLIGHT', 'created'])
    expect(body.results[0]).toMatchObject({ http_status: 400 })
    expect((await flightRows()).map(row => [row.date, row.origin, row.destination])).toEqual([['2026-03-11', 'LHR', 'JFK']])
    expect(await count(db, 'flight_idempotency')).toBe(1)
    for (const invalid of [month, day]) expect(await draftRow(invalid.id)).toMatchObject({ status: 'review', version: 1, converted_flight_id: null })
    expect(body.batch).toMatchObject({ status: 'review', reviewRowCount: 2 })
    expect((await getBatch(db, job.body.batch.id)).status).toBe(200)
  })

  it('I2: batch completion commits with the conversion, so a failed completion leaves nothing behind and the retry frees the slot', async () => {
    clock()
    const created = await seed([providerFlight()])
    // Nine more open batches: with the seeded one the owner is at the open-batch limit.
    await db.batch(Array.from({ length: 9 }, (_, index) => db.prepare(
      "INSERT INTO import_batches (id,user_id,source_type,status,submission_operation_id,created_at,updated_at,expires_at) VALUES (?,?,'text','review',?,?,?,?)",
    ).bind(`open-${index}`, USER.id, `open-op-${index}`, NOW.toISOString(), NOW.toISOString(), daysAfter(30).toISOString())))
    expect((await postJob(db, {})).body.code).toBe('IMPORT_BATCH_LIMIT')
    const batchRow = () => db.prepare('SELECT status, sequence FROM import_batches WHERE id = ?').bind(created.batch.id).first<{ status: string; sequence: number }>()
    const before = await batchRow()

    await db.prepare("CREATE TRIGGER fail_complete BEFORE UPDATE OF status ON import_batches WHEN NEW.status = 'completed' BEGIN SELECT RAISE(ABORT, 'synthetic completion failure'); END").run()
    const items = [item(created.drafts[0], 'complete-key-01')]
    const failed = await confirm(db, created.batch.id, { items })
    expect(failed.status).toBe(500)
    // Nothing of the conversion committed without its completion.
    expect(await count(db, 'flights')).toBe(0)
    expect(await count(db, 'import_conversion_receipts')).toBe(0)
    expect(await draftRow(created.drafts[0].id)).toMatchObject({ status: 'review', version: 1 })
    expect(await batchRow()).toEqual(before)
    await db.prepare('DROP TRIGGER fail_complete').run()

    const retry = await confirm(db, created.batch.id, { items })
    expect(retry.status).toBe(200)
    expect(codes(retry.body.results)).toEqual(['created'])
    expect(retry.body.batch).toMatchObject({ status: 'completed', reviewRowCount: 0 })
    expect(retry.body.batch.sequence).toBeGreaterThan(before!.sequence)
    expect(await batchRow()).toEqual({ status: 'completed', sequence: retry.body.batch.sequence })
    expect(await count(db, 'flights')).toBe(1)
    expect(await count(db, 'import_conversion_receipts')).toBe(1)
    // The completed batch no longer holds an open slot.
    expect((await postJob(db, {})).status).toBe(201)
    // A later receipt-only replay changes nothing.
    const replay = await confirm(db, created.batch.id, { items })
    expect(codes(replay.body.results)).toEqual(['replayed'])
    expect(await batchRow()).toEqual({ status: 'completed', sequence: retry.body.batch.sequence })
  })
})

describe('the awaiting queue (T09 carry-over)', () => {
  it('lists a completed batch again, consistently, when a dismissed row is restored', async () => {
    clock()
    const created = await seed([providerFlight(), providerFlight({ date: '2026-03-11' })])
    const [a, b] = created.drafts
    await patchDraft(db, b.id, { version: 1, dismissed: true })
    const done = await confirm(db, created.batch.id, { items: [item(a)] })
    expect(done.body.batch.status).toBe('completed')
    expect((await getAwaiting(db, USER)).body).toMatchObject({ draftRowCount: 0, drafts: [] })
    await patchDraft(db, b.id, { version: 2, dismissed: false })
    expect((await getBatch(db, created.batch.id)).body.batch.status).toBe('review')
    const queue = (await getAwaiting(db, USER)).body
    expect(queue).toMatchObject({ draftRowCount: 1, actionableCount: 1 })
    expect(queue.drafts).toMatchObject([{ batchId: created.batch.id, status: 'review', reviewRowCount: 1 }])
  })

  it('summarises open batches by their review rows and follows real conversions', async () => {
    clock()
    const created = await seed([providerFlight(), providerFlight({ date: '2026-03-11' })])
    const other = await seed([providerFlight()], OTHER)
    const summary = (await getAwaiting(db, USER)).body
    expect(summary).toMatchObject({ draftRowCount: 2, awaitingFlightCount: 0, actionableCount: 2 })
    expect(summary.drafts).toEqual([{ batchId: created.batch.id, sourceType: 'text', sourceLabel: null, status: 'review', reviewRowCount: 2, expiresAt: daysAfter(30).toISOString() }])

    const [one, two] = created.drafts
    await confirm(db, created.batch.id, { items: [item(one)] })
    const half = (await getAwaiting(db, USER)).body
    expect(half).toMatchObject({ draftRowCount: 1, actionableCount: 1 })
    expect(half.drafts).toMatchObject([{ batchId: created.batch.id, status: 'review', reviewRowCount: 1 }])

    await patchDraft(db, two.id, { version: 1, dismissed: true })
    const dismissed = (await getAwaiting(db, USER)).body
    expect(dismissed).toMatchObject({ draftRowCount: 0, actionableCount: 0, drafts: [] })

    await patchDraft(db, two.id, { version: 2, dismissed: false })
    expect((await getAwaiting(db, USER)).body.draftRowCount).toBe(1)
    await confirm(db, created.batch.id, { items: [item({ id: two.id, version: 3 })] })
    const done = (await getAwaiting(db, USER)).body
    expect(done).toMatchObject({ draftRowCount: 0, actionableCount: 0, drafts: [] })
    expect((await getBatch(db, created.batch.id)).body.batch.status).toBe('completed')
    // Another owner's rows never show, and an expired batch drops out.
    expect((await getAwaiting(db, OTHER)).body).toMatchObject({ draftRowCount: 1 })
    clock(daysAfter(31))
    expect((await getAwaiting(db, OTHER)).body).toMatchObject({ draftRowCount: 0, drafts: [] })
    expect(other.batch.id).not.toBe(created.batch.id)
  })
})
