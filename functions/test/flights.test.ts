import { afterEach, expect, it, vi } from 'vitest'
import { createApiDatabase, apiContext } from './harness'
import { onRequestPost, isUpcomingFlight } from '../api/flights/index'
import { onRequestGet, onRequestPatch, onRequestDelete } from '../api/flights/[id]'
import { onRequestPost as bulkDelete } from '../api/flights/bulk-delete'
import { onRequestPost as deleteAll } from '../api/flights/delete-all'
import { onRequestPost as syncUpcoming } from '../api/flights/sync-upcoming'
import { repairUserDerivedState } from '../api/_services/derivedState'

const origin = 'https://kuuki.test'
const user = { id: 'u1', email: 'u1@example.test' }
const flight = { date: '2025-04-03', origin: 'TBS', destination: 'IST' }

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it('uses the same UTC calendar day as sync-upcoming', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-03T23:30:00-04:00'))
  expect(isUpcomingFlight('2026-10-04')).toBe(false)
  expect(isUpcomingFlight('2026-10-05')).toBe(true)
  vi.setSystemTime(new Date('2026-10-04T01:30:00+04:00'))
  expect(isUpcomingFlight('2026-10-03')).toBe(false)
  expect(isUpcomingFlight('2026-10-04')).toBe(true)
})

async function seed(db: D1Database) {
  await db.batch([
    db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(user.id, user.email, 'hash'),
    db.prepare('INSERT INTO profiles (id) VALUES (?)').bind(user.id),
    ...(['TBS', 'IST', 'JFK'] as const).map(iata => db.prepare(
      'INSERT INTO airports_reference (iata, name, city, country, country_code, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(iata, iata, iata, 'Test', iata === 'JFK' ? 'US' : 'GE', 40, 40)),
  ])
}

function context(db: D1Database, path: string, method: string, body?: unknown, key?: string, id?: string) {
  const request = new Request(`${origin}${path}`, {
    method,
    headers: {
      Origin: origin,
      Cookie: 'kuuki_csrf=test-csrf',
      'X-CSRF-Token': 'test-csrf',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { ...apiContext(db, request), data: { user }, params: id ? { id } : {} } as never
}

async function count(db: D1Database, table: string): Promise<number> {
  return (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n ?? 0
}

it('requires a key, rejects invalid values, and validates airport references before writing', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    expect((await onRequestPost(context(db, '/api/flights', 'POST', flight))).status).toBe(400)
    expect((await onRequestPost(context(db, '/api/flights', 'POST', { ...flight, date: '2025-02-30' }, 'date-test-001'))).status).toBe(400)
    expect((await onRequestPost(context(db, '/api/flights', 'POST', { ...flight, origin: 'XXX' }, 'airport-test-001'))).status).toBe(400)
    expect(await count(db, 'flights')).toBe(0)
    expect(await count(db, 'flight_idempotency')).toBe(0)
  } finally { await dispose() }
})

it('commits one flight and one receipt across concurrent same-key requests, then rejects conflicting reuse', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const responses = await Promise.all([
      onRequestPost(context(db, '/api/flights', 'POST', flight, 'concurrent-001')),
      onRequestPost(context(db, '/api/flights', 'POST', flight, 'concurrent-001')),
    ])
    expect(responses.map(r => r.status).sort()).toEqual([200, 201])
    const rows = await Promise.all(responses.map(r => r.json() as Promise<{ id: number }>))
    expect(rows[0].id).toBe(rows[1].id)
    expect(await count(db, 'flights')).toBe(1)
    expect(await count(db, 'flight_idempotency')).toBe(1)
    expect((await onRequestPost(context(db, '/api/flights', 'POST', { ...flight, destination: 'JFK' }, 'concurrent-001'))).status).toBe(409)
    expect(await count(db, 'flights')).toBe(1)
    expect((await onRequestDelete(context(db, `/api/flights/${rows[0].id}`, 'DELETE', undefined, undefined, String(rows[0].id)))).status).toBe(200)
    expect((await onRequestPost(context(db, '/api/flights', 'POST', flight, 'concurrent-001'))).status).toBe(410)
  } finally { await dispose() }
})

it('rolls back the key if flight insertion fails, so the same key can retry', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db.prepare("CREATE TRIGGER fail_flight BEFORE INSERT ON flights BEGIN SELECT RAISE(ABORT, 'synthetic flight failure'); END").run()
    const failed = await onRequestPost(context(db, '/api/flights', 'POST', flight, 'rollback-001'))
    expect(failed.status).toBe(500)
    expect(await count(db, 'flight_idempotency')).toBe(0)
    expect(await count(db, 'flights')).toBe(0)
    await db.prepare('DROP TRIGGER fail_flight').run()
    expect((await onRequestPost(context(db, '/api/flights', 'POST', flight, 'rollback-001'))).status).toBe(201)
  } finally { await dispose() }
})

it('acknowledges a committed flight as pending when derived publishing fails', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db.prepare("CREATE TRIGGER fail_visit BEFORE INSERT ON visits BEGIN SELECT RAISE(ABORT, 'synthetic derived failure'); END").run()
    const response = await onRequestPost(context(db, '/api/flights', 'POST', flight, 'pending-test-001'))
    expect(response.status).toBe(201)
    const body = await response.json() as { id: number; derived_state: string }
    expect(body.derived_state).toBe('pending')
    expect(await count(db, 'flights')).toBe(1)
    expect(await count(db, 'flight_idempotency')).toBe(1)
    const replay = await onRequestPost(context(db, '/api/flights', 'POST', flight, 'pending-test-001'))
    expect(replay.status).toBe(200)
    expect(await replay.json()).toMatchObject({ id: body.id, derived_state: 'pending' })
    expect(await count(db, 'flights')).toBe(1)
  } finally { await dispose() }
})

it('rejects malformed patches without corrupting a historical flight and recomputes changed routes', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const created = await onRequestPost(context(db, '/api/flights', 'POST', flight, 'patch-test-001'))
    const { id } = await created.json() as { id: number }
    const path = `/api/flights/${id}`
    expect((await onRequestPatch(context(db, path, 'PATCH', { date: '2025-02-30' }, undefined, String(id)))).status).toBe(400)
    const before = await onRequestGet(context(db, path, 'GET', undefined, undefined, String(id)))
    expect((await before.json() as { destination: string }).destination).toBe('IST')
    const changed = await onRequestPatch(context(db, path, 'PATCH', { destination: 'JFK' }, undefined, String(id)))
    expect(changed.status).toBe(200)
    expect((await changed.json() as { destination: string }).destination).toBe('JFK')
  } finally { await dispose() }
})

it('preserves unchanged historical references but rejects a different unknown code', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const result = await db.prepare('INSERT INTO flights (user_id,date,origin,destination,aircraft_icao,source,is_upcoming) VALUES (?,?,?,?,?,?,0)')
      .bind(user.id, '2025-04-03', 'MOW', 'POD', 'ZZZZ', 'manual').run()
    const id = String(result.meta.last_row_id)
    const path = `/api/flights/${id}`
    const unchanged = await onRequestPatch(context(db, path, 'PATCH', { origin: 'mow', destination: 'POD', aircraft_icao: 'ZZZZ', flight_number: 'TEST1' }, undefined, id))
    expect(unchanged.status).toBe(200)
    expect((await unchanged.json() as { origin: string; destination: string }).origin).toBe('MOW')
    expect((await onRequestPatch(context(db, path, 'PATCH', { destination: 'XXX' }, undefined, id))).status).toBe(400)
  } finally { await dispose() }
})

it('recalculates route distance and duration while respecting explicit overrides', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db.prepare('UPDATE airports_reference SET latitude=40.6413, longitude=-73.7781 WHERE iata=?').bind('JFK').run()
    const created = await onRequestPost(context(db, '/api/flights', 'POST', { ...flight, duration_minutes: 999 }, 'route-duration-001'))
    const before = await created.json() as { id: number; duration_minutes: number; distance_km: number }
    const id = String(before.id)
    const changed = await onRequestPatch(context(db, `/api/flights/${id}`, 'PATCH', { destination: 'JFK' }, undefined, id))
    const after = await changed.json() as { duration_minutes: number; distance_km: number }
    expect(after.distance_km).toBeGreaterThan(before.distance_km)
    expect(after.duration_minutes).toBeGreaterThan(0)
    expect(after.duration_minutes).not.toBe(999)
    const overridden = await onRequestPatch(context(db, `/api/flights/${id}`, 'PATCH', { destination: 'IST', distance_km: 1234, duration_minutes: 321 }, undefined, id))
    expect(await overridden.json()).toMatchObject({ distance_km: 1234, duration_minutes: 321 })
  } finally { await dispose() }
})

it.each([
  ['bulk delete', bulkDelete, '/api/flights/bulk-delete', (ids: number[]) => ({ ids })],
  ['delete all', deleteAll, '/api/flights/delete-all', () => undefined],
] as const)('publishes current stats and visits after %s removes two flights', async (_label, handler, path, body) => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const first = await onRequestPost(context(db, '/api/flights', 'POST', flight, 'multi-delete-001'))
    const second = await onRequestPost(context(db, '/api/flights', 'POST', { ...flight, destination: 'JFK' }, 'multi-delete-002'))
    const ids = [(await first.json() as { id: number }).id, (await second.json() as { id: number }).id]
    expect((await db.prepare('SELECT total_flights FROM user_stats WHERE user_id = ?').bind(user.id).first<{ total_flights: number }>())?.total_flights).toBe(2)
    expect(await count(db, 'visits')).toBe(3)

    const response = await handler(context(db, path, 'POST', body(ids)))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ deleted: 2, derived_state: 'ready' })
    expect(await count(db, 'flights')).toBe(0)
    expect((await db.prepare('SELECT total_flights FROM user_stats WHERE user_id = ?').bind(user.id).first<{ total_flights: number }>())?.total_flights).toBe(0)
    expect(await count(db, 'visits')).toBe(0)
  } finally { await dispose() }
})

it('publishes two flights that become completed in one sync', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db.batch([
      db.prepare('INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,?,?,?,1)').bind(user.id, flight.date, 'TBS', 'IST'),
      db.prepare('INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES (?,?,?,?,1)').bind(user.id, flight.date, 'TBS', 'JFK'),
    ])
    expect(await repairUserDerivedState(db, user.id)).toMatchObject({ derived_state: 'ready' })
    expect((await db.prepare('SELECT total_flights FROM user_stats WHERE user_id = ?').bind(user.id).first<{ total_flights: number }>())?.total_flights).toBe(0)

    const response = await syncUpcoming(context(db, '/api/flights/sync-upcoming', 'POST'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ synced: 2, derived_state: 'ready' })
    expect((await db.prepare('SELECT total_flights FROM user_stats WHERE user_id = ?').bind(user.id).first<{ total_flights: number }>())?.total_flights).toBe(2)
    expect(await count(db, 'visits')).toBe(3)
  } finally { await dispose() }
})
