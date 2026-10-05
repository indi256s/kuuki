// T09 / ADR 0001 §4 and §5: the transit cleanup read changes nothing; apply and dismiss use receipts, a marker and the
// same concurrency rules as confirmation.
import { describe, expect, it } from 'vitest'
import { apiContext, count } from './harness'
import { hasSql, instrumentDb } from './db-hooks'
import { addUser, getTransitReview, operationId, postTransitReview, queueAccount, reviewTokens, USER } from './queue-fixture'
import { at, flightStatement, T0, type FixtureFlight } from './country-fixture'
import { onRequestPost as transitPost } from '../api/me/transit-review'
import { stateOf } from '../api/_services/derivedState'

/** Two historical logged flights joined at Istanbul (a precise third-country connection) plus an unrelated one. */
const HISTORY: FixtureFlight[] = [
  { id: 1, date: '2026-03-01', origin: 'TBS', destination: 'IST', state: 'logged', source: 'legacy', dep: at(T0, -4), arr: T0 },
  { id: 2, date: '2026-03-02', origin: 'IST', destination: 'JFK', state: 'logged', source: 'save', dep: at(T0, 3), arr: at(T0, 12) },
  { id: 3, date: '2026-03-10', origin: 'LHR', destination: 'DXB', state: 'logged', source: 'legacy' },
]

const row = (db: D1Database, id: number) => db.prepare(
  'SELECT lifecycle_state AS s, confirmation_source AS src, confirmed_at AS at, arrival_transit AS t, arrival_transit_leg_id AS leg FROM flights WHERE id = ?').bind(id).first<any>()
const marker = (db: D1Database) => db.prepare('SELECT status FROM transit_cleanup_markers WHERE user_id = ?').bind(USER.id).first<any>()
const receipts = (db: D1Database) => db.prepare(
  "SELECT operation_id, kind, complete, expected_count, applied_count, json_extract(result_json, '$.derivedState') IS NOT NULL AS frozen FROM lifecycle_operation_receipts ORDER BY created_at, operation_id")
  .all().then(result => result.results as any[])
const pressed = (db: D1Database) => db.prepare("SELECT country_code FROM country_visit_evidence WHERE user_id = ? AND status = 'pressed' ORDER BY country_code")
  .bind(USER.id).all().then(result => result.results.map((entry: any) => entry.country_code))
const apply = (db: D1Database, ids: Array<[number, string]>, op = operationId('apply')) =>
  postTransitReview(db, { operationId: op, action: 'apply', items: ids.map(([flightId, candidateToken]) => ({ flightId, candidateToken })) })

describe('GET /api/me/transit-review', () => {
  it('lists historical candidates with the matched leg and the stamps applying them would remove', async () => {
    const { db, dispose } = await queueAccount(HISTORY)
    try {
      const { status, body } = await getTransitReview(db)
      expect(status).toBe(200)
      expect(body.candidates).toHaveLength(1)
      const [entry] = body.candidates
      expect(entry.flight).toMatchObject({ id: 1, lifecycle_state: 'logged', confirmation_source: 'legacy', arrival_transit: null })
      expect(entry.candidate).toMatchObject({ kind: 'link', label: 'precise', legId: 2, hubCountry: 'TR', thirdCountry: true })
      expect(entry.candidate.leg).toMatchObject({ id: 2, origin: 'IST', destination: 'JFK' })
      expect(entry.candidateToken).toMatch(/^[0-9a-f]{64}$/)
      expect(entry.affectedCountries).toEqual(['TR'])
      expect(body.wouldRemoveStamp).toEqual({ TR: true })
      expect(body).toMatchObject({ marker: null, derivedState: 'ready' })
      expect(await pressed(db)).toEqual(['AE', 'GB', 'GE', 'TR', 'US']) // history keeps the hub until the member says otherwise
    } finally { await dispose() }
  })

  it('does not offer flights the member confirmed, flights with a decision, ambiguous links or awaiting flights', async () => {
    const flights: FixtureFlight[] = [
      { id: 10, date: '2026-05-01', origin: 'TBS', destination: 'IST', state: 'logged', source: 'user', dep: at(T0, -4), arr: T0 },
      { id: 11, date: '2026-05-02', origin: 'IST', destination: 'JFK', state: 'logged', source: 'save', dep: at(T0, 3), arr: at(T0, 12) },
      { id: 20, date: '2026-06-01', origin: 'LHR', destination: 'ADB', state: 'logged', source: 'legacy', transit: 0, dep: at(T0, -4), arr: T0 },
      { id: 21, date: '2026-06-02', origin: 'ADB', destination: 'DXB', state: 'logged', source: 'save', dep: at(T0, 3), arr: at(T0, 12) },
      { id: 30, date: '2026-07-01', origin: 'KUT', destination: 'IST', state: 'logged', source: 'legacy', dep: at(T0, -4), arr: T0 },
      { id: 31, date: '2026-07-02', origin: 'IST', destination: 'JFK', state: 'logged', source: 'save', dep: at(T0, 3), arr: at(T0, 12) },
      { id: 32, date: '2026-07-02', origin: 'IST', destination: 'LHR', state: 'logged', source: 'save', dep: at(T0, 4), arr: at(T0, 12) },
      { id: 40, date: '2026-08-01', origin: 'BKK', destination: 'IST', state: 'awaiting', dep: at(T0, -4), arr: T0 },
      { id: 41, date: '2026-08-02', origin: 'IST', destination: 'JFK', state: 'logged', source: 'save', dep: at(T0, 3), arr: at(T0, 12) },
    ]
    const { db, dispose } = await queueAccount(flights)
    try {
      expect((await getTransitReview(db)).body.candidates).toEqual([])
    } finally { await dispose() }
  })

  it('says a stamp stays when another flight, a claim, a ground visit or archived evidence still supports the country', async () => {
    const { db, dispose } = await queueAccount(HISTORY, d => [d.prepare("INSERT INTO country_claims (id,user_id,country_code) VALUES ('c',?,'TR')").bind(USER.id)])
    try {
      expect((await getTransitReview(db)).body.wouldRemoveStamp).toEqual({ TR: false })
    } finally { await dispose() }
  })

  it('is read-only: no row, revision or write statement changes, and a foreign member sees only their own', async () => {
    const { db: raw, dispose } = await queueAccount(HISTORY)
    try {
      await addUser(raw, 'u2')
      await raw.batch([flightStatement(raw, { id: 90, user: 'u2', date: '2026-03-01', origin: 'TBS', destination: 'IST', state: 'logged', source: 'legacy', dep: at(T0, -4), arr: T0 }),
        flightStatement(raw, { id: 91, user: 'u2', date: '2026-03-02', origin: 'IST', destination: 'JFK', state: 'logged', source: 'legacy', dep: at(T0, 3), arr: at(T0, 12) })])
      const tables = ['flights', 'user_derived_state', 'lifecycle_operation_receipts', 'transit_cleanup_markers', 'country_visit_evidence', 'country_evidence_suppressions']
      const snapshot = async () => [...await Promise.all(tables.map(table => count(raw, table))), JSON.stringify(await stateOf(raw, USER.id)),
        JSON.stringify((await raw.prepare('SELECT * FROM flights ORDER BY id').all()).results)]
      const before = await snapshot()
      const { db, hooks } = instrumentDb(raw)
      const mine = await getTransitReview(db)
      await getTransitReview(db)
      expect(await snapshot()).toEqual(before)
      expect(hooks.sql.filter(sql => !/^\s*SELECT/i.test(sql))).toEqual([])
      expect(mine.body.candidates.map((entry: any) => entry.flight.id)).toEqual([1])
      const theirs = await getTransitReview(raw, { id: 'u2', email: 'u2@example.test' })
      expect(theirs.body.candidates.map((entry: any) => entry.flight.id)).toEqual([90])
      expect((await getTransitReview(raw, null)).status).toBe(401)
    } finally { await dispose() }
  })
})

describe('POST /api/me/transit-review apply', () => {
  it('stores the arrival decision only, removes the hub stamp, records the marker and a receipt', async () => {
    const { db, dispose } = await queueAccount(HISTORY)
    try {
      const t = await reviewTokens(db)
      const before = await row(db, 1)
      const op = operationId('apply')
      const { status, body } = await apply(db, [[1, t[1]]], op)
      expect(status).toBe(200)
      expect(body).toMatchObject({ action: 'apply', derivedState: 'ready', removedCountries: ['TR'], pendingCountryCount: 0,
        results: [{ flightId: 1, arrivalTransit: true, arrivalTransitLegId: 2 }] })
      expect(await row(db, 1)).toEqual({ ...before, t: 1, leg: 2 }) // state, provenance and confirmed_at untouched
      expect(await row(db, 2)).toMatchObject({ t: null })
      expect(await pressed(db)).toEqual(['AE', 'GB', 'GE', 'US'])
      expect(await marker(db)).toEqual({ status: 'completed' })
      expect(await receipts(db)).toEqual([{ operation_id: op, kind: 'transit_review', complete: 1, expected_count: 1, applied_count: 1, frozen: 1 }])
      const after = await getTransitReview(db)
      expect(after.body.candidates).toEqual([])
      expect(after.body.marker).toMatchObject({ status: 'completed' })
    } finally { await dispose() }
  })

  it('does not report a country another source still supports as removed', async () => {
    const { db, dispose } = await queueAccount(HISTORY, d => [d.prepare("INSERT INTO country_claims (id,user_id,country_code) VALUES ('c',?,'TR')").bind(USER.id)])
    try {
      const t = await reviewTokens(db)
      expect((await apply(db, [[1, t[1]]])).body).toMatchObject({ derivedState: 'ready', removedCountries: [] })
      expect(await pressed(db)).toContain('TR')
    } finally { await dispose() }
  })

  it('replays the exact operation with the recorded result and no new write; a different request conflicts', async () => {
    const { db, dispose } = await queueAccount(HISTORY)
    try {
      const t = await reviewTokens(db)
      const op = operationId('apply')
      const first = await apply(db, [[1, t[1]]], op)
      const state = await stateOf(db, USER.id)
      const replay = await apply(db, [[1, 'stale-token-is-ignored-on-replay']], op)
      expect(replay).toEqual(first)
      expect(await stateOf(db, USER.id)).toEqual(state)
      expect(await count(db, 'lifecycle_operation_receipts')).toBe(1)
      const other = await apply(db, [[2, t[1]]], op)
      expect(other.status).toBe(409)
      expect(other.body).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', cause: 'operation_reused' })
      const dismissed = await postTransitReview(db, { operationId: op, action: 'dismiss' })
      expect(dismissed.body.code).toBe('IDEMPOTENCY_CONFLICT') // the action is part of the digest
      // A confirm receipt with the same operation id is a different kind of operation.
    } finally { await dispose() }
  })

  it('is all or nothing with a cause per flight, and treats a foreign flight like a missing one', async () => {
    const { db, dispose } = await queueAccount([...HISTORY, { id: 4, date: '2026-04-01', origin: 'BKK', destination: 'DXB', state: 'logged', source: 'user' }])
    try {
      await addUser(db, 'u2')
      await db.batch([flightStatement(db, { id: 90, user: 'u2', date: '2026-03-01', origin: 'TBS', destination: 'IST', state: 'logged', source: 'legacy' })])
      const t = await reviewTokens(db)
      const mixed = await apply(db, [[1, t[1]], [4, 'x'.repeat(64)], [3, 'y'.repeat(64)]])
      expect(mixed.status).toBe(409)
      expect(mixed.body).toMatchObject({ code: 'STATE_CONFLICT', cause: 'not_reviewable', items: [{ flightId: 4, cause: 'confirmed_by_member' }] })
      expect(await row(db, 1)).toMatchObject({ t: null })
      const foreign = await apply(db, [[1, t[1]], [90, t[1]]])
      const missing = await apply(db, [[1, t[1]], [9999, t[1]]])
      expect(foreign.status).toBe(404)
      expect(foreign).toEqual(missing)
      expect(foreign.body).toEqual({ error: 'Flight not found', code: 'NOT_FOUND' })
      expect(await row(db, 90)).toMatchObject({ t: null })
      // Flight 3 is logged and legacy but has no connection: the token cannot match.
      const changed = await apply(db, [[1, t[1]], [3, 'z'.repeat(64)]])
      expect(changed.status).toBe(409)
      expect(changed.body).toMatchObject({ code: 'CANDIDATES_CHANGED', items: [{ flightId: 3, cause: 'candidates_changed' }] })
      expect(await count(db, 'lifecycle_operation_receipts')).toBe(0)
      expect(await marker(db)).toBeNull()
    } finally { await dispose() }
  })

  it('rejects a stale token after the connection changed', async () => {
    const { db, dispose } = await queueAccount(HISTORY)
    try {
      const t = await reviewTokens(db)
      await db.prepare("UPDATE flights SET date = '2026-03-03' WHERE id = 2").run() // the leg moved
      const { status, body } = await apply(db, [[1, t[1]]])
      expect(status).toBe(409)
      expect(body.code).toBe('CANDIDATES_CHANGED')
      expect(await row(db, 1)).toMatchObject({ t: null })
    } finally { await dispose() }
  })

  it('rolls back whole when another operation takes the flight first, and when the matched leg changes under the decision', async () => {
    const { db: raw, dispose } = await queueAccount([...HISTORY, { id: 4, date: '2026-03-20', origin: 'TBS', destination: 'IST', state: 'logged', source: 'legacy', dep: at(T0, 480), arr: at(T0, 484) },
      { id: 5, date: '2026-03-21', origin: 'IST', destination: 'LHR', state: 'logged', source: 'save', dep: at(T0, 490), arr: at(T0, 495) }])
    try {
      const t = await reviewTokens(raw)
      const { db, hooks } = instrumentDb(raw)
      let winner: any
      hooks.beforeBatch(hasSql('INSERT INTO lifecycle_operation_receipts'), async () => { winner = await apply(raw, [[1, t[1]]], operationId('winner')) })
      const loser = await apply(db, [[1, t[1]], [4, t[4]]], operationId('loser'))
      expect(winner.status).toBe(200)
      expect(loser.status).toBe(409)
      expect(loser.body).toMatchObject({ code: 'STATE_CONFLICT', cause: 'not_reviewable', items: [{ flightId: 1, cause: 'already_decided' }] })
      expect(await row(raw, 4)).toMatchObject({ t: null }) // all or nothing
      expect(await receipts(raw)).toHaveLength(1)

      // Flight 5 is deleted between the loser's read and its batch: the decision about flight 4 is no longer valid.
      const next = instrumentDb(raw)
      next.hooks.beforeBatch(hasSql('INSERT INTO lifecycle_operation_receipts'), async () => {
        await raw.batch([raw.prepare('DELETE FROM flights WHERE id = 5'), raw.prepare('UPDATE user_derived_state SET revision = revision + 1 WHERE user_id = ?').bind(USER.id)])
      })
      const stale = await apply(next.db, [[4, t[4]]], operationId('stale'))
      expect(stale.status).toBe(409)
      expect(stale.body.code).toBe('CANDIDATES_CHANGED')
      expect(await row(raw, 4)).toMatchObject({ t: null })
      expect(await receipts(raw)).toHaveLength(1)
    } finally { await dispose() }
  })

  it('concurrent identical applies commit once and every caller gets the same result', async () => {
    const { db, dispose } = await queueAccount(HISTORY)
    try {
      const t = await reviewTokens(db)
      const op = operationId('apply')
      const replies = await Promise.all([1, 2, 3].map(() => apply(db, [[1, t[1]]], op)))
      for (const reply of replies) expect(reply).toEqual(replies[0])
      expect(replies[0].body).toMatchObject({ derivedState: 'ready', removedCountries: ['TR'] })
      expect(await count(db, 'lifecycle_operation_receipts')).toBe(1)
    } finally { await dispose() }
  }, 30_000)

  it('committed-but-pending: the failed repair is reported, a replay finishes it once', async () => {
    const { db: raw, dispose } = await queueAccount(HISTORY)
    try {
      const t = await reviewTokens(raw)
      const { db, hooks } = instrumentDb(raw)
      hooks.failBatch(hasSql('INSERT INTO country_visit_evidence'))
      const op = operationId('apply')
      const pending = await apply(db, [[1, t[1]]], op)
      expect(pending.status).toBe(200)
      expect(pending.body).toMatchObject({ derivedState: 'pending', removedCountries: null, pendingCountryCount: null })
      expect(await row(raw, 1)).toMatchObject({ t: 1, leg: 2 })
      expect(await receipts(raw)).toMatchObject([{ complete: 1, frozen: 0 }])
      const revision = (await stateOf(raw, USER.id))!.revision
      const done = await apply(raw, [[1, t[1]]], op)
      expect(done.body).toMatchObject({ derivedState: 'ready', removedCountries: ['TR'] })
      expect((await stateOf(raw, USER.id))!.revision).toBe(revision)
      expect(await receipts(raw)).toMatchObject([{ frozen: 1 }])
    } finally { await dispose() }
  })
})

describe('POST /api/me/transit-review dismiss', () => {
  it('records the marker only: no flight, derived state or evidence changes', async () => {
    const { db, dispose } = await queueAccount(HISTORY)
    try {
      const state = await stateOf(db, USER.id)
      const flights = JSON.stringify((await db.prepare('SELECT * FROM flights ORDER BY id').all()).results)
      const op = operationId('dismiss')
      const { status, body } = await postTransitReview(db, { operationId: op, action: 'dismiss' })
      expect(status).toBe(200)
      expect(body).toMatchObject({ action: 'dismiss', results: [], removedCountries: [] })
      expect(await marker(db)).toEqual({ status: 'dismissed' })
      expect(await stateOf(db, USER.id)).toEqual(state)
      expect(JSON.stringify((await db.prepare('SELECT * FROM flights ORDER BY id').all()).results)).toBe(flights)
      expect(await receipts(db)).toEqual([{ operation_id: op, kind: 'transit_review', complete: 1, expected_count: 0, applied_count: 0, frozen: 1 }])
      expect(await postTransitReview(db, { operationId: op, action: 'dismiss' })).toEqual({ status: 200, body })
      const read = await getTransitReview(db)
      expect(read.body.marker).toEqual({ status: 'dismissed', matchesCandidates: true })
      expect(read.body.candidates).toHaveLength(1) // dismissing hides the banner, it does not remove the option
    } finally { await dispose() }
  })

  it('applying after a dismissal still works and replaces the marker', async () => {
    const { db, dispose } = await queueAccount(HISTORY)
    try {
      await postTransitReview(db, { operationId: operationId('dismiss'), action: 'dismiss' })
      const t = await reviewTokens(db)
      expect((await apply(db, [[1, t[1]]])).status).toBe(200)
      expect(await marker(db)).toEqual({ status: 'completed' })
    } finally { await dispose() }
  })
})

describe('POST /api/me/transit-review request rules', () => {
  it('validates the shape, requires an owner and CSRF', async () => {
    const { db, dispose } = await queueAccount(HISTORY)
    try {
      const t = await reviewTokens(db)
      const bad = (body: unknown) => postTransitReview(db, body).then(result => [result.status, result.body.code])
      expect(await bad({ action: 'apply', items: [{ flightId: 1, candidateToken: t[1] }] })).toEqual([400, 'INVALID_REQUEST'])
      expect(await bad({ operationId: 'short', action: 'dismiss' })).toEqual([400, 'INVALID_REQUEST'])
      expect(await bad({ operationId: operationId(), action: 'remove' })).toEqual([400, 'INVALID_REQUEST'])
      expect(await bad({ operationId: operationId(), action: 'apply' })).toEqual([400, 'INVALID_REQUEST'])
      expect(await bad({ operationId: operationId(), action: 'apply', items: [] })).toEqual([400, 'INVALID_REQUEST'])
      expect(await bad({ operationId: operationId(), action: 'apply', items: [{ flightId: 1, candidateToken: t[1] }, { flightId: 1, candidateToken: t[1] }] })).toEqual([400, 'INVALID_REQUEST'])
      expect(await bad({ operationId: operationId(), action: 'dismiss', items: [{ flightId: 1, candidateToken: t[1] }] })).toEqual([400, 'INVALID_REQUEST'])
      expect((await postTransitReview(db, { operationId: operationId(), action: 'dismiss' }, null)).status).toBe(401)
      const noCsrf = await transitPost({ ...apiContext(db, new Request('https://kuuki.test/api/me/transit-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationId: operationId(), action: 'dismiss' }) })), data: { user: USER }, params: {} } as never)
      expect(noCsrf.status).toBe(403)
      expect(await count(db, 'lifecycle_operation_receipts')).toBe(0)
      expect(await marker(db)).toBeNull()
    } finally { await dispose() }
  })
})
