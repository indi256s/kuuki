import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFlightRequest } from '../api/flights/[id]'
import { onRequestGet as publicProfile } from '../api/public/profiles/[username]'
import { apiContext, testOrigin } from './harness'
import { applyMigrationAtomically, databaseThrough, oldCreate, oldEdit } from './lifecycle-fixture'

const migration = '0008_flight_metrics.sql'
const user = { id: 'metrics-owner', email: 'metrics@example.test' }
const flight = { date: '2025-06-01', origin: 'TBS', destination: 'KUT' }

describe('flight metrics migration', () => {
  let db: D1Database
  let dispose: () => Promise<void>

  beforeEach(async () => {
    const fixture = await databaseThrough('0007_import_drafts.sql')
    db = fixture.db
    dispose = fixture.dispose
    await db.batch([
      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').bind(user.id, user.email, 'synthetic'),
      db.prepare('INSERT INTO profiles (id, username, is_public) VALUES (?, ?, 1)').bind(user.id, 'metrics-owner'),
    ])
  })

  afterEach(async () => { await dispose() })

  it('0008 adds nullable metrics to existing rows without changing historical fields', async () => {
    const [, created] = await oldCreate(db, user.id, 'historical', flight, 0)
    const id = created.meta.last_row_id
    await db.prepare('UPDATE flights SET distance_km = 234, duration_minutes = 137 WHERE id = ?').bind(id).run()
    const before = await db.prepare('SELECT * FROM flights WHERE id = ?').bind(id).first()
    await applyMigrationAtomically(db, migration)
    const after = await db.prepare('SELECT * FROM flights WHERE id = ?').bind(id).first()
    expect(after).toEqual({ ...before, duration_source: null, zones_overflown: null })
    expect(await db.prepare('SELECT overview_prefs FROM profiles WHERE id = ?').bind(user.id).first())
      .toEqual({ overview_prefs: null })
  })

  it('CHECK rejects bad values and accepts nullable values and the size boundary', async () => {
    await applyMigrationAtomically(db, migration)
    const [, created] = await oldCreate(db, user.id, 'checks', flight, 0)
    const id = created.meta.last_row_id
    for (const statement of [
      db.prepare("UPDATE flights SET duration_source = 'guess' WHERE id = ?").bind(id),
      db.prepare('UPDATE flights SET zones_overflown = -1 WHERE id = ?').bind(id),
      db.prepare('UPDATE profiles SET overview_prefs = ? WHERE id = ?').bind('{', user.id),
      db.prepare('UPDATE profiles SET overview_prefs = ? WHERE id = ?').bind(JSON.stringify('x'.repeat(8191)), user.id),
    ]) {
      await expect(statement.run()).rejects.toThrow(/CHECK constraint failed/)
    }
    for (const source of ['times', 'route_median', 'schedule', 'estimate', null]) {
      await db.prepare('UPDATE flights SET duration_source = ?, zones_overflown = 0 WHERE id = ?').bind(source, id).run()
    }
    await db.prepare('UPDATE profiles SET overview_prefs = ? WHERE id = ?').bind(JSON.stringify('x'.repeat(8190)), user.id).run()
    expect(await db.prepare('SELECT length(overview_prefs) AS size FROM profiles WHERE id = ?').bind(user.id).first())
      .toEqual({ size: 8192 })
  })

  it('old writers still work and preserve metrics they do not write', async () => {
    await applyMigrationAtomically(db, migration)
    const [, created] = await oldCreate(db, user.id, 'old-writer', flight, 0)
    expect(created.success).toBe(true)
    const id = created.meta.last_row_id
    expect(await db.prepare('SELECT duration_source, zones_overflown FROM flights WHERE id = ?').bind(id).first())
      .toEqual({ duration_source: null, zones_overflown: null })
    await db.prepare("UPDATE flights SET duration_minutes = 120, duration_source = 'times', zones_overflown = 0 WHERE id = ?").bind(id).run()
    expect((await oldEdit(db, id, { flight_number: 'A9123' }, '2026-06-01')).success).toBe(true)
    expect(await db.prepare('SELECT flight_number, duration_minutes, duration_source, zones_overflown FROM flights WHERE id = ?').bind(id).first())
      .toEqual({ flight_number: 'A9123', duration_minutes: 120, duration_source: 'times', zones_overflown: 0 })
  })

  it('own-flight reads expose provenance and preserve zero zones', async () => {
    await applyMigrationAtomically(db, migration)
    const [, created] = await oldCreate(db, user.id, 'own-read', flight, 0)
    const id = created.meta.last_row_id
    await db.prepare("UPDATE flights SET duration_minutes = 120, duration_source = 'times', zones_overflown = 0 WHERE id = ?").bind(id).run()
    const request = new Request(`${testOrigin}/api/flights/${id}`)
    const response = await readFlightRequest(request, apiContext(db, request).env as Env, { user }, String(id))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ id, duration_minutes: 120, duration_source: 'times', zones_overflown: 0 })
  })

  it('public profile never exposes prefs', async () => {
    await applyMigrationAtomically(db, migration)
    await db.prepare('UPDATE profiles SET overview_prefs = ? WHERE id = ?').bind(JSON.stringify({ marker: 'PRIVATE_PREF_MARKER' }), user.id).run()
    const request = new Request(`${testOrigin}/api/public/profiles/metrics-owner`)
    const response = await publicProfile({ ...apiContext(db, request), params: { username: 'metrics-owner' } } as never)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({ profile: { username: 'metrics-owner', is_public: true } })
    expect(JSON.stringify(body)).not.toContain('overview_prefs')
    expect(JSON.stringify(body)).not.toContain('PRIVATE_PREF_MARKER')
  })
})
