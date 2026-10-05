// ADR 0001 §6 (T10): the synchronous batch writer, snapshot reads, draft edits, discard, the deletion fence (A10)
// and the storage rules. Conversion is covered in import-conversion.test.ts.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@google/genai'
import { deleteUserCascade } from '../api/_lib/users'
import { persistDraftRows } from '../api/_services/importDrafts'
import { count } from './harness'
import { instrumentDb } from './db-hooks'
import {
  NOW, OTHER, USER, clock, daysAfter, deleteBatch, getBatch, importAccount, opId, patchDraft, postJob,
  providerFlight, providerText, seedBatch,
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
  await db.batch(['import_conversion_receipts', 'import_drafts', 'import_batches', 'auth_rate_limits', 'flight_idempotency', 'flights']
    .map(table => db.prepare(`DELETE FROM ${table}`)))
})

const answer = (flights: unknown[], extra: Record<string, unknown> = {}) =>
  provider.generateContent.mockResolvedValue({ text: providerText(flights, extra) })
const seed = (flights: unknown[], user = USER) => seedBatch(db, list => answer(list), flights, user)
const batchRow = (id: string) => db.prepare('SELECT * FROM import_batches WHERE id = ?').bind(id).first<Record<string, any>>()
const draftRows = (batchId: string) => db.prepare('SELECT * FROM import_drafts WHERE batch_id = ? ORDER BY ordinal').bind(batchId).all<Record<string, any>>().then(r => r.results)

describe('POST /api/import/jobs', () => {
  it('persists the batch and its drafts from one provider call and returns the snapshot', async () => {
    clock()
    answer([providerFlight(), providerFlight({ date: '2026-03-11', origin: 'LHR', destination: 'JFK', flight_number: '179' })])
    const { status, body } = await postJob(db, { type: 'text', content: 'Flight details', sourceLabel: 'trip.txt' })
    expect(status).toBe(201)
    expect(body.batch).toMatchObject({ status: 'review', stage: 'review_ready', sequence: 1, sourceType: 'text', expired: false,
      createdAt: NOW.toISOString(), expiresAt: daysAfter(30).toISOString(), errorCode: null })
    expect(body.drafts).toHaveLength(2)
    expect(body.drafts[0]).toMatchObject({ ordinal: 0, status: 'review', version: 1, selected: true, edited: false, yearExplicit: true,
      fields: { date: '2026-03-10', origin: 'JFK', destination: 'LHR', airline_iata: 'BA', flight_number: '178', aircraft_icao: 'B738' },
      duplicateFlightId: null, issue: null })
    expect(provider.generateContent).toHaveBeenCalledTimes(1)
    expect(await batchRow(body.batch.id)).toMatchObject({ user_id: USER.id, generation: 1, processing_deadline: null, status: 'review' })
  })

  it('is idempotent on the submission operation id: a replay returns the stored batch and never calls the provider again', async () => {
    answer([providerFlight()])
    const submissionOperationId = opId()
    const first = await postJob(db, { submissionOperationId })
    const replay = await postJob(db, { submissionOperationId, content: 'different text, same operation' })
    expect(first.status).toBe(201)
    expect(replay.status).toBe(200)
    expect(replay.body.batch.id).toBe(first.body.batch.id)
    expect(replay.body.drafts).toHaveLength(1)
    expect(provider.generateContent).toHaveBeenCalledTimes(1)
    expect(await count(db, 'import_batches')).toBe(1)
    // Another owner's identical operation id is a different submission.
    const other = await postJob(db, { submissionOperationId }, OTHER)
    expect(other.status).toBe(201)
    expect(other.body.batch.id).not.toBe(first.body.batch.id)
  })

  it('authenticates, checks CSRF and rate-limits like parse, before any provider call', async () => {
    expect((await postJob(db, {}, null)).status).toBe(401)
    expect((await postJob(db, {}, USER, { 'X-CSRF-Token': 'forged' })).status).toBe(403)
    expect((await postJob(db, { type: 'video' })).status).toBe(400)
    expect((await postJob(db, { content: '' })).status).toBe(400)
    expect((await postJob(db, { submissionOperationId: 'short' })).status).toBe(400)
    expect(provider.generateContent).not.toHaveBeenCalled()
    expect(await count(db, 'import_batches')).toBe(0)

    answer([])
    // Fill the shared parse bucket directly instead of making 20 calls.
    await db.prepare("INSERT OR REPLACE INTO auth_rate_limits (key, count, expires_at) VALUES (?, 20, ?)").bind(`import-parse:${USER.id}`, Math.floor(Date.now() / 1000) + 3600).run()
    const limited = await postJob(db, {})
    expect(limited.status).toBe(429)
    expect(limited.body.code).toBe('RATE_LIMITED')
    expect(provider.generateContent).not.toHaveBeenCalled()
  })

  it('keeps an invalid reference and an unknown year as correctable drafts that never reach flights', async () => {
    const snapshot = await seed([
      providerFlight({ origin: 'XXX' }),
      providerFlight({ date: '2026-03-12', field_confidence: { date_year_explicit: false } }),
      providerFlight({ airline_iata: '' }),
    ])
    const [badAirport, noYear, placeholder] = snapshot.drafts
    expect(badAirport.issue).toMatchObject({ code: 'UNKNOWN_AIRPORT' })
    expect(noYear).toMatchObject({ yearExplicit: false, yearConfirmed: false, selected: false, fields: { date: '' } })
    expect(noYear.issue).toMatchObject({ code: 'INVALID_FLIGHT' })
    expect(placeholder).toMatchObject({ selected: false, fields: { airline_iata: 'ZZ', airline_was_placeholder: true } })
    expect(await count(db, 'flights')).toBe(0)
    expect(await count(db, 'user_stats')).toBe(0)
    expect(await count(db, 'visits')).toBe(0)
  })

  it('caps a batch at 100 drafts and marks the truncation', async () => {
    const snapshot = await seed(Array.from({ length: 101 }, (_, index) => providerFlight({ flight_number: String(index) })))
    expect(snapshot.batch).toMatchObject({ status: 'partial', errorCode: 'ROWS_TRUNCATED' })
    expect(snapshot.drafts).toHaveLength(100)
    expect(await count(db, 'import_drafts')).toBe(100)
  })

  it('marks rows the normalization rejected as partial and an empty extraction as failed', async () => {
    const partial = await seed([providerFlight(), { origin: 'X', destination: 'LHR', airline_iata: 'BA' }])
    expect(partial.batch).toMatchObject({ status: 'partial', errorCode: 'ROWS_REJECTED' })
    expect(partial.drafts).toHaveLength(1)

    answer([])
    const empty = await postJob(db, {})
    expect(empty.status).toBe(201)
    expect(empty.body.batch).toMatchObject({ status: 'failed', errorCode: 'NO_FLIGHTS_FOUND', stage: null })
    expect(empty.body.drafts).toEqual([])
  })

  it.each([
    [new ApiError({ status: 429, message: 'quota exceeded' }), 'PROVIDER_QUOTA'],
    [new Error('request timed out'), 'PROVIDER_TIMEOUT'],
    [new ApiError({ status: 404, message: 'model missing' }), 'MODEL_UNAVAILABLE'],
  ])('records a provider failure as a failed batch with a structured code', async (failure, code) => {
    provider.generateContent.mockRejectedValue(failure)
    const { status, body } = await postJob(db, {})
    expect(status).toBe(201)
    expect(body.batch).toMatchObject({ status: 'failed', errorCode: code })
    expect(body.drafts).toEqual([])
    expect((await batchRow(body.batch.id))!.processing_deadline).toBeNull()
  })

  it('refuses an eleventh unexpired batch but lets expired ones go, and a replay still answers at the cap', async () => {
    clock()
    answer([providerFlight()])
    const first = await postJob(db, {})
    for (let i = 1; i < 10; i++) expect((await postJob(db, {})).status).toBe(201)
    const eleventh = await postJob(db, {})
    expect(eleventh.status).toBe(409)
    expect(eleventh.body.code).toBe('IMPORT_BATCH_LIMIT')
    expect(await count(db, 'import_batches')).toBe(10)
    await db.prepare("UPDATE import_batches SET expires_at = ? WHERE id = ?").bind(new Date(NOW.getTime() - 1).toISOString(), first.body.batch.id).run()
    expect((await postJob(db, {})).status).toBe(201)
    // Another owner has their own cap.
    expect((await postJob(db, {}, OTHER)).status).toBe(201)
  })

  it('allows one processing batch per owner and ignores one whose deadline passed', async () => {
    clock()
    const insert = (id: string, deadline: string) => db.prepare(
      `INSERT INTO import_batches (id,user_id,source_type,status,stage,submission_operation_id,processing_deadline,created_at,updated_at,expires_at)
       VALUES (?,?,'text','processing','accepted',?,?,?,?,?)`,
    ).bind(id, USER.id, `op-${id}`, deadline, NOW.toISOString(), NOW.toISOString(), daysAfter(30).toISOString()).run()
    await insert('live', new Date(NOW.getTime() + 60_000).toISOString())
    answer([providerFlight()])
    const blocked = await postJob(db, {})
    expect(blocked.status).toBe(409)
    expect(blocked.body.code).toBe('IMPORT_IN_PROGRESS')
    expect(provider.generateContent).not.toHaveBeenCalled()
    expect((await postJob(db, {}, OTHER)).status).toBe(201)
    await db.prepare("UPDATE import_batches SET processing_deadline = ? WHERE id = 'live'").bind(new Date(NOW.getTime() - 1).toISOString()).run()
    expect((await postJob(db, {})).status).toBe(201)
  })

  it('never stores source content, provider text or raw_text, and sanitizes the label', async () => {
    const canary = 'CANARY-pasted-itinerary-text'
    answer([providerFlight({ secret: 'CANARY-provider-field' })], { raw_text: 'CANARY-raw-text' })
    const { body } = await postJob(db, { type: 'text', content: `Flight ${canary}`, sourceLabel: canary })
    const pdf = btoa('%PDF-1.4 CANARY-file-bytes')
    const uploaded = await postJob(db, { type: 'pdf', content: pdf, sourceLabel: '..\\..\\tmp/My\u0007 ticket.pdf' })
    expect(uploaded.status).toBe(201)
    expect(body.batch.sourceLabel).toBeNull()
    const labels = await db.prepare('SELECT source_label FROM import_batches ORDER BY created_at, id').all<{ source_label: string | null }>()
    expect(labels.results.map(row => row.source_label)).toContain('My ticket.pdf')
    const dump = JSON.stringify(await Promise.all(['import_batches', 'import_drafts', 'import_conversion_receipts', 'flights', 'flight_idempotency', 'auth_rate_limits']
      .map(table => db.prepare(`SELECT * FROM ${table}`).all().then(r => r.results))))
    for (const secret of [canary, 'CANARY-provider-field', 'CANARY-raw-text', 'CANARY', pdf]) expect(dump).not.toContain(secret)
    expect(dump).not.toContain('raw_text')
  })
})

describe('POST /api/import/parse stays', () => {
  it('still answers old clients without persisting anything', async () => {
    const { onRequestPost: parse } = await import('../api/import/parse')
    answer([providerFlight()])
    const { csrfRequest, testOrigin } = await import('./harness')
    const response = await parse({ request: csrfRequest('/api/import/parse', 'POST', { type: 'text', content: 'x' }), env: { GEMINI_API_KEY: 'k', PAGES_ORIGIN: testOrigin, DB: db },
      data: { user: USER }, params: {}, waitUntil() {} } as never)
    expect(response.status).toBe(200)
    expect((await response.json() as { flights: unknown[] }).flights).toHaveLength(1)
    expect(await count(db, 'import_batches')).toBe(0)
  })
})

describe('GET /api/import/batches/:id', () => {
  it('returns the persisted snapshot to its owner only', async () => {
    const created = await seed([providerFlight()])
    const read = await getBatch(db, created.batch.id)
    expect(read.status).toBe(200)
    expect(read.body).toEqual(created)
    expect((await getBatch(db, created.batch.id, OTHER)).status).toBe(404)
    expect((await getBatch(db, created.batch.id, null)).status).toBe(401)
    expect((await getBatch(db, 'no-such-batch')).status).toBe(404)
  })

  it('returns review edits after a reload', async () => {
    const created = await seed([providerFlight()])
    const edited = await patchDraft(db, created.drafts[0].id, { version: 1, fields: { destination: 'dxb' }, selected: false })
    expect(edited.status).toBe(200)
    const reloaded = await getBatch(db, created.batch.id)
    expect(reloaded.body.drafts[0]).toMatchObject({ version: 2, edited: true, selected: false, fields: { destination: 'DXB' } })
    expect(reloaded.body.batch.sequence).toBe(created.batch.sequence + 1)
  })

  it('matches duplicates against the full owned history, not a capped page, and excludes the converted flight', async () => {
    const created = await seed([providerFlight({ date: '2021-03-10' }), providerFlight({ date: '2021-03-10', origin: 'TBS', destination: 'IST' })])
    await db.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 1200)
      INSERT INTO flights (user_id,date,origin,destination,is_upcoming,lifecycle_state,confirmation_source,confirmed_at)
      SELECT ?, date('2018-01-01', '+' || x || ' days'), 'TBS', 'IST', 0, 'logged', 'legacy', NULL FROM n`).bind(USER.id).run()
    const early = await db.prepare("INSERT INTO flights (user_id,date,origin,destination,is_upcoming,lifecycle_state,confirmation_source) VALUES (?,'2021-03-10','JFK','LHR',0,'logged','legacy')").bind(USER.id).run()
    await db.prepare("INSERT INTO flights (user_id,date,origin,destination,is_upcoming,lifecycle_state,confirmation_source) VALUES (?,'2021-03-10','JFK','LHR',0,'logged','legacy')").bind(OTHER.id).run()
    const read = await getBatch(db, created.batch.id)
    expect(read.body.drafts[0].duplicateFlightId).toBe(early.meta.last_row_id)
    expect(read.body.drafts[1].duplicateFlightId).not.toBeNull() // deep inside the 1200 seeded days, far past any 200-row page
    // A draft that already became that flight is not its own duplicate.
    await db.prepare("UPDATE import_drafts SET status = 'converted', converted_flight_id = ? WHERE id = ?").bind(early.meta.last_row_id, created.drafts[0].id).run()
    expect((await getBatch(db, created.batch.id)).body.drafts[0].duplicateFlightId).toBeNull()
    // The other owner's identical flight never matches.
    await db.prepare('DELETE FROM flights WHERE id = ?').bind(early.meta.last_row_id).run()
    expect((await getBatch(db, created.batch.id)).body.drafts[0].duplicateFlightId).toBeNull()
  })

  it('shows an expired batch as expired without its drafts', async () => {
    clock()
    const created = await seed([providerFlight()])
    clock(daysAfter(30))
    const read = await getBatch(db, created.batch.id)
    expect(read.status).toBe(200)
    expect(read.body.batch).toMatchObject({ expired: true, status: 'review' })
    expect(read.body.drafts).toEqual([])
  })
})

describe('PATCH /api/import/drafts/:id', () => {
  it('persists corrections, selection, the year decision and the duplicate acknowledgement, and sets edited', async () => {
    const created = await seed([providerFlight({ date: '2026-03-12', field_confidence: { date_year_explicit: false } })])
    const [draft] = created.drafts
    const none = await patchDraft(db, draft.id, { version: 1, selected: true })
    expect(none.body.draft).toMatchObject({ version: 2, selected: true, edited: false })
    const response = await patchDraft(db, draft.id, { version: 2, fields: { date: '2026-03-12', flight_number: '', aircraft_icao: null, origin: 'ist' }, yearConfirmed: true, duplicateAcknowledged: true })
    expect(response.status).toBe(200)
    expect(response.body.draft).toMatchObject({ version: 3, edited: true, yearConfirmed: true, duplicateAcknowledged: true, selected: true,
      fields: { date: '2026-03-12', origin: 'IST', destination: 'LHR' } })
    expect(response.body.draft.fields).not.toHaveProperty('flight_number')
    expect(response.body.draft.fields).not.toHaveProperty('aircraft_icao')
    expect(response.body.draft.issue).toBeNull()
    expect(await draftRows(created.batch.id)).toMatchObject([{ version: 3, edited: 1, year_confirmed: 1, duplicate_acknowledged: 1, selected: 1 }])
    expect((await batchRow(created.batch.id))!.sequence).toBe(created.batch.sequence + 2)
  })

  it('refuses a stale version with the current draft and changes nothing', async () => {
    const created = await seed([providerFlight()])
    const id = created.drafts[0].id
    expect((await patchDraft(db, id, { version: 1, fields: { destination: 'DXB' } })).status).toBe(200)
    const stale = await patchDraft(db, id, { version: 1, fields: { destination: 'TBS' } })
    expect(stale.status).toBe(409)
    expect(stale.body).toMatchObject({ code: 'DRAFT_VERSION_CONFLICT', draft: { version: 2, fields: { destination: 'DXB' } } })
    expect((await draftRows(created.batch.id))[0]).toMatchObject({ version: 2 })
  })

  it('serializes two tabs editing the same version: exactly one wins', async () => {
    const created = await seed([providerFlight()])
    const id = created.drafts[0].id
    const results = await Promise.all([
      patchDraft(db, id, { version: 1, fields: { destination: 'DXB' } }),
      patchDraft(db, id, { version: 1, fields: { destination: 'TBS' } }),
    ])
    expect(results.map(r => r.status).sort()).toEqual([200, 409])
    expect((await draftRows(created.batch.id))[0].version).toBe(2)
  })

  it('is owner-scoped, CSRF-protected, shape-validated and keeps unknown references correctable', async () => {
    const created = await seed([providerFlight()])
    const id = created.drafts[0].id
    expect((await patchDraft(db, id, { version: 1, selected: false }, OTHER)).status).toBe(404)
    expect((await patchDraft(db, id, { version: 1 }, null)).status).toBe(401)
    expect((await patchDraft(db, id, { version: 1 }, USER, { 'X-CSRF-Token': 'forged' })).status).toBe(403)
    expect((await patchDraft(db, 'no-such-draft', { version: 1 })).status).toBe(404)
    for (const body of [{}, { version: 0 }, { version: 1, fields: { origin: 'toolong' } }, { version: 1, fields: { date: '2026-02-30' } },
      { version: 1, fields: { surprise: 'x' } }, { version: 1, selected: 'yes' }, { version: 1, fields: [] }, { version: 1, status: 'converted' }]) {
      expect((await patchDraft(db, id, body)).status, JSON.stringify(body)).toBe(400)
    }
    // A well-formed code that no reference table knows is saved and reported as an issue, not refused.
    const unknown = await patchDraft(db, id, { version: 1, fields: { destination: 'QQQ' } })
    expect(unknown.status).toBe(200)
    expect(unknown.body.draft.issue).toMatchObject({ code: 'UNKNOWN_AIRPORT' })
    expect((await draftRows(created.batch.id))[0].version).toBe(2)
  })

  it('dismisses and restores a row, but never edits a converted or expired one', async () => {
    clock()
    const created = await seed([providerFlight(), providerFlight({ date: '2026-03-11' })])
    const [first, second] = created.drafts
    const dismissed = await patchDraft(db, first.id, { version: 1, dismissed: true })
    expect(dismissed.body.draft).toMatchObject({ status: 'dismissed', version: 2 })
    expect((await patchDraft(db, first.id, { version: 2, dismissed: false })).body.draft).toMatchObject({ status: 'review', version: 3 })
    await db.prepare("UPDATE import_drafts SET status = 'converted', converted_flight_id = 1 WHERE id = ?").bind(second.id).run()
    const converted = await patchDraft(db, second.id, { version: 1, selected: false })
    expect(converted.status).toBe(409)
    expect(converted.body.code).toBe('DRAFT_VERSION_CONFLICT')
    clock(daysAfter(31))
    const expired = await patchDraft(db, first.id, { version: 3, selected: false })
    expect(expired.status).toBe(410)
    expect(expired.body.code).toBe('IMPORT_BATCH_EXPIRED')
  })
})

describe('DELETE /api/import/batches/:id', () => {
  it('deletes the drafts explicitly, then the batch, in one D1 batch, and keeps conversion tombstones', async () => {
    const created = await seed([providerFlight(), providerFlight({ date: '2026-03-11' })])
    await db.prepare(`INSERT INTO import_conversion_receipts (user_id,operation_key,draft_id,batch_id,request_digest,flight_id,created_at)
      VALUES (?,?,?,?,'d',1,?)`).bind(USER.id, 'tombstone-key-1', created.drafts[0].id, created.batch.id, NOW.toISOString()).run()
    const other = await seed([providerFlight()], OTHER)
    const { db: spied, hooks } = instrumentDb(db)
    const { onRequestDelete } = await import('../api/import/batches/[id]')
    const { csrfRequest, testOrigin } = await import('./harness')
    const response = await onRequestDelete({ request: csrfRequest(`/api/import/batches/${created.batch.id}`, 'DELETE'), env: { DB: spied, PAGES_ORIGIN: testOrigin },
      data: { user: USER }, params: { id: created.batch.id }, waitUntil() {} } as never)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deleted: true })
    const drafts = hooks.sql.findIndex(sql => /DELETE FROM import_drafts/.test(sql))
    const batches = hooks.sql.findIndex(sql => /DELETE FROM import_batches/.test(sql))
    expect(drafts).toBeGreaterThanOrEqual(0)
    expect(batches).toBeGreaterThan(drafts)
    expect(await batchRow(created.batch.id)).toBeNull()
    expect(await draftRows(created.batch.id)).toEqual([])
    expect(await count(db, 'import_conversion_receipts')).toBe(1)
    expect(await draftRows(other.batch.id)).toHaveLength(1)
    expect((await getBatch(db, created.batch.id)).status).toBe(404)
  })

  it('is owner-scoped and CSRF-protected', async () => {
    const created = await seed([providerFlight()])
    expect((await deleteBatch(db, created.batch.id, OTHER)).status).toBe(404)
    expect((await deleteBatch(db, created.batch.id, null)).status).toBe(401)
    expect(await batchRow(created.batch.id)).not.toBeNull()
    expect(await draftRows(created.batch.id)).toHaveLength(1)
    expect((await deleteBatch(db, 'no-such-batch')).status).toBe(404)
  })
})

describe('deletion fence (A10, T10 half)', () => {
  const processing = async (id = 'fenced-batch', generation = 1) => {
    await db.prepare(
      `INSERT INTO import_batches (id,user_id,source_type,status,stage,generation,submission_operation_id,processing_deadline,created_at,updated_at,expires_at)
       VALUES (?,?,'text','processing','accepted',?,?,?,?,?,?)`,
    ).bind(id, USER.id, generation, `op-${id}`, daysAfter(1).toISOString(), NOW.toISOString(), NOW.toISOString(), daysAfter(30).toISOString()).run()
    return { userId: USER.id, batchId: id, generation }
  }
  const rows = [{ fields: { date: '2026-03-10', origin: 'JFK', destination: 'LHR', airline_iata: 'BA' }, confidence: 0.9, fieldConfidence: null, yearExplicit: true, selected: true }]

  it('writes the drafts and finalizes the batch while the generation matches', async () => {
    const fence = await processing()
    await persistDraftRows(db, fence, rows, { status: 'review', errorCode: null }, NOW)
    expect(await draftRows('fenced-batch')).toHaveLength(1)
    expect(await batchRow('fenced-batch')).toMatchObject({ status: 'review', stage: 'review_ready', sequence: 1, processing_deadline: null })
  })

  it('matches nothing after the generation moved on (cancel)', async () => {
    const fence = await processing()
    await db.prepare("UPDATE import_batches SET generation = generation + 1, status = 'cancelled' WHERE id = 'fenced-batch'").run()
    await persistDraftRows(db, fence, rows, { status: 'review', errorCode: null }, NOW)
    expect(await draftRows('fenced-batch')).toEqual([])
    expect(await batchRow('fenced-batch')).toMatchObject({ status: 'cancelled', generation: 2, sequence: 0 })
  })

  it('matches nothing after the maintenance sweep bumped the generation of a dead job', async () => {
    const fence = await processing()
    const maintenance = (await import('../../workers/maintenance/index')).default
    clock(daysAfter(2))
    await maintenance.scheduled({} as ScheduledEvent, { DB: db, MAINTENANCE_MODE: 'false' })
    expect(await batchRow('fenced-batch')).toMatchObject({ status: 'failed', error_code: 'JOB_INTERRUPTED', generation: 2 })
    await persistDraftRows(db, fence, rows, { status: 'review', errorCode: null }, NOW)
    expect(await draftRows('fenced-batch')).toEqual([])
    expect(await batchRow('fenced-batch')).toMatchObject({ status: 'failed' })
  })

  it('matches nothing after discard', async () => {
    const fence = await processing()
    await deleteBatch(db, 'fenced-batch')
    await persistDraftRows(db, fence, rows, { status: 'review', errorCode: null }, NOW)
    expect(await count(db, 'import_drafts')).toBe(0)
    expect(await count(db, 'import_batches')).toBe(0)
  })

  it('matches nothing after account deletion, and deletion removes every draft, batch and receipt of the account', async () => {
    const created = await seed([providerFlight(), providerFlight({ date: '2026-03-11' })])
    const kept = await seed([providerFlight()], OTHER)
    const fence = await processing()
    await db.prepare(`INSERT INTO import_conversion_receipts (user_id,operation_key,draft_id,batch_id,request_digest,flight_id,created_at)
      VALUES (?,?,?,?,'d',1,?)`).bind(USER.id, 'account-key-1', created.drafts[0].id, created.batch.id, NOW.toISOString()).run()
    await deleteUserCascade(db, USER.id)
    for (const table of ['import_drafts', 'import_batches', 'import_conversion_receipts']) {
      expect((await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).bind(USER.id).first<{ n: number }>())?.n, table).toBe(0)
    }
    // The owner's late job write cannot recreate anything: the batch is gone, so the fence matches no row.
    await persistDraftRows(db, fence, rows, { status: 'review', errorCode: null }, NOW)
    expect(await count(db, 'import_drafts')).toBe(1)
    expect(await draftRows(kept.batch.id)).toHaveLength(1)
  })
})
