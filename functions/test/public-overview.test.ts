import { expect, it, vi } from 'vitest'
import { onRequestGet } from '../api/public/profiles/[username]/overview'
import { onRequestGet as getProfile } from '../api/public/profiles/[username]'
import { DEFAULT_PREFS } from '../../packages/shared/src/overview/prefs'
import { apiContext } from './harness'
import { overviewAccount, USER } from './overview-fixture'

async function account() {
  return overviewAccount([
    ...Array.from({ length: 5 }, (_, i) => ({ id: i + 1, date: `2025-01-0${i + 1}`,
      origin: i % 2 ? 'IST' : 'TBS', destination: i % 2 ? 'TBS' : 'IST',
      state: i === 4 ? 'awaiting' as const : 'logged' as const, aircraft: 'A320', km: 500 + i, minutes: 90 + i })),
    { id: 6, date: '2027-01-01', origin: 'JFK', destination: 'LHR', state: 'upcoming', aircraft: 'B738' },
  ], db => [db.prepare("UPDATE profiles SET username = 'traveller', is_public = 1, home_airport = 'DXB' WHERE id = ?").bind(USER.id),
    db.prepare("UPDATE flights SET duration_source = 'times', flight_number = 'PRIVATE-NUMBER', departure_time = '10:00' WHERE user_id = ?").bind(USER.id)])
}
function request(db: D1Database, username = 'traveller') {
  return { ...apiContext(db, new Request(`https://kuuki.test/api/public/profiles/${username}/overview`)),
    params: { username } } as never
}

it('private and unknown are identical 404s, before any private batch read', async () => {
  const { db, dispose } = await account()
  try {
    await db.prepare('UPDATE profiles SET is_public = 0 WHERE id = ?').bind(USER.id).run()
    const batch = vi.fn(db.batch.bind(db)), prepare = vi.fn(db.prepare.bind(db))
    const guarded = { prepare, batch } as unknown as D1Database
    const privateResponse = await onRequestGet(request(guarded))
    const unknownResponse = await onRequestGet(request(guarded, 'unknown'))
    const existingUnknown = await getProfile(request(db, 'unknown'))
    expect(privateResponse.status).toBe(404)
    expect(unknownResponse.status).toBe(404)
    expect(await privateResponse.text()).toBe(await unknownResponse.text())
    expect(await existingUnknown.json()).toEqual({ error: 'Profile not found', code: 'NOT_FOUND' })
    expect(batch).not.toHaveBeenCalled()
    expect(prepare.mock.calls.every(([sql]) => sql.includes('FROM profiles'))).toBe(true)
  } finally { await dispose() }
})

it.each([[false, false], [true, false], [false, true], [true, true]])('sections follow owner choice: records %s, fleet %s', async (records, fleet) => {
  const { db, dispose } = await account()
  try {
    await db.prepare('UPDATE profiles SET overview_prefs = ? WHERE id = ?')
      .bind(JSON.stringify({ ...DEFAULT_PREFS, publicSections: { records, fleet } }), USER.id).run()
    const response = await onRequestGet(request(db, 'TRAVELLER'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300')
    const body = await response.json() as Record<string, unknown>
    expect(Object.hasOwn(body, 'records')).toBe(records)
    expect(Object.hasOwn(body, 'fleet')).toBe(fleet)
    if (records) expect(body.records).toMatchObject({ longest: { origin: 'TBS', destination: 'IST', value: 504 } })
    if (fleet) expect(body.fleet).toMatchObject({ typed: 5, total: 5, topType: { icao: 'A320', share: 1 } })
  } finally { await dispose() }
})

it('public subset leaks nothing finer than a month and counts neither upcoming nor home-only airports', async () => {
  const { db, dispose } = await account()
  try {
    await db.prepare('UPDATE profiles SET overview_prefs = ? WHERE id = ?')
      .bind(JSON.stringify({ ...DEFAULT_PREFS, filter: { airlines: ['unknown'] }, publicSections: { records: true, fleet: true } }), USER.id).run()
    const response = await onRequestGet(request(db))
    const text = await response.text(), body = JSON.parse(text)
    expect(body.routes).toEqual([['IST', 'TBS']])
    expect(body.airports).toEqual({ IST: { lat: 40, lon: 40 }, TBS: { lat: 40, lon: 40 } })
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(text).not.toContain('PRIVATE-NUMBER')
    const forbidden = new Set(['home', 'homeOverride', 'home_airport', 'flightNumber', 'count', 'id', 'flightId',
      'depMinute', 'departureUtc', 'originTz', 'destTz', 'busiestDay', 'longestGroundStopDays'])
    const inspect = (value: unknown) => {
      if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
        expect(forbidden.has(key), key).toBe(false)
        inspect(child)
      }
    }
    inspect(body)
  } finally { await dispose() }
})

it('a profile turning private during the flight read returns 404', async () => {
  const { db, dispose } = await account()
  try {
    const guarded = { prepare: db.prepare.bind(db), batch: async (statements: D1PreparedStatement[]) => {
      const result = await db.batch(statements)
      if (statements.length === 10) await db.prepare('UPDATE profiles SET is_public = 0 WHERE id = ?').bind(USER.id).run()
      return result
    } } as unknown as D1Database
    const response = await onRequestGet(request(guarded))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Profile not found', code: 'NOT_FOUND' })
  } finally { await dispose() }
})

it('an empty public account omits gated sections', async () => {
  const { db, dispose } = await overviewAccount([], db => [
    db.prepare("UPDATE profiles SET username = 'traveller', is_public = 1, overview_prefs = ? WHERE id = ?")
      .bind(JSON.stringify({ ...DEFAULT_PREFS, publicSections: { records: true, fleet: true } }), USER.id),
  ])
  try {
    expect(await (await onRequestGet(request(db))).json()).toEqual({ routes: [], airports: {} })
  } finally { await dispose() }
})

it('routes are sorted and deduplicated, and invalid airport coordinates are omitted', async () => {
  const { db, dispose } = await overviewAccount([
    { id: 1, date: '2025-01-01', origin: 'TBS', destination: 'IST', state: 'logged' },
    { id: 2, date: '2025-01-02', origin: 'IST', destination: 'TBS', state: 'logged' },
    { id: 3, date: '2025-01-03', origin: 'LHR', destination: 'JFK', state: 'awaiting' },
  ], db => [db.prepare("UPDATE profiles SET username = 'traveller', is_public = 1 WHERE id = ?").bind(USER.id),
    db.prepare("UPDATE airports_reference SET latitude = 100 WHERE iata = 'IST'"),
    db.prepare("UPDATE airports_reference SET longitude = NULL WHERE iata = 'LHR'")])
  try {
    expect(await (await onRequestGet(request(db))).json()).toEqual({
      routes: [['IST', 'TBS'], ['JFK', 'LHR']], airports: { JFK: { lat: 40, lon: 40 }, TBS: { lat: 40, lon: 40 } },
    })
  } finally { await dispose() }
})

it('section consent revoked during the flight read is respected', async () => {
  const { db, dispose } = await account()
  try {
    await db.prepare('UPDATE profiles SET overview_prefs = ? WHERE id = ?')
      .bind(JSON.stringify({ ...DEFAULT_PREFS, publicSections: { records: true, fleet: true } }), USER.id).run()
    const guarded = { prepare: db.prepare.bind(db), batch: async (statements: D1PreparedStatement[]) => {
      const result = await db.batch(statements)
      if (statements.length === 10) await db.prepare('UPDATE profiles SET overview_prefs = NULL WHERE id = ?').bind(USER.id).run()
      return result
    } } as unknown as D1Database
    const response = await onRequestGet(request(guarded))
    expect(response.status).toBe(200)
    expect(Object.keys(await response.json() as object).sort()).toEqual(['airports', 'routes'])
  } finally { await dispose() }
})
