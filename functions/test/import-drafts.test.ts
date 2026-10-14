// ADR 0001 §6 (T10): the synchronous batch writer, snapshot reads, draft edits, discard, the deletion fence (A10)
// and the storage rules. Conversion is covered in import-conversion.test.ts.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@google/genai'
import { deleteUserCascade } from '../api/_lib/users'
import { persistDraftRows } from '../api/_services/importDrafts'
import { count } from './harness'
import { instrumentDb } from './db-hooks'
import {
  NOW,
  OTHER,
  USER,
  clock,
  daysAfter,
  deleteBatch,
  getBatch,
  importAccount,
  opId,
  patchDraft,
  postJob,
  providerFlight,
  providerText,
  seedBatch,
} from './import-fixture'

const provider = vi.hoisted(() => ({ generateContent: vi.fn() }))
vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/genai')>()
  return {
    ...actual,
    GoogleGenAI: class {
      models = { generateContent: provider.generateContent }
    },
  }
})

let account: Awaited<ReturnType<typeof importAccount>>
let db: D1Database
beforeAll(async () => {
  account = await importAccount()
  db = account.db
})
afterAll(async () => {
  await account.dispose()
})
afterEach(async () => {
  vi.useRealTimers()
  provider.generateContent.mockReset()
  await db.batch(
    [
      'import_conversion_receipts',
      'import_drafts',
      'import_batches',
      'auth_rate_limits',
      'flight_idempotency',
      'flights',
    ].map((table) => db.prepare(`DELETE FROM ${table}`)),
  )
})

const answer = (flights: unknown[], extra: Record<string, unknown> = {}) =>
  provider.generateContent.mockResolvedValue({ text: providerText(flights, extra) })
const seed = (flights: unknown[], user = USER) =>
  seedBatch(db, (list) => answer(list), flights, user)
const batchRow = (id: string) =>
  db.prepare('SELECT * FROM import_batches WHERE id = ?').bind(id).first<Record<string, any>>()
const draftRows = (batchId: string) =>
  db
    .prepare('SELECT * FROM import_drafts WHERE batch_id = ? ORDER BY ordinal')
    .bind(batchId)
    .all<Record<string, any>>()
    .then((r) => r.results)

/** A Quick Add admission body. `content: undefined` drops the text default `postJob` adds. */
const postPass = (
  over: Record<string, unknown> = {},
  user: Parameters<typeof postJob>[2] = USER,
  headers: Record<string, string> = {},
  env: Record<string, unknown> = {},
) =>
  postJob(
    db,
    {
      type: 'boarding_pass',
      source: 'image',
      content: undefined,
      legs: [{ origin: 'JFK', destination: 'LHR' }],
      ...over,
    },
    user,
    headers,
    env,
  )

describe('POST /api/import/jobs', () => {
  it('refuses file recognition without a provider credential before creating a batch', async () => {
    const { status, body } = await postJob(
      db,
      { type: 'pdf', content: 'JVBERi0x' },
      USER,
      {},
      { GEMINI_API_KEY: undefined },
    )
    expect(status).toBe(503)
    expect(body).toMatchObject({ code: 'IMPORT_SERVICE_UNAVAILABLE' })
    expect(await count(db, 'import_batches')).toBe(0)
    expect(provider.generateContent).not.toHaveBeenCalled()
  })

  it('persists the batch and its drafts from one provider call and returns the snapshot', async () => {
    clock()
    answer([
      providerFlight(),
      providerFlight({
        date: '2026-03-11',
        origin: 'LHR',
        destination: 'JFK',
        flight_number: '179',
      }),
    ])
    const { status, body } = await postJob(db, {
      type: 'text',
      content: 'Flight details',
      sourceLabel: 'trip.txt',
    })
    expect(status).toBe(201)
    expect(body.batch).toMatchObject({
      status: 'review',
      stage: 'review_ready',
      sequence: 1,
      sourceType: 'text',
      expired: false,
      createdAt: NOW.toISOString(),
      expiresAt: daysAfter(30).toISOString(),
      errorCode: null,
    })
    expect(body.drafts).toHaveLength(2)
    expect(body.drafts[0]).toMatchObject({
      ordinal: 0,
      status: 'review',
      version: 1,
      selected: true,
      edited: false,
      yearExplicit: true,
      fields: {
        date: '2026-03-10',
        origin: 'JFK',
        destination: 'LHR',
        airline_iata: 'BA',
        flight_number: '178',
        aircraft_icao: 'B738',
      },
      duplicateFlightId: null,
      issue: null,
    })
    expect(provider.generateContent).toHaveBeenCalledTimes(1)
    expect(await batchRow(body.batch.id)).toMatchObject({
      user_id: USER.id,
      generation: 1,
      processing_deadline: null,
      status: 'review',
    })
  })

  it('fails closed without a checker binding, ignores model verification and permits a member selection', async () => {
    answer([providerFlight({ verification: 'verified' })])
    const { body } = await postJob(db, {}, USER, {}, { AI: undefined })
    expect(body.batch.status).toBe('review')
    const draft = body.drafts[0]
    expect(draft).toMatchObject({ selected: false, fields: { verification: 'failed' } })
    const selected = await patchDraft(db, draft.id, { version: draft.version, selected: true })
    expect(selected.body.draft).toMatchObject({
      selected: true,
      fields: { verification: 'failed' },
    })
  })

  it('invalidates verification after a field edit, retaining it for a selection-only patch', async () => {
    const created = await seed([providerFlight()])
    const draft = created.drafts[0]
    const selection = await patchDraft(db, draft.id, { version: 1, selected: false })
    expect(selection.body.draft.fields.verification).toBe('verified')
    const edited = await patchDraft(db, draft.id, { version: 2, fields: { flight_number: '999' } })
    expect(edited.body.draft.fields.verification).toBe('not_verified')
  })

  it('is idempotent on the submission operation id: a replay returns the stored batch and never calls the provider again', async () => {
    answer([providerFlight()])
    const submissionOperationId = opId()
    const first = await postJob(db, { submissionOperationId })
    const replay = await postJob(db, {
      submissionOperationId,
      content: 'different text, same operation',
    })
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
    expect((await postPass({}, null)).status).toBe(401)
    expect((await postPass({}, USER, { 'X-CSRF-Token': 'forged' })).status).toBe(403)
    expect(provider.generateContent).not.toHaveBeenCalled()
    expect(await count(db, 'import_batches')).toBe(0)

    answer([])
    // Fill the shared parse bucket directly instead of making 20 calls.
    await db
      .prepare('INSERT OR REPLACE INTO auth_rate_limits (key, count, expires_at) VALUES (?, 20, ?)')
      .bind(`import-parse:${USER.id}`, Math.floor(Date.now() / 1000) + 3600)
      .run()
    const limited = await postJob(db, {})
    expect(limited.status).toBe(429)
    expect(limited.body.code).toBe('RATE_LIMITED')
    expect((await postPass()).status).toBe(429)
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
    expect(noYear).toMatchObject({
      yearExplicit: false,
      yearConfirmed: false,
      selected: false,
      fields: { date: '' },
    })
    expect(noYear.issue).toMatchObject({ code: 'INVALID_FLIGHT' })
    expect(placeholder).toMatchObject({
      selected: false,
      fields: { airline_iata: 'ZZ', airline_was_placeholder: true },
    })
    expect(await count(db, 'flights')).toBe(0)
    expect(await count(db, 'user_stats')).toBe(0)
    expect(await count(db, 'visits')).toBe(0)
  })

  it('caps a batch at 100 drafts and marks the truncation', async () => {
    const snapshot = await seed(
      Array.from({ length: 101 }, (_, index) => providerFlight({ flight_number: String(index) })),
    )
    expect(snapshot.batch).toMatchObject({ status: 'partial', errorCode: 'ROWS_TRUNCATED' })
    expect(snapshot.drafts).toHaveLength(100)
    expect(await count(db, 'import_drafts')).toBe(100)
  })

  describe('source-dependent draft caps', () => {
    const list = (count: number) =>
      [
        'KUUKI FLIGHTS v2',
        ...Array.from(
          { length: count },
          (_, index) =>
            `${new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10)} | JFK → LHR | British Airways BA ${index + 1}`,
        ),
      ].join('\n')

    it('keeps 450 locally parsed rows without a model call', async () => {
      const { status, body } = await postJob(db, { content: list(450) })
      expect(status).toBe(201)
      expect(body.batch).toMatchObject({ status: 'review', errorCode: null })
      expect(body.drafts).toHaveLength(450)
      expect(provider.generateContent).not.toHaveBeenCalled()
    })

    it('truncates 600 locally parsed rows at 500', async () => {
      const { body } = await postJob(db, { content: list(600) })
      expect(body.batch).toMatchObject({ status: 'partial', errorCode: 'ROWS_TRUNCATED' })
      expect(body.drafts).toHaveLength(500)
      expect(await count(db, 'import_drafts')).toBe(500)
    })

    it('truncates 150 model-extracted rows at 100', async () => {
      const snapshot = await seed(
        Array.from({ length: 150 }, (_, index) => providerFlight({ flight_number: String(index) })),
      )
      expect(snapshot.batch).toMatchObject({ status: 'partial', errorCode: 'ROWS_TRUNCATED' })
      expect(snapshot.drafts).toHaveLength(100)
    })
  })

  it('marks rows the normalization rejected as partial and an empty extraction as failed', async () => {
    const partial = await seed([
      providerFlight(),
      { origin: 'X', destination: 'LHR', airline_iata: 'BA' },
    ])
    expect(partial.batch).toMatchObject({ status: 'partial', errorCode: 'ROWS_REJECTED' })
    expect(partial.drafts).toHaveLength(1)

    answer([])
    const empty = await postJob(db, {})
    expect(empty.status).toBe(201)
    expect(empty.body.batch).toMatchObject({
      status: 'failed',
      errorCode: 'NO_FLIGHTS_FOUND',
      stage: null,
    })
    expect(empty.body.drafts).toEqual([])
  })

  it.each([
    [new ApiError({ status: 429, message: 'quota exceeded' }), 'PROVIDER_QUOTA'],
    [new Error('request timed out'), 'PROVIDER_TIMEOUT'],
    [new ApiError({ status: 404, message: 'model missing' }), 'MODEL_UNAVAILABLE'],
  ])(
    'records a provider failure as a failed batch with a structured code',
    async (failure, code) => {
      provider.generateContent.mockRejectedValue(failure)
      const { status, body } = await postJob(db, {})
      expect(status).toBe(201)
      expect(body.batch).toMatchObject({ status: 'failed', errorCode: code })
      expect(body.drafts).toEqual([])
      expect((await batchRow(body.batch.id))!.processing_deadline).toBeNull()
    },
  )

  it('refuses an eleventh open batch, lets finished or expired ones go, and a replay still answers at the cap', async () => {
    clock()
    answer([providerFlight()])
    const replayId = opId()
    const first = await postJob(db, { submissionOperationId: replayId })
    for (let i = 1; i < 10; i++) expect((await postJob(db, {})).status).toBe(201)
    const eleventh = await postJob(db, {})
    expect(eleventh.status).toBe(409)
    expect(eleventh.body.code).toBe('IMPORT_BATCH_LIMIT')
    expect((await postPass()).body.code).toBe('IMPORT_BATCH_LIMIT')
    expect(await count(db, 'import_batches')).toBe(10)
    const replay = await postJob(db, { submissionOperationId: replayId })
    expect(replay.status).toBe(200)
    expect(replay.body.batch.id).toBe(first.body.batch.id)
    expect(provider.generateContent).toHaveBeenCalledTimes(10)
    // A completed batch, then an expired one, frees a slot.
    await db
      .prepare("UPDATE import_batches SET status = 'completed' WHERE id = ?")
      .bind(first.body.batch.id)
      .run()
    expect((await postJob(db, {})).status).toBe(201)
    expect((await postJob(db, {})).status).toBe(409)
    const open = await db
      .prepare("SELECT id FROM import_batches WHERE user_id = ? AND status = 'review' LIMIT 1")
      .bind(USER.id)
      .first<{ id: string }>()
    await db
      .prepare('UPDATE import_batches SET expires_at = ? WHERE id = ?')
      .bind(new Date(NOW.getTime() - 1).toISOString(), open!.id)
      .run()
    expect((await postJob(db, {})).status).toBe(201)
    // Another owner has their own cap.
    expect((await postJob(db, {}, OTHER)).status).toBe(201)
  })

  it('does not count failed or cancelled batches toward the cap', async () => {
    clock()
    provider.generateContent.mockRejectedValue(new Error('request timed out'))
    for (let i = 0; i < 11; i++) expect((await postJob(db, {})).body.batch.status).toBe('failed')
    await db
      .prepare(
        "UPDATE import_batches SET status = 'cancelled' WHERE id IN (SELECT id FROM import_batches LIMIT 3)",
      )
      .run()
    answer([providerFlight()])
    expect((await postJob(db, {})).status).toBe(201)
    expect(await count(db, 'import_batches')).toBe(12)
  })

  it('allows one processing batch per owner and ignores one whose deadline passed', async () => {
    clock()
    const insert = (id: string, deadline: string) =>
      db
        .prepare(
          `INSERT INTO import_batches (id,user_id,source_type,status,stage,submission_operation_id,processing_deadline,created_at,updated_at,expires_at)
       VALUES (?,?,'text','processing','accepted',?,?,?,?,?)`,
        )
        .bind(
          id,
          USER.id,
          `op-${id}`,
          deadline,
          NOW.toISOString(),
          NOW.toISOString(),
          daysAfter(30).toISOString(),
        )
        .run()
    await insert('live', new Date(NOW.getTime() + 60_000).toISOString())
    answer([providerFlight()])
    const blocked = await postJob(db, {})
    expect(blocked.status).toBe(409)
    expect(blocked.body.code).toBe('IMPORT_IN_PROGRESS')
    expect(provider.generateContent).not.toHaveBeenCalled()
    expect((await postJob(db, {}, OTHER)).status).toBe(201)
    await db
      .prepare("UPDATE import_batches SET processing_deadline = ? WHERE id = 'live'")
      .bind(new Date(NOW.getTime() - 1).toISOString())
      .run()
    expect((await postJob(db, {})).status).toBe(201)
  })

  it('never stores source content, provider text or raw_text, and sanitizes the label', async () => {
    const canary = 'CANARY-pasted-itinerary-text'
    answer([providerFlight({ secret: 'CANARY-provider-field' })], { raw_text: 'CANARY-raw-text' })
    const { body } = await postJob(db, {
      type: 'text',
      content: `Flight ${canary}`,
      sourceLabel: canary,
    })
    const pdf = btoa('%PDF-1.4 CANARY-file-bytes')
    const uploaded = await postJob(db, {
      type: 'pdf',
      content: pdf,
      sourceLabel: '..\\..\\tmp/My\u0007 ticket.pdf',
    })
    expect(uploaded.status).toBe(201)
    expect(body.batch.sourceLabel).toBeNull()
    const labels = await db
      .prepare('SELECT source_label FROM import_batches ORDER BY created_at, id')
      .all<{ source_label: string | null }>()
    expect(labels.results.map((row) => row.source_label)).toContain('My ticket.pdf')
    const dump = JSON.stringify(
      await Promise.all(
        [
          'import_batches',
          'import_drafts',
          'import_conversion_receipts',
          'flights',
          'flight_idempotency',
          'auth_rate_limits',
        ].map((table) =>
          db
            .prepare(`SELECT * FROM ${table}`)
            .all()
            .then((r) => r.results),
        ),
      ),
    )
    for (const secret of [canary, 'CANARY-provider-field', 'CANARY-raw-text', 'CANARY', pdf])
      expect(dump).not.toContain(secret)
    expect(dump).not.toContain('raw_text')
  })
})

describe('POST /api/import/jobs with boarding pass legs', () => {
  it('admits decoded legs as unverified drafts without a provider call, a credential or a job, and replays', async () => {
    clock()
    const dispatch = vi.fn()
    const env = { GEMINI_API_KEY: undefined, IMPORT_JOBS: { idFromName: dispatch, get: dispatch } }
    const submissionOperationId = opId()
    const first = await postPass(
      {
        source: 'pdf',
        sourceLabel: 'trips/pass.pdf',
        submissionOperationId,
        legs: [
          { origin: 'JFK', destination: 'LHR', airline: 'BA', flightNumber: '178', dayOfYear: 280 },
          { origin: 'LHR', destination: 'IST' },
        ],
      },
      USER,
      {},
      env,
    )
    expect(first.status).toBe(201)
    expect(first.body.batch).toMatchObject({
      status: 'review',
      stage: 'review_ready',
      sourceType: 'pdf',
      sourceLabel: 'pass.pdf',
      errorCode: null,
      sequence: 1,
    })
    expect(first.body.drafts.map((draft: any) => draft.fields)).toEqual([
      {
        date: '',
        origin: 'JFK',
        destination: 'LHR',
        airline_iata: 'BA',
        flight_number: '178',
        date_ordinal_day: 280,
        flown_required: true,
      },
      {
        date: '',
        origin: 'LHR',
        destination: 'IST',
        airline_iata: 'ZZ',
        airline_was_placeholder: true,
        flown_required: true,
      },
    ])
    expect(await draftRows(first.body.batch.id)).toMatchObject([
      { confidence: null, field_confidence_json: null, year_explicit: 0, selected: 0, edited: 0 },
      { confidence: null, field_confidence_json: null, year_explicit: 0, selected: 0, edited: 0 },
    ])

    const replay = await postPass(
      { submissionOperationId, legs: [{ origin: 'DXB', destination: 'TBS' }] },
      USER,
      {},
      env,
    )
    expect(replay.status).toBe(200)
    expect(replay.body.batch.id).toBe(first.body.batch.id)
    expect(replay.body.drafts).toHaveLength(2)
    expect(await count(db, 'import_batches')).toBe(1)
    expect(dispatch).not.toHaveBeenCalled()
    expect(provider.generateContent).not.toHaveBeenCalled()
  })

  it('finalizes an incomplete itinerary as partial with ROWS_REJECTED and keeps the legs read', async () => {
    const { status, body } = await postPass({ incomplete: true })
    expect(status).toBe(201)
    expect(body.batch).toMatchObject({ status: 'partial', errorCode: 'ROWS_REJECTED' })
    expect(body.drafts).toHaveLength(1)
  })

  const SECRET = 'SECRET'
  const leg = (over: Record<string, unknown>) => ({ origin: 'JFK', destination: 'LHR', ...over })
  it.each([
    ['an unknown body key', { [`${SECRET}KEY`]: 1 }],
    ['the text content key', { content: `${SECRET} pasted text` }],
    ['a text source', { source: 'text' }],
    ['no source', { source: undefined }],
    ['no legs', { legs: [] }],
    ['nine legs', { legs: Array.from({ length: 9 }, () => leg({})) }],
    ['legs that are not a list', { legs: leg({}) }],
    ['a leg that is not an object', { legs: [`${SECRET}`] }],
    ['an unknown leg key', { legs: [leg({ [`${SECRET}KEY`]: '12A' })] }],
    ['a lowercase origin', { legs: [leg({ origin: SECRET.toLowerCase() })] }],
    ['a long destination', { legs: [leg({ destination: SECRET })] }],
    ['a missing destination', { legs: [{ origin: 'JFK' }] }],
    ['a null airline', { legs: [leg({ airline: null })] }],
    ['a three-character airline', { legs: [leg({ airline: 'BAA' })] }],
    ['a five-digit flight number', { legs: [leg({ flightNumber: '12345' })] }],
    ['a letter-first flight number', { legs: [leg({ flightNumber: 'A123' })] }],
    ['day 0', { legs: [leg({ dayOfYear: 0 })] }],
    ['day 367', { legs: [leg({ dayOfYear: 367 })] }],
    ['a fractional day', { legs: [leg({ dayOfYear: 1.5 })] }],
    ['a numeric-string day', { legs: [leg({ dayOfYear: '12' })] }],
    ['a non-boolean incomplete', { incomplete: SECRET }],
    ['a short operation id', { submissionOperationId: 'short' }],
  ])('refuses %s with a 400 and persists nothing', async (_name, over) => {
    const { status, body } = await postPass(over)
    expect(status).toBe(400)
    expect(body.code).toMatch(/^INVALID_(BOARDING_PASS|OPERATION_ID)$/)
    expect(JSON.stringify(body)).not.toContain(SECRET)
    expect(await count(db, 'import_batches')).toBe(0)
    expect(await count(db, 'import_drafts')).toBe(0)
  })

  it('marks provider drafts flown_required only when the file import asks, and refuses a bad flag', async () => {
    answer([providerFlight()])
    const file = { type: 'pdf', content: 'JVBERi0x' }
    const marked = await postJob(db, { ...file, requireFlownConfirmation: true })
    const plain = await postJob(db, { ...file, requireFlownConfirmation: false })
    expect(marked.body.drafts[0].fields).toMatchObject({ flown_required: true })
    expect(plain.body.drafts[0].fields).not.toHaveProperty('flown_required')
    for (const over of [
      { ...file, requireFlownConfirmation: 'yes' },
      { type: 'text', requireFlownConfirmation: true },
    ]) {
      const refused = await postJob(db, over)
      expect(refused.status).toBe(400)
      expect(refused.body.code).toBe('INVALID_BODY')
    }
    expect(await count(db, 'import_batches')).toBe(2)
    // false is a plain "no" on a text import: accepted and ignored.
    const text = await postJob(db, {
      type: 'text',
      content: 'Flight details',
      requireFlownConfirmation: false,
    })
    expect(text.status).toBe(201)
    expect(text.body.drafts[0].fields).not.toHaveProperty('flown_required')
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
    const edited = await patchDraft(db, created.drafts[0].id, {
      version: 1,
      fields: { destination: 'dxb' },
      selected: false,
    })
    expect(edited.status).toBe(200)
    const reloaded = await getBatch(db, created.batch.id)
    expect(reloaded.body.drafts[0]).toMatchObject({
      version: 2,
      edited: true,
      selected: false,
      fields: { destination: 'DXB' },
    })
    expect(reloaded.body.batch.sequence).toBe(created.batch.sequence + 1)
  })

  it('matches duplicates against the full owned history, not a capped page, and excludes the converted flight', async () => {
    const created = await seed([
      providerFlight({ date: '2021-03-10' }),
      providerFlight({ date: '2021-03-10', origin: 'TBS', destination: 'IST' }),
    ])
    await db
      .prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 1200)
      INSERT INTO flights (user_id,date,origin,destination,is_upcoming,lifecycle_state,confirmation_source,confirmed_at)
      SELECT ?, date('2018-01-01', '+' || x || ' days'), 'TBS', 'IST', 0, 'logged', 'legacy', NULL FROM n`)
      .bind(USER.id)
      .run()
    const early = await db
      .prepare(
        "INSERT INTO flights (user_id,date,origin,destination,is_upcoming,lifecycle_state,confirmation_source) VALUES (?,'2021-03-10','JFK','LHR',0,'logged','legacy')",
      )
      .bind(USER.id)
      .run()
    await db
      .prepare(
        "INSERT INTO flights (user_id,date,origin,destination,is_upcoming,lifecycle_state,confirmation_source) VALUES (?,'2021-03-10','JFK','LHR',0,'logged','legacy')",
      )
      .bind(OTHER.id)
      .run()
    const read = await getBatch(db, created.batch.id)
    expect(read.body.drafts[0].duplicateFlightId).toBe(early.meta.last_row_id)
    expect(read.body.drafts[1].duplicateFlightId).not.toBeNull() // deep inside the 1200 seeded days, far past any 200-row page
    // A draft that already became that flight is not its own duplicate.
    await db
      .prepare(
        "UPDATE import_drafts SET status = 'converted', converted_flight_id = ? WHERE id = ?",
      )
      .bind(early.meta.last_row_id, created.drafts[0].id)
      .run()
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
    const created = await seed([
      providerFlight({ date: '2026-03-12', field_confidence: { date_year_explicit: false } }),
    ])
    const [draft] = created.drafts
    const none = await patchDraft(db, draft.id, { version: 1, selected: true })
    expect(none.body.draft).toMatchObject({ version: 2, selected: true, edited: false })
    const response = await patchDraft(db, draft.id, {
      version: 2,
      fields: { date: '2026-03-12', flight_number: '', aircraft_icao: null, origin: 'ist' },
      yearConfirmed: true,
      duplicateAcknowledged: true,
    })
    expect(response.status).toBe(200)
    expect(response.body.draft).toMatchObject({
      version: 3,
      edited: true,
      yearConfirmed: true,
      duplicateAcknowledged: true,
      selected: true,
      fields: { date: '2026-03-12', origin: 'IST', destination: 'LHR' },
    })
    expect(response.body.draft.fields).not.toHaveProperty('flight_number')
    expect(response.body.draft.fields).not.toHaveProperty('aircraft_icao')
    expect(response.body.draft.issue).toBeNull()
    expect(await draftRows(created.batch.id)).toMatchObject([
      { version: 3, edited: 1, year_confirmed: 1, duplicate_acknowledged: 1, selected: 1 },
    ])
    expect((await batchRow(created.batch.id))!.sequence).toBe(created.batch.sequence + 2)
  })

  it("records the flown confirmation as the member's answer: no edit mark, metadata kept, never settable through fields", async () => {
    const pass = await postPass({ legs: [{ origin: 'JFK', destination: 'LHR', dayOfYear: 280 }] })
    const id = pass.body.drafts[0].id
    const on = await patchDraft(db, id, { version: 1, flownConfirmed: true })
    expect(on.status).toBe(200)
    expect(on.body.draft).toMatchObject({
      version: 2,
      edited: false,
      fields: { flown_required: true, flown_confirmed: true, date_ordinal_day: 280 },
    })
    const dated = await patchDraft(db, id, {
      version: 2,
      fields: { date: '2026-10-07' },
      yearConfirmed: true,
    })
    expect(dated.body.draft).toMatchObject({
      version: 3,
      edited: true,
      fields: { date: '2026-10-07', date_ordinal_day: 280, flown_required: true },
    })
    // A new date voids the earlier answer, so the row asks again.
    expect(dated.body.draft.fields).not.toHaveProperty('flown_confirmed')
    // An explicit answer in the same patch as a date change wins over the clearing.
    const answered = await patchDraft(db, id, {
      version: 3,
      fields: { date: '2026-10-09' },
      flownConfirmed: true,
    })
    expect(answered.body.draft).toMatchObject({ version: 4, fields: { flown_confirmed: true } })
    const off = await patchDraft(db, id, { version: 4, flownConfirmed: false })
    expect(off.body.draft).toMatchObject({ version: 5, edited: true })
    expect(off.body.draft.fields).not.toHaveProperty('flown_confirmed')
    expect(off.body.draft.fields).toMatchObject({ flown_required: true, date_ordinal_day: 280 })
    for (const body of [
      { version: 5, fields: { flown_confirmed: true } },
      { version: 5, fields: { flown_required: true } },
      { version: 5, fields: { date_ordinal_day: 9 } },
      { version: 5, flownConfirmed: 'yes' },
    ])
      expect((await patchDraft(db, id, body)).status, JSON.stringify(body)).toBe(400)

    // A row the import never marked cannot be answered.
    const plain = await seed([providerFlight()])
    const refused = await patchDraft(db, plain.drafts[0].id, { version: 1, flownConfirmed: true })
    expect(refused.status).toBe(400)
    expect(refused.body.code).toBe('INVALID_DRAFT')
    expect(refused.body.error).toMatch(/flown confirmation/)
    const [stored] = await draftRows(plain.batch.id)
    expect(stored.version).toBe(1)
    expect(stored.fields_json).not.toContain('flown')
  })

  it('refuses a stale version with the current draft and changes nothing', async () => {
    const created = await seed([providerFlight()])
    const id = created.drafts[0].id
    expect((await patchDraft(db, id, { version: 1, fields: { destination: 'DXB' } })).status).toBe(
      200,
    )
    const stale = await patchDraft(db, id, { version: 1, fields: { destination: 'TBS' } })
    expect(stale.status).toBe(409)
    expect(stale.body).toMatchObject({
      code: 'DRAFT_VERSION_CONFLICT',
      draft: { version: 2, fields: { destination: 'DXB' } },
    })
    expect((await draftRows(created.batch.id))[0]).toMatchObject({ version: 2 })
  })

  it('serializes two tabs editing the same version: exactly one wins', async () => {
    const created = await seed([providerFlight()])
    const id = created.drafts[0].id
    const results = await Promise.all([
      patchDraft(db, id, { version: 1, fields: { destination: 'DXB' } }),
      patchDraft(db, id, { version: 1, fields: { destination: 'TBS' } }),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect((await draftRows(created.batch.id))[0].version).toBe(2)
  })

  it('is owner-scoped, CSRF-protected, shape-validated and keeps unknown references correctable', async () => {
    const created = await seed([providerFlight()])
    const id = created.drafts[0].id
    expect((await patchDraft(db, id, { version: 1, selected: false }, OTHER)).status).toBe(404)
    expect((await patchDraft(db, id, { version: 1 }, null)).status).toBe(401)
    expect(
      (await patchDraft(db, id, { version: 1 }, USER, { 'X-CSRF-Token': 'forged' })).status,
    ).toBe(403)
    expect((await patchDraft(db, 'no-such-draft', { version: 1 })).status).toBe(404)
    for (const body of [
      {},
      { version: 0 },
      { version: 1, fields: { origin: 'toolong' } },
      { version: 1, fields: { date: '2026-02-30' } },
      { version: 1, fields: { surprise: 'x' } },
      { version: 1, selected: 'yes' },
      { version: 1, fields: [] },
      { version: 1, status: 'converted' },
    ]) {
      expect((await patchDraft(db, id, body)).status, JSON.stringify(body)).toBe(400)
    }
    // A well-formed code that no reference table knows is saved and reported as an issue, not refused.
    const unknown = await patchDraft(db, id, { version: 1, fields: { destination: 'QQQ' } })
    expect(unknown.status).toBe(200)
    expect(unknown.body.draft.issue).toMatchObject({ code: 'UNKNOWN_AIRPORT' })
    expect((await draftRows(created.batch.id))[0].version).toBe(2)
  })

  it('completes a batch when its last review row is dismissed, and reopens it when a row comes back', async () => {
    clock()
    const created = await seed([providerFlight(), providerFlight({ date: '2026-03-11' })])
    const [a, b] = created.drafts
    await patchDraft(db, a.id, { version: 1, dismissed: true })
    expect((await batchRow(created.batch.id))!.status).toBe('review')
    await patchDraft(db, b.id, { version: 1, dismissed: true })
    expect((await batchRow(created.batch.id))!.status).toBe('completed')
    await patchDraft(db, b.id, { version: 2, dismissed: false })
    expect(await batchRow(created.batch.id)).toMatchObject({ status: 'review' })
    // processing, failed and cancelled batches are never touched by an edit.
    for (const status of ['failed', 'cancelled', 'processing']) {
      await db
        .prepare('UPDATE import_batches SET status = ? WHERE id = ?')
        .bind(status, created.batch.id)
        .run()
      const version = (await draftRows(created.batch.id)).find((row) => row.id === a.id)!.version
      await patchDraft(db, a.id, { version, dismissed: version % 2 === 0 })
      expect((await batchRow(created.batch.id))!.status, status).toBe(status)
    }
  })

  it('dismisses and restores a row, but never edits a converted or expired one', async () => {
    clock()
    const created = await seed([providerFlight(), providerFlight({ date: '2026-03-11' })])
    const [first, second] = created.drafts
    const dismissed = await patchDraft(db, first.id, { version: 1, dismissed: true })
    expect(dismissed.body.draft).toMatchObject({ status: 'dismissed', version: 2 })
    expect(
      (await patchDraft(db, first.id, { version: 2, dismissed: false })).body.draft,
    ).toMatchObject({ status: 'review', version: 3 })
    await db
      .prepare(
        "UPDATE import_drafts SET status = 'converted', converted_flight_id = 1 WHERE id = ?",
      )
      .bind(second.id)
      .run()
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
    await db
      .prepare(`INSERT INTO import_conversion_receipts (user_id,operation_key,draft_id,batch_id,request_digest,flight_id,created_at)
      VALUES (?,?,?,?,'d',1,?)`)
      .bind(USER.id, 'tombstone-key-1', created.drafts[0].id, created.batch.id, NOW.toISOString())
      .run()
    const other = await seed([providerFlight()], OTHER)
    const { db: spied, hooks } = instrumentDb(db)
    const { onRequestDelete } = await import('../api/import/batches/[id]')
    const { csrfRequest, testOrigin } = await import('./harness')
    const response = await onRequestDelete({
      request: csrfRequest(`/api/import/batches/${created.batch.id}`, 'DELETE'),
      env: { DB: spied, PAGES_ORIGIN: testOrigin },
      data: { user: USER },
      params: { id: created.batch.id },
      waitUntil() {},
    } as never)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deleted: true })
    const drafts = hooks.sql.findIndex((sql) => /DELETE FROM import_drafts/.test(sql))
    const batches = hooks.sql.findIndex((sql) => /DELETE FROM import_batches/.test(sql))
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
    await db
      .prepare(
        `INSERT INTO import_batches (id,user_id,source_type,status,stage,generation,submission_operation_id,processing_deadline,created_at,updated_at,expires_at)
       VALUES (?,?,'text','processing','accepted',?,?,?,?,?,?)`,
      )
      .bind(
        id,
        USER.id,
        generation,
        `op-${id}`,
        daysAfter(1).toISOString(),
        NOW.toISOString(),
        NOW.toISOString(),
        daysAfter(30).toISOString(),
      )
      .run()
    return { userId: USER.id, batchId: id, generation }
  }
  const rows = [
    {
      fields: { date: '2026-03-10', origin: 'JFK', destination: 'LHR', airline_iata: 'BA' },
      confidence: 0.9,
      fieldConfidence: null,
      yearExplicit: true,
      selected: true,
    },
  ]

  it('writes the drafts and finalizes the batch while the generation matches', async () => {
    const fence = await processing()
    await persistDraftRows(db, fence, rows, { status: 'review', errorCode: null }, NOW)
    expect(await draftRows('fenced-batch')).toHaveLength(1)
    expect(await batchRow('fenced-batch')).toMatchObject({
      status: 'review',
      stage: 'review_ready',
      sequence: 1,
      processing_deadline: null,
    })
  })

  it('matches nothing after the generation moved on (cancel)', async () => {
    const fence = await processing()
    await db
      .prepare(
        "UPDATE import_batches SET generation = generation + 1, status = 'cancelled' WHERE id = 'fenced-batch'",
      )
      .run()
    await persistDraftRows(db, fence, rows, { status: 'review', errorCode: null }, NOW)
    expect(await draftRows('fenced-batch')).toEqual([])
    expect(await batchRow('fenced-batch')).toMatchObject({
      status: 'cancelled',
      generation: 2,
      sequence: 0,
    })
  })

  it('matches nothing when only the generation moved, even though the batch is still processing (a superseded job)', async () => {
    const fence = await processing()
    await db
      .prepare("UPDATE import_batches SET generation = generation + 1 WHERE id = 'fenced-batch'")
      .run()
    await persistDraftRows(db, fence, rows, { status: 'review', errorCode: null }, NOW)
    expect(await draftRows('fenced-batch')).toEqual([])
    expect(await batchRow('fenced-batch')).toMatchObject({
      status: 'processing',
      generation: 2,
      sequence: 0,
    })
    await persistDraftRows(
      db,
      { ...fence, generation: 2 },
      rows,
      { status: 'review', errorCode: null },
      NOW,
    )
    expect(await draftRows('fenced-batch')).toHaveLength(1)
  })

  it('matches nothing after the maintenance sweep bumped the generation of a dead job', async () => {
    const fence = await processing()
    const maintenance = (await import('../../workers/maintenance/index')).default
    clock(daysAfter(2))
    await maintenance.scheduled({} as ScheduledEvent, { DB: db, MAINTENANCE_MODE: 'false' })
    expect(await batchRow('fenced-batch')).toMatchObject({
      status: 'failed',
      error_code: 'JOB_INTERRUPTED',
      generation: 2,
    })
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
    await db
      .prepare(`INSERT INTO import_conversion_receipts (user_id,operation_key,draft_id,batch_id,request_digest,flight_id,created_at)
      VALUES (?,?,?,?,'d',1,?)`)
      .bind(USER.id, 'account-key-1', created.drafts[0].id, created.batch.id, NOW.toISOString())
      .run()
    await deleteUserCascade(db, USER.id)
    for (const table of ['import_drafts', 'import_batches', 'import_conversion_receipts']) {
      expect(
        (
          await db
            .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`)
            .bind(USER.id)
            .first<{ n: number }>()
        )?.n,
        table,
      ).toBe(0)
    }
    // The owner's late job write cannot recreate anything: the batch is gone, so the fence matches no row.
    await persistDraftRows(db, fence, rows, { status: 'review', errorCode: null }, NOW)
    expect(await count(db, 'import_drafts')).toBe(1)
    expect(await draftRows(kept.batch.id)).toHaveLength(1)
  })
})
