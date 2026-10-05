// ADR 0001 §1/§2 (T07): lifecycle assignment on create, bulk create, edit and the owner sync, plus A2's
// "no lifecycle-aware writer fires adapters 1-3" and A6's deadline arithmetic.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiContext, count, createApiDatabase, csrfRequest } from './harness'
import { countAdapterFirings, lifecycleOf, type LifecycleRow } from './lifecycle-fixture'
import { onRequestPost as createRoute } from '../api/flights/index'
import { onRequestPost as bulkRoute } from '../api/flights/bulk'
import { onRequestPatch as patchRoute } from '../api/flights/[id]'
import { onRequestPost as syncRoute } from '../api/flights/sync-upcoming'
import { deadlinesFor } from '../api/_services/lifecycle'
import maintenance from '../../workers/maintenance/index'

const user = { id: 'u1', email: 'u1@example.test' }
const NOW = '2026-10-05T12:00:00.000Z'

afterEach(() => { vi.useRealTimers() })
const setNow = (iso: string) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)) }

async function seed(db: D1Database) {
  await db.batch([
    db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(user.id, user.email, 'hash'),
    db.prepare('INSERT INTO profiles (id) VALUES (?)').bind(user.id),
    ...(['TBS', 'IST', 'JFK', 'LHR'] as const).map(iata => db.prepare(
      'INSERT INTO airports_reference (iata, name, city, country, country_code, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(iata, iata, iata, 'Test', iata === 'JFK' ? 'US' : iata === 'LHR' ? 'GB' : 'GE', 40, 40)),
  ])
}

function context(db: D1Database, path: string, method: string, body?: unknown, key?: string, id?: string) {
  const request = csrfRequest(path, method, body, key ? { 'Idempotency-Key': key } : {})
  return { ...apiContext(db, request), data: { user }, params: id ? { id } : {} } as never
}

let sequence = 0
async function create(db: D1Database, body: Record<string, unknown>, key = `create-key-${++sequence}`) {
  const response = await createRoute(context(db, '/api/flights', 'POST', body, key))
  return { response, json: await response.clone().json() as Record<string, unknown> & { id: number } }
}
const patch = (db: D1Database, id: number, body: Record<string, unknown>) =>
  patchRoute(context(db, `/api/flights/${id}`, 'PATCH', body, undefined, String(id)))
const flight = { date: '2026-10-05', origin: 'TBS', destination: 'IST' }

describe('create', () => {
  it('logs a same-day save directly with source save (UTC fallback for old clients)', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      const { response, json } = await create(db, flight)
      expect(response.status).toBe(201)
      expect(json).toMatchObject({ lifecycle_state: 'logged', confirmation_source: 'save', is_upcoming: false,
        lifecycle_timezone: 'UTC', awaiting_after: null, auto_confirm_after: null, arrival_transit: null })
      expect(json.confirmed_at).toBe(NOW)
    } finally { await dispose() }
  })

  it('logs a past save and creates an upcoming flight for a future date with deadlines', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      const past = await create(db, { ...flight, date: '2026-10-01' })
      expect(past.json).toMatchObject({ lifecycle_state: 'logged', confirmation_source: 'save', is_upcoming: false })
      const future = await create(db, { ...flight, date: '2026-10-06' })
      expect(future.json).toMatchObject({ lifecycle_state: 'upcoming', confirmation_source: null, confirmed_at: null, is_upcoming: true,
        lifecycle_timezone: 'UTC', awaiting_after: '2026-10-07T00:00:00.000Z', auto_confirm_after: '2026-10-14T00:00:00.000Z' })
    } finally { await dispose() }
  })

  it('decides today in the captured member timezone', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW) // 2026-10-05 12:00Z is 10-06 02:00 in Kiritimati (+14) and 10-05 01:00 in Pago Pago (-11)
      const ahead = await create(db, { ...flight, date: '2026-10-06', timezone: 'Pacific/Kiritimati' })
      expect(ahead.json).toMatchObject({ lifecycle_state: 'logged', lifecycle_timezone: 'Pacific/Kiritimati' })
      const behind = await create(db, { ...flight, date: '2026-10-06', timezone: 'Pacific/Pago_Pago' })
      expect(behind.json).toMatchObject({ lifecycle_state: 'upcoming', lifecycle_timezone: 'Pacific/Pago_Pago',
        awaiting_after: '2026-10-07T11:00:00.000Z', auto_confirm_after: '2026-10-14T11:00:00.000Z' })
      const canonical = await create(db, { ...flight, date: '2026-10-06', timezone: 'asia/tbilisi' })
      expect(canonical.json.lifecycle_timezone).toBe('Asia/Tbilisi')
    } finally { await dispose() }
  })

  it('rejects an invalid timezone before writing anything', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      const { response, json } = await create(db, { ...flight, timezone: 'Mars/Olympus' })
      expect(response.status).toBe(400)
      expect(json).toMatchObject({ code: 'INVALID_TIMEZONE' })
      expect(await count(db, 'flights')).toBe(0)
      expect(await count(db, 'flight_idempotency')).toBe(0)
      const typed = await create(db, { ...flight, timezone: 42 })
      expect(typed.json).toMatchObject({ code: 'INVALID_TIMEZONE' })
    } finally { await dispose() }
  })

  it('keeps the timezone out of the idempotency digest so a replay with another zone is still a replay', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      const first = await create(db, { ...flight, date: '2026-10-09', timezone: 'Asia/Tbilisi' }, 'replay-key-0001')
      expect(first.response.status).toBe(201)
      const replay = await create(db, { ...flight, date: '2026-10-09', timezone: 'America/New_York' }, 'replay-key-0001')
      expect(replay.response.status).toBe(200)
      expect(replay.json.id).toBe(first.json.id)
      expect(replay.json.lifecycle_timezone).toBe('Asia/Tbilisi') // the captured zone is never rewritten
      const legacy = await create(db, { ...flight, date: '2026-10-09' }, 'replay-key-0001') // an old client's retry
      expect(legacy.response.status).toBe(200)
      expect(await count(db, 'flights')).toBe(1)
    } finally { await dispose() }
  })

  it('rejects an unknown reference without writing a lifecycle row', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      const { response, json } = await create(db, { ...flight, destination: 'ZZZ' })
      expect(response.status).toBe(400)
      expect(json).toMatchObject({ code: 'UNKNOWN_AIRPORT' })
      expect(await count(db, 'flights')).toBe(0)
    } finally { await dispose() }
  })
})

describe('bulk create', () => {
  it('assigns lifecycle per item from one request timezone and keeps the digest zone-free', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      const items = [
        { key: 'bulk-key-0001', flight: { ...flight, date: '2026-10-06' } },
        { key: 'bulk-key-0002', flight: { ...flight, date: '2026-10-04' } },
        { key: 'bulk-key-0003', flight: { ...flight, date: '2026-10-09', destination: 'ZZZ' } },
      ]
      const response = await bulkRoute(context(db, '/api/flights/bulk', 'POST', { items, timezone: 'Pacific/Kiritimati' }))
      expect(response.status).toBe(200)
      const body = await response.json() as { results: Array<{ status: string; code?: string; flight?: LifecycleRow }> }
      expect(body.results.map(item => item.status)).toEqual(['created', 'created', 'error'])
      expect(body.results[0].flight).toMatchObject({ lifecycle_state: 'logged', lifecycle_timezone: 'Pacific/Kiritimati' }) // 10-06 is today there
      expect(body.results[1].flight).toMatchObject({ lifecycle_state: 'logged', confirmation_source: 'save' })
      expect(body.results[2].code).toBe('UNKNOWN_AIRPORT')

      const replay = await bulkRoute(context(db, '/api/flights/bulk', 'POST', { items: items.slice(0, 2) }))
      const replayed = await replay.json() as { results: Array<{ status: string }> }
      expect(replayed.results.map(item => item.status)).toEqual(['replayed', 'replayed'])
      expect(await count(db, 'flights')).toBe(2)

      const invalid = await bulkRoute(context(db, '/api/flights/bulk', 'POST', { items, timezone: 'Nowhere/Land' }))
      expect(invalid.status).toBe(400)
      expect(await invalid.json()).toMatchObject({ code: 'INVALID_TIMEZONE' })
    } finally { await dispose() }
  })

  it('creates upcoming flights for future dates', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      const response = await bulkRoute(context(db, '/api/flights/bulk', 'POST', { items: [{ key: 'bulk-key-0010', flight: { ...flight, date: '2026-12-24' } }] }))
      const body = await response.json() as { results: Array<{ flight: LifecycleRow }> }
      expect(body.results[0].flight).toMatchObject({ lifecycle_state: 'upcoming', is_upcoming: true, awaiting_after: '2026-12-25T00:00:00.000Z' })
    } finally { await dispose() }
  })
})

describe('edit', () => {
  /** An awaiting flight: created in the future, then moved by the owner sync after its morning-after boundary. */
  async function awaitingFlight(db: D1Database, date = '2026-10-06') {
    setNow(NOW)
    const created = await create(db, { ...flight, date })
    setNow('2026-10-07T08:00:00.000Z')
    expect(await (await syncRoute(context(db, '/api/flights/sync-upcoming', 'POST'))).json()).toMatchObject({ synced: 1 })
    expect((await lifecycleOf(db, created.json.id))?.lifecycle_state).toBe('awaiting')
    return created.json.id
  }

  it('moves an upcoming flight to awaiting only when its corrected local day is over; today stays upcoming', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      const { json } = await create(db, { ...flight, date: '2026-10-10' })
      const today = await patch(db, json.id, { date: '2026-10-05' })
      expect(await today.json()).toMatchObject({ lifecycle_state: 'upcoming', is_upcoming: true, awaiting_after: '2026-10-06T00:00:00.000Z', auto_confirm_after: '2026-10-13T00:00:00.000Z' })
      const past = await patch(db, json.id, { date: '2026-10-04' })
      expect(await past.json()).toMatchObject({ lifecycle_state: 'awaiting', is_upcoming: false, confirmation_source: null, awaiting_after: '2026-10-05T00:00:00.000Z', auto_confirm_after: '2026-10-12T00:00:00.000Z' })
    } finally { await dispose() }
  })

  it('never auto-confirms inline: a corrected flight past both deadlines becomes awaiting', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      const { json } = await create(db, { ...flight, date: '2026-10-10' })
      const edited = await patch(db, json.id, { date: '2026-08-01' })
      expect(await edited.json()).toMatchObject({ lifecycle_state: 'awaiting', confirmation_source: null, confirmed_at: null,
        awaiting_after: '2026-08-02T00:00:00.000Z', auto_confirm_after: '2026-08-09T00:00:00.000Z' })
    } finally { await dispose() }
  })

  it('keeps an awaiting flight awaiting on a past date and recomputes from the corrected date, not the edit time', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db)
      const id = await awaitingFlight(db)
      const edited = await patch(db, id, { date: '2026-09-20' })
      expect(await edited.json()).toMatchObject({ lifecycle_state: 'awaiting', is_upcoming: false, confirmed_at: null,
        awaiting_after: '2026-09-21T00:00:00.000Z', auto_confirm_after: '2026-09-28T00:00:00.000Z' })
    } finally { await dispose() }
  })

  it('returns an awaiting or logged flight to upcoming for a future date, clearing confirmation and transit', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db)
      const id = await awaitingFlight(db)
      const future = await patch(db, id, { date: '2026-11-20', timezone: 'Asia/Tbilisi' })
      expect(await future.json()).toMatchObject({ lifecycle_state: 'upcoming', is_upcoming: true, confirmation_source: null, confirmed_at: null,
        arrival_transit: null, lifecycle_timezone: 'Asia/Tbilisi', awaiting_after: '2026-11-20T20:00:00.000Z', auto_confirm_after: '2026-11-27T20:00:00.000Z' })

      setNow(NOW)
      const logged = (await create(db, { ...flight, date: '2026-10-01' })).json.id
      await db.prepare('UPDATE flights SET arrival_transit = 1, arrival_transit_leg_id = ? WHERE id = ?').bind(id, logged).run()
      const moved = await patch(db, logged, { date: '2026-11-21' })
      expect(await moved.json()).toMatchObject({ lifecycle_state: 'upcoming', confirmation_source: null, confirmed_at: null, arrival_transit: null, arrival_transit_leg_id: null })
    } finally { await dispose() }
  })

  it('keeps a logged flight logged, with its recorded provenance, on a past re-date', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      const { json } = await create(db, { ...flight, date: '2026-10-01' })
      const edited = await patch(db, json.id, { date: '2026-09-15', flight_number: 'KU1' })
      expect(await edited.json()).toMatchObject({ lifecycle_state: 'logged', confirmation_source: 'save', confirmed_at: NOW, awaiting_after: null, flight_number: 'KU1' })
    } finally { await dispose() }
  })

  it('uses the stored zone for a date edit without a timezone, and the request zone when present', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      const { json } = await create(db, { ...flight, date: '2026-10-10', timezone: 'Asia/Tbilisi' })
      const kept = await patch(db, json.id, { date: '2026-10-12' })
      expect(await kept.json()).toMatchObject({ lifecycle_timezone: 'Asia/Tbilisi', awaiting_after: '2026-10-12T20:00:00.000Z' })
      const changed = await patch(db, json.id, { date: '2026-10-13', timezone: 'America/New_York' })
      expect(await changed.json()).toMatchObject({ lifecycle_timezone: 'America/New_York', awaiting_after: '2026-10-14T04:00:00.000Z' })
      const invalid = await patch(db, json.id, { date: '2026-10-14', timezone: 'Nope/Nope' })
      expect(invalid.status).toBe(400)
    } finally { await dispose() }
  })

  it('resets the transit decision on a route change only', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      const hub = (await create(db, { ...flight, origin: 'IST', destination: 'JFK', date: '2026-10-02' })).json.id
      const { json } = await create(db, { ...flight, date: '2026-10-01' })
      await db.prepare('UPDATE flights SET arrival_transit = 1, arrival_transit_leg_id = ? WHERE id = ?').bind(hub, json.id).run()
      const other = await patch(db, json.id, { flight_number: 'KU2', date: '2026-09-30' })
      expect(await other.json()).toMatchObject({ arrival_transit: true, arrival_transit_leg_id: hub })
      const rerouted = await patch(db, json.id, { destination: 'LHR' })
      expect(await rerouted.json()).toMatchObject({ lifecycle_state: 'logged', arrival_transit: null, arrival_transit_leg_id: null })
      await db.prepare('UPDATE flights SET arrival_transit = 0 WHERE id = ?').bind(json.id).run()
      const origin = await patch(db, json.id, { origin: 'JFK' })
      expect(await origin.json()).toMatchObject({ arrival_transit: null })
    } finally { await dispose() }
  })

  it('answers 404 for a missing flight and 409 when the state changed between the edit read and write', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      expect((await patch(db, 999, { flight_number: 'KU3' })).status).toBe(404)
      const { json } = await create(db, { ...flight, date: '2026-10-10' })
      // A confirmation or sync lands after the handler read the row and before its guarded UPDATE.
      const racing = { prepare: (sql: string) => db.prepare(sql), batch: async (statements: D1PreparedStatement[]) => {
        await db.prepare("UPDATE flights SET lifecycle_state = 'awaiting', is_upcoming = 0 WHERE id = ?").bind(json.id).run()
        return db.batch(statements)
      } } as unknown as D1Database
      const stale = await patchRoute(context(racing, `/api/flights/${json.id}`, 'PATCH', { flight_number: 'KU4' }, undefined, String(json.id)))
      expect(stale.status).toBe(409)
      expect(await stale.json()).toMatchObject({ code: 'STATE_CONFLICT' })
      expect(await lifecycleOf(db, json.id)).toMatchObject({ lifecycle_state: 'awaiting', is_upcoming: 0 }) // not overwritten
      expect((await db.prepare('SELECT flight_number FROM flights WHERE id = ?').bind(json.id).first<{ flight_number: string | null }>())?.flight_number).toBeNull()
    } finally { await dispose() }
  })
})

describe('owner sync', () => {
  it('moves a flight on its stored morning-after boundary, not on its UTC departure day', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      const { json } = await create(db, { ...flight, date: '2026-10-06' })
      const sync = async () => await (await syncRoute(context(db, '/api/flights/sync-upcoming', 'POST'))).json() as { synced: number }
      setNow('2026-10-06T23:59:59.999Z') // departure day; the old UTC rule would flip here
      expect((await sync()).synced).toBe(0)
      expect((await lifecycleOf(db, json.id))?.lifecycle_state).toBe('upcoming')
      setNow('2026-10-07T00:00:00.000Z')
      expect(await sync()).toMatchObject({ synced: 1, derived_state: 'ready' })
      expect(await lifecycleOf(db, json.id)).toMatchObject({ lifecycle_state: 'awaiting', is_upcoming: 0, confirmation_source: null,
        awaiting_after: '2026-10-07T00:00:00.000Z', auto_confirm_after: '2026-10-14T00:00:00.000Z' })
      expect((await db.prepare('SELECT total_flights FROM user_stats WHERE user_id = ?').bind(user.id).first<{ total_flights: number }>())?.total_flights).toBe(1)
      setNow('2026-10-20T00:00:00.000Z')
      expect((await sync()).synced).toBe(0) // late syncs never restart or move the deadlines
      expect((await lifecycleOf(db, json.id))?.auto_confirm_after).toBe('2026-10-14T00:00:00.000Z')
    } finally { await dispose() }
  })
})

describe('maintenance cron', () => {
  it('moves due flights to awaiting on the same stored boundary as the sync, without firing an adapter', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      const firings = await countAdapterFirings(db)
      const early = (await create(db, { ...flight, date: '2026-10-06' })).json.id
      const late = (await create(db, { ...flight, date: '2026-10-09', timezone: 'Pacific/Pago_Pago' })).json.id
      setNow('2026-10-06T23:59:59.999Z') // departure day: the old UTC rule would flip `early` here
      await maintenance.scheduled({} as ScheduledEvent, { DB: db })
      expect((await lifecycleOf(db, early))?.lifecycle_state).toBe('upcoming')
      setNow('2026-10-07T00:00:00.000Z')
      await maintenance.scheduled({} as ScheduledEvent, { DB: db })
      expect(await lifecycleOf(db, early)).toMatchObject({ lifecycle_state: 'awaiting', is_upcoming: 0, confirmation_source: null })
      expect((await lifecycleOf(db, late))?.lifecycle_state).toBe('upcoming') // 10-09 in Pago Pago ends at 10-10T11:00Z
      expect((await db.prepare('SELECT total_flights FROM user_stats WHERE user_id = ?').bind(user.id).first<{ total_flights: number }>())?.total_flights).toBe(1)
      setNow('2026-10-10T10:59:59.999Z')
      await maintenance.scheduled({} as ScheduledEvent, { DB: db })
      expect((await lifecycleOf(db, late))?.lifecycle_state).toBe('upcoming')
      setNow('2026-10-10T11:00:00.000Z')
      await maintenance.scheduled({} as ScheduledEvent, { DB: db })
      expect((await lifecycleOf(db, late))?.lifecycle_state).toBe('awaiting')
      expect(await firings()).toEqual({})
    } finally { await dispose() }
  })
})

describe('adapters 1-3 stay quiet for lifecycle-aware writers (A2)', () => {
  it('fires no adapter for create, bulk, edit and sync', async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db); setNow(NOW)
      const firings = await countAdapterFirings(db)
      const future = (await create(db, { ...flight, date: '2026-10-10' })).json.id
      const past = (await create(db, { ...flight, date: '2026-10-01' })).json.id
      await bulkRoute(context(db, '/api/flights/bulk', 'POST', { items: [
        { key: 'quiet-key-0001', flight: { ...flight, date: '2026-10-08' } }, { key: 'quiet-key-0002', flight: { ...flight, date: '2026-09-08' } },
      ], timezone: 'Asia/Tbilisi' }))
      await patch(db, future, { date: '2026-10-12' }) // upcoming future -> future
      await patch(db, future, { date: '2026-10-04' }) // upcoming -> awaiting
      await patch(db, future, { date: '2026-09-20' }) // awaiting past -> past
      await patch(db, future, { date: '2026-11-01' }) // awaiting -> upcoming
      await patch(db, past, { date: '2026-09-01' }) // logged past -> past
      await patch(db, past, { destination: 'LHR' }) // route edit
      await patch(db, past, { date: '2026-12-01' }) // logged -> upcoming
      setNow('2026-12-03T00:00:00.000Z')
      expect(await (await syncRoute(context(db, '/api/flights/sync-upcoming', 'POST'))).json()).toMatchObject({ synced: 3 })
      expect(await firings()).toEqual({})
      // Control: a pre-lifecycle write still fires the adapter, so the counter is armed.
      await db.prepare('UPDATE flights SET is_upcoming = 1 WHERE id = (SELECT MIN(id) FROM flights WHERE is_upcoming = 0)').run()
      expect(await firings()).toMatchObject({ flights_lifecycle_adapt_flag: 1 })
    } finally { await dispose() }
  })
})

describe('deadline arithmetic (A6)', () => {
  it('counts the 7-day window in calendar days of the captured zone, across DST-at-midnight', () => {
    // Santiago springs forward at local midnight on 2026-09-06: a calendar week there is 167 hours.
    const santiago = deadlinesFor('2026-09-05', 'America/Santiago')
    expect(santiago).toEqual({ awaiting_after: '2026-09-06T04:00:00.000Z', auto_confirm_after: '2026-09-13T03:00:00.000Z' })
    expect(Date.parse(santiago.auto_confirm_after) - Date.parse(santiago.awaiting_after)).toBe(167 * 3_600_000)
    // Havana falls back on 2026-11-01: that week is 169 hours.
    const havana = deadlinesFor('2026-10-31', 'America/Havana')
    expect(havana).toEqual({ awaiting_after: '2026-11-01T04:00:00.000Z', auto_confirm_after: '2026-11-08T05:00:00.000Z' })
  })

  it('handles the +14h and -12h extremes and UTC, with the boundary exact to the millisecond', () => {
    expect(deadlinesFor('2026-10-05', 'Pacific/Kiritimati')).toEqual({ awaiting_after: '2026-10-05T10:00:00.000Z', auto_confirm_after: '2026-10-12T10:00:00.000Z' })
    expect(deadlinesFor('2026-10-05', 'Etc/GMT+12')).toEqual({ awaiting_after: '2026-10-06T12:00:00.000Z', auto_confirm_after: '2026-10-13T12:00:00.000Z' })
    const utc = deadlinesFor('2026-10-05', 'UTC')
    expect(utc).toEqual({ awaiting_after: '2026-10-06T00:00:00.000Z', auto_confirm_after: '2026-10-13T00:00:00.000Z' })
    const boundary = Date.parse(utc.auto_confirm_after)
    expect(new Date(boundary - 1).toISOString() < utc.auto_confirm_after).toBe(true)
    expect(new Date(boundary).toISOString() >= utc.auto_confirm_after).toBe(true)
  })
})
