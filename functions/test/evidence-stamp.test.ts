// ADR 0001 §10 / A2 F2 and I1 (T07): a publication below the rollback floor leaves the evidence stamp
// stale; the first lifecycle-aware sync and the maintenance repair both run the full publish and reconcile.
import { afterEach, expect, it, vi } from 'vitest'
import { apiContext, createApiDatabase, csrfRequest } from './harness'
import { oldEdit } from './lifecycle-fixture'
import { onRequestGet as derivedStateRoute } from '../api/me/derived-state'
import { onRequestPost as syncRoute } from '../api/flights/sync-upcoming'
import { repairUserDerivedState } from '../api/_services/derivedState'
import maintenance from '../../workers/maintenance/index'

const user = { id: 'u1', email: 'u1@example.test' }
afterEach(() => {
  vi.useRealTimers()
})

const ctx = (db: D1Database, path: string, method: string) =>
  ({ ...apiContext(db, csrfRequest(path, method)), data: { user }, params: {} }) as never
const stamp = (db: D1Database) =>
  db
    .prepare(
      'SELECT revision, published_revision, evidence_revision, published_at FROM user_derived_state WHERE user_id = ?',
    )
    .bind(user.id)
    .first<{
      revision: number
      published_revision: number
      evidence_revision: number
      published_at: string
    }>()
const suppressions = (db: D1Database) =>
  db
    .prepare(
      'SELECT flight_id, endpoint, country_code FROM country_evidence_suppressions WHERE user_id = ? ORDER BY flight_id, endpoint',
    )
    .bind(user.id)
    .all()
    .then((r) => r.results)
const countries = (db: D1Database) =>
  db
    .prepare(
      'SELECT country_code FROM country_visit_evidence WHERE user_id = ? ORDER BY country_code',
    )
    .bind(user.id)
    .all<{ country_code: string }>()
    .then((r) => r.results.map((row) => row.country_code))

/** A: TBS->IST (transit), B: IST->JFK; a published account whose transit decision hides Turkey. */
async function transitAccount() {
  const { db, dispose } = await createApiDatabase()
  await db.batch([
    db
      .prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)')
      .bind(user.id, user.email, 'hash'),
    db.prepare('INSERT INTO profiles (id) VALUES (?)').bind(user.id),
    ...[
      ['TBS', 'GE'],
      ['IST', 'TR'],
      ['JFK', 'US'],
      ['LHR', 'GB'],
    ].map(([iata, cc]) =>
      db
        .prepare(
          'INSERT INTO airports_reference (iata, name, city, country, country_code, latitude, longitude) VALUES (?,?,?,?,?,?,?)',
        )
        .bind(iata, iata, iata, cc, cc, 40, 40),
    ),
    db
      .prepare(
        "INSERT INTO flights (id,user_id,date,origin,destination,is_upcoming,enrichment_status) VALUES (1,?,'2026-09-01','TBS','IST',0,'skipped')",
      )
      .bind(user.id),
    db
      .prepare(
        "INSERT INTO flights (id,user_id,date,origin,destination,is_upcoming,enrichment_status) VALUES (2,?,'2026-09-02','IST','JFK',0,'skipped')",
      )
      .bind(user.id),
    db.prepare('UPDATE flights SET arrival_transit = 1, arrival_transit_leg_id = 2 WHERE id = 1'),
    db
      .prepare(
        'INSERT INTO user_derived_state (user_id,revision,published_revision) VALUES (?,1,0) ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1',
      )
      .bind(user.id),
  ])
  expect(await repairUserDerivedState(db, user.id)).toMatchObject({ derived_state: 'ready' })
  expect(await countries(db)).toEqual(['GE', 'US'])
  expect(await suppressions(db)).toEqual([
    { flight_id: 1, endpoint: 'destination', country_code: 'TR' },
    { flight_id: 2, endpoint: 'origin', country_code: 'TR' },
  ])
  return { db, dispose }
}

/** What a pre-lifecycle build does after a route edit: its dirty mark, then its repair publishing the revision without the stamp. */
async function oldRouteEditAndRepair(db: D1Database) {
  await oldEdit(db, 1, { destination: 'LHR' }, '2026-10-05')
  expect(
    await db
      .prepare('SELECT arrival_transit, arrival_transit_leg_id FROM flights WHERE id = 1')
      .first(),
  ).toEqual({ arrival_transit: null, arrival_transit_leg_id: null })
  await db
    .prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?')
    .bind(user.id)
    .run()
  await db
    .prepare('UPDATE user_derived_state SET published_revision = revision WHERE user_id = ?')
    .bind(user.id)
    .run()
}

it('F2: an old route edit and old repair leave the stamp stale, and readers report it as not ready', async () => {
  const { db, dispose } = await transitAccount()
  try {
    await oldRouteEditAndRepair(db)
    const state = await stamp(db)
    expect(state!.revision).toBe(state!.published_revision)
    expect(state!.evidence_revision).toBeLessThan(state!.published_revision)
    expect(await suppressions(db)).toHaveLength(2) // the stale suppression of the old hub is still published
    expect(
      await (await derivedStateRoute(ctx(db, '/api/me/derived-state', 'GET'))).json(),
    ).toMatchObject({ derived_state: 'pending' })
    // The repair's own early return honours the stamp: a ready predicate on revision alone would be a no-op here.
    expect(await repairUserDerivedState(db, user.id)).toMatchObject({ derived_state: 'ready' })
    expect((await stamp(db))!.evidence_revision).toBe(state!.revision)
  } finally {
    await dispose()
  }
})

it('F2/I1: the first lifecycle-aware sync repairs inline, drops the stale suppression and republishes the same revision', async () => {
  const { db, dispose } = await transitAccount()
  try {
    await oldRouteEditAndRepair(db)
    const before = (await stamp(db))!
    const response = await syncRoute(ctx(db, '/api/flights/sync-upcoming', 'POST'))
    expect(await response.json()).toMatchObject({
      synced: 0,
      derived_state: 'ready',
      revision: before.revision,
    })
    expect(await stamp(db)).toMatchObject({
      revision: before.revision,
      published_revision: before.revision,
      evidence_revision: before.revision,
    })
    expect(await suppressions(db)).toEqual([]) // no decision remains, so nothing suppresses Turkey or the new destination
    expect(await countries(db)).toEqual(['GB', 'GE', 'TR', 'US'])
    expect(
      await (await derivedStateRoute(ctx(db, '/api/me/derived-state', 'GET'))).json(),
    ).toMatchObject({ derived_state: 'ready' })
  } finally {
    await dispose()
  }
})

it('I1: the maintenance repair runs the full publish for a stale stamp, and a second pass selects no user', async () => {
  const { db, dispose } = await transitAccount()
  try {
    await oldRouteEditAndRepair(db)
    // The stale published row also hides the new destination, as an old edit that kept the decision would.
    await db
      .prepare(
        "UPDATE country_evidence_suppressions SET country_code = 'GB' WHERE user_id = ? AND flight_id = 1",
      )
      .bind(user.id)
      .run()
    const before = (await stamp(db))!
    await maintenance.scheduled({} as ScheduledEvent, { DB: db })
    const published = (await stamp(db))!
    expect(published).toMatchObject({
      revision: before.revision,
      published_revision: before.revision,
      evidence_revision: before.revision,
    })
    expect(published.published_at).not.toBe(before.published_at) // a full publish, not an early ready
    expect(await suppressions(db)).toEqual([]) // rewritten as the full computed set
    expect(await countries(db)).toEqual(['GB', 'GE', 'TR', 'US'])
    expect(
      await db.prepare('SELECT last_error FROM maintenance_status WHERE id = 1').first(),
    ).toEqual({ last_error: null })
    const success = (await db
      .prepare('SELECT last_success_at FROM maintenance_status WHERE id = 1')
      .first<{ last_success_at: string }>())!.last_success_at
    expect(success).toBeTruthy()

    await maintenance.scheduled({} as ScheduledEvent, { DB: db })
    expect((await stamp(db))!.published_at).toBe(published.published_at) // not selected, not republished
    expect(
      await db.prepare('SELECT last_error FROM maintenance_status WHERE id = 1').first(),
    ).toEqual({ last_error: null })
    expect(
      (await db
        .prepare('SELECT last_success_at FROM maintenance_status WHERE id = 1')
        .first<{ last_success_at: string }>())!.last_success_at >= success,
    ).toBe(true)
  } finally {
    await dispose()
  }
})
