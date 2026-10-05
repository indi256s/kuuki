// ADR 0001 §5 "Newly stamped" for saves (T15 review I1): single create, bulk create and draft conversion return
// `newly_stamped_countries`, the operation-owned pressed-country difference that confirmation already reports.
// A list on fresh results once publication is ready and the before-set was known; null on replay, pending
// publication or an unknown before-set; [] for a known empty result (a future save presses nothing).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { apiContext, count, csrfRequest } from './harness'
import { hasSql, instrumentDb } from './db-hooks'
import { onRequestPost as createRoute } from '../api/flights/index'
import { onRequestPost as bulkRoute } from '../api/flights/bulk'
import { USER, clock, confirm, importAccount, itemKey, providerFlight, providerText, seedBatch } from './import-fixture'

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
    'country_claims', 'country_visit_evidence', 'user_derived_state', 'user_stats', 'visits'].map(table => db.prepare(`DELETE FROM ${table}`)))
})

const context = (target: D1Database, request: Request) => ({ ...apiContext(target, request), data: { user: USER }, params: {} }) as never
let keys = 0
const key = () => `stamp-key-${String(++keys).padStart(5, '0')}`

async function create(body: Record<string, unknown>, idempotencyKey = key(), target: D1Database = db) {
  const response = await createRoute(context(target, csrfRequest('/api/flights', 'POST', { timezone: 'UTC', ...body }, { 'Idempotency-Key': idempotencyKey })))
  return { status: response.status, body: await response.json() as Record<string, any> }
}
async function bulk(items: unknown[], target: D1Database = db) {
  const response = await bulkRoute(context(target, csrfRequest('/api/flights/bulk', 'POST', { timezone: 'UTC', items })))
  return { status: response.status, body: await response.json() as Record<string, any> }
}
const pressed = () => db.prepare("SELECT country_code FROM country_visit_evidence WHERE user_id = ? AND status = 'pressed' ORDER BY country_code")
  .bind(USER.id).all<{ country_code: string }>().then(result => result.results.map(row => row.country_code))
const PAST = { date: '2026-03-10', origin: 'JFK', destination: 'LHR' }
const FUTURE = { date: '2026-12-01', origin: 'TBS', destination: 'IST' }

describe('single create', () => {
  it('returns the countries a fresh past save pressed, and only the new ones', async () => {
    clock()
    const first = await create(PAST)
    expect(first.status).toBe(201)
    expect(first.body).toMatchObject({ lifecycle_state: 'logged', derived_state: 'ready', newly_stamped_countries: ['GB', 'US'] })
    expect(await pressed()).toEqual(['GB', 'US'])
    // GB is already pressed: only Türkiye is new.
    const second = await create({ date: '2026-03-12', origin: 'LHR', destination: 'IST' })
    expect(second.body.newly_stamped_countries).toEqual(['TR'])
    expect(await pressed()).toEqual(['GB', 'TR', 'US'])
  })

  it('returns a known empty list for a future save, which presses nothing', async () => {
    clock()
    const future = await create(FUTURE)
    expect(future.status).toBe(201)
    expect(future.body).toMatchObject({ lifecycle_state: 'upcoming', derived_state: 'ready', newly_stamped_countries: [] })
    expect(await pressed()).toEqual([])
  })

  it('returns null on replay', async () => {
    clock()
    const idempotencyKey = key()
    expect((await create(PAST, idempotencyKey)).body.newly_stamped_countries).toEqual(['GB', 'US'])
    const replay = await create(PAST, idempotencyKey)
    expect(replay.status).toBe(200)
    expect(replay.body).toMatchObject({ derived_state: 'ready', newly_stamped_countries: null })
    expect(await count(db, 'flights')).toBe(1)
  })

  it('returns null while publication is pending, with the flight committed', async () => {
    clock()
    const { db: failing, hooks } = instrumentDb(db)
    hooks.failBatch(hasSql('INSERT INTO country_visit_evidence'))
    const result = await create(PAST, key(), failing)
    expect(result.status).toBe(201)
    expect(result.body).toMatchObject({ derived_state: 'pending', newly_stamped_countries: null })
    expect(await count(db, 'flights')).toBe(1)
  })

  it('returns null when the before-set is unknown (the account was not published before the save)', async () => {
    clock()
    expect((await create(FUTURE)).body.derived_state).toBe('ready')
    // An earlier mutation whose publication never ran: the published pressed set is not trustworthy.
    await db.prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?').bind(USER.id).run()
    const result = await create(PAST)
    expect(result.body).toMatchObject({ derived_state: 'ready', newly_stamped_countries: null })
    expect(await pressed()).toEqual(['GB', 'US'])
  })

  it('does not attribute a concurrent unrelated claim to the save', async () => {
    clock()
    const { db: tracked, hooks } = instrumentDb(db)
    // A claim lands after the save committed and before its repair published.
    hooks.afterBatch(hasSql('INSERT INTO flight_idempotency'), async () => {
      await db.batch([db.prepare("INSERT INTO country_claims (id,user_id,country_code) VALUES ('c1',?,'JP')").bind(USER.id),
        db.prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?').bind(USER.id)])
    })
    const result = await create(PAST, key(), tracked)
    expect(result.body).toMatchObject({ derived_state: 'ready', newly_stamped_countries: ['GB', 'US'] })
    expect(await pressed()).toEqual(['GB', 'JP', 'US']) // pressed, just not by this save
  })
})

describe('bulk create', () => {
  it('reports per fresh item, a known empty list for a future item, nothing on errors and null on replay', async () => {
    clock()
    const items = [
      { key: key(), flight: PAST },
      { key: key(), flight: { date: '2026-03-11', origin: 'LHR', destination: 'IST' } },
      { key: key(), flight: FUTURE },
      { key: key(), flight: { ...PAST, destination: 'XXX' } },
    ]
    const first = await bulk(items)
    expect(first.status).toBe(200)
    expect(first.body.derived_state).toBe('ready')
    expect(first.body.results.map((result: any) => [result.status, result.newly_stamped_countries]))
      .toEqual([['created', ['GB', 'US']], ['created', ['GB', 'TR']], ['created', []], ['error', undefined]])
    expect(await pressed()).toEqual(['GB', 'TR', 'US'])

    const replay = await bulk(items.slice(0, 3))
    expect(replay.body.results.map((result: any) => [result.status, result.newly_stamped_countries]))
      .toEqual([['replayed', null], ['replayed', null], ['replayed', null]])
  })

  it('returns null for every item while publication is pending', async () => {
    clock()
    const { db: failing, hooks } = instrumentDb(db)
    hooks.failBatch(hasSql('INSERT INTO country_visit_evidence'))
    const result = await bulk([{ key: key(), flight: PAST }, { key: key(), flight: FUTURE }], failing)
    expect(result.body.derived_state).toBe('pending')
    expect(result.body.results.map((entry: any) => [entry.status, entry.newly_stamped_countries])).toEqual([['created', null], ['created', null]])
  })
})

describe('draft conversion', () => {
  const seed = (flights: unknown[]) => seedBatch(db, list => provider.generateContent.mockResolvedValue({ text: providerText(list) }), flights)

  it('reports per created row and null on a replayed row', async () => {
    clock()
    const created = await seed([providerFlight(), providerFlight({ date: '2026-12-01', origin: 'TBS', destination: 'IST' })])
    const items = created.drafts.map(draft => ({ draftId: draft.id, version: draft.version, key: itemKey('stamp') }))
    const first = await confirm(db, created.batch.id, { items, timezone: 'UTC' })
    expect(first.status).toBe(200)
    expect(first.body.derived_state).toBe('ready')
    expect(first.body.results.map((result: any) => [result.status, result.newly_stamped_countries]))
      .toEqual([['created', ['GB', 'US']], ['created', []]])
    expect(await pressed()).toEqual(['GB', 'US'])

    const replay = await confirm(db, created.batch.id, { items, timezone: 'UTC' })
    expect(replay.body.results.map((result: any) => [result.status, result.newly_stamped_countries]))
      .toEqual([['replayed', null], ['replayed', null]])
  })

  it('returns null while publication is pending', async () => {
    clock()
    const created = await seed([providerFlight()])
    const { db: failing, hooks } = instrumentDb(db)
    hooks.failBatch(hasSql('INSERT INTO country_visit_evidence'))
    const result = await confirm(failing, created.batch.id, { items: [{ draftId: created.drafts[0].id, version: 1, key: itemKey('stamp') }] })
    expect(result.body.derived_state).toBe('pending')
    expect(result.body.results.map((entry: any) => [entry.status, entry.newly_stamped_countries])).toEqual([['created', null]])
  })
})
