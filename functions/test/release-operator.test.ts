import { afterEach, beforeEach, expect, it } from 'vitest'
import operator from '../../workers/release-operator/index'
import { dirtyUserStatement, repairUserDerivedState } from '../api/_services/derivedState'
import { createApiDatabase } from './harness'

const TOKEN = 'synthetic-private-operator-token'
const request = (path: string, method = 'GET', token = TOKEN) => new Request(`https://operator.test${path}`, {
  method, headers: { Authorization: `Bearer ${token}` },
})

it('rejects absent, malformed and wrong tokens before accessing D1, and fails closed without a configured secret', async () => {
  const inaccessible = new Proxy({} as D1Database, { get() { throw new Error('D1 accessed before auth') } })
  for (const authorization of [null, '', 'Bearer ', 'Basic ' + TOKEN, 'bearer ' + TOKEN, 'Bearer wrong', 'Bearer ' + TOKEN + 'x']) {
    const headers: Record<string, string> = authorization === null ? {} : { Authorization: authorization }
    const response = await operator.fetch(new Request('https://operator.test/repair', { method: 'POST', headers }),
      { DB: inaccessible, OPERATOR_TOKEN: TOKEN })
    expect(response.status).toBe(401)
  }
  for (const token of ['', undefined]) {
    expect((await operator.fetch(request('/status'), { DB: inaccessible, OPERATOR_TOKEN: token as string })).status).toBe(401)
  }
  expect((await operator.fetch(request('/unknown'), { DB: inaccessible, OPERATOR_TOKEN: TOKEN })).status).toBe(404)
  expect((await operator.fetch(request('/repair', 'GET'), { DB: inaccessible, OPERATOR_TOKEN: TOKEN })).status).toBe(404)
})

let db: D1Database
let dispose: () => Promise<void>
beforeEach(async () => {
  const fixture = await createApiDatabase()
  db = fixture.db
  dispose = fixture.dispose
  await db.batch(['AAA', 'BBB'].map(iata => db.prepare(
    'INSERT INTO airports_reference (iata,name,city,country,country_code) VALUES (?,?,?,?,?)',
  ).bind(iata, iata, iata, 'Synthetic', 'GE')))
})
afterEach(async () => { await dispose() })

async function seed(id: string, flights = 0, visible = 1) {
  await db.batch([
    db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(id, `${id}@synthetic.test`, 'synthetic'),
    db.prepare('INSERT INTO profiles (id,show_on_leaderboards) VALUES (?,?)').bind(id, visible),
    ...Array.from({ length: flights }, () => db.prepare(
      "INSERT INTO flights (user_id,date,origin,destination,distance_km,duration_minutes,is_upcoming) VALUES (?,'2025-01-01','AAA','BBB',100,60,0)",
    ).bind(id)),
    dirtyUserStatement(db, id),
  ])
}
const call = async (path: string, method = 'GET') => {
  const response = await operator.fetch(request(path, method), { DB: db, OPERATOR_TOKEN: TOKEN })
  expect(response.status).toBe(200)
  return response.json()
}

it('drains three dirty users and reports only counts, with repeat repairs leaving canonical rows unchanged', async () => {
  for (const id of ['one', 'two', 'three']) await seed(id, 1)
  // Evidence alone can be stale even when the stats revision was published.
  await db.prepare("UPDATE user_derived_state SET published_revision = revision WHERE user_id = 'two'").run()
  const before = (await db.prepare('SELECT * FROM flights').all()).results
  expect(await call('/status')).toEqual({ users: 3, flights: 3, dirty: 3, metricsNull: 3 })
  expect(await call('/repair', 'POST')).toEqual({ repaired: 3, failed: 0, remaining: 0 })
  expect(await call('/status')).toEqual({ users: 3, flights: 3, dirty: 0, metricsNull: 3 })
  expect(await call('/repair', 'POST')).toEqual({ repaired: 0, failed: 0, remaining: 0 })
  expect((await db.prepare('SELECT * FROM flights').all()).results).toEqual(before)
})

it('counts a failed publication and continues other users, then retries the remaining dirty user', async () => {
  for (const id of ['one', 'two', 'three']) await seed(id, 1)
  await db.prepare("CREATE TRIGGER fail_one BEFORE INSERT ON user_stats WHEN NEW.user_id = 'one' BEGIN SELECT RAISE(FAIL,'private failure'); END").run()
  expect(await call('/repair', 'POST')).toEqual({ repaired: 2, failed: 1, remaining: 1 })
  await db.prepare('DROP TRIGGER fail_one').run()
  expect(await call('/repair', 'POST')).toEqual({ repaired: 1, failed: 0, remaining: 0 })
})

it('repairs at most 50 stale users oldest-first, leaving the newest for the next call', async () => {
  for (let i = 0; i < 51; i++) {
    const id = `user-${i}`
    await seed(id)
    await db.prepare('UPDATE user_derived_state SET updated_at=? WHERE user_id=?')
      .bind(new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString(), id).run()
  }
  expect(await call('/repair', 'POST')).toEqual({ repaired: 50, failed: 0, remaining: 1 })
  expect((await db.prepare('SELECT user_id FROM user_derived_state WHERE revision != published_revision').all()).results)
    .toEqual([{ user_id: 'user-50' }])
  expect(await call('/repair', 'POST')).toEqual({ repaired: 1, failed: 0, remaining: 0 })
}, 120_000)

it('refreshes all five categories for every eligible ready user and is safe to repeat', async () => {
  for (const id of ['eligible-one', 'eligible-two', 'private', 'dirty']) await seed(id, 5, id === 'private' ? 0 : 1)
  await seed('too-few', 4)
  for (const id of ['eligible-one', 'eligible-two', 'private', 'too-few']) {
    expect(await repairUserDerivedState(db, id)).toMatchObject({ derived_state: 'ready' })
  }
  expect(await call('/refresh-leaderboards', 'POST')).toEqual({ rows: 10 })
  expect((await db.prepare('SELECT user_id,COUNT(*) AS n FROM leaderboard_cache GROUP BY user_id ORDER BY user_id').all()).results)
    .toEqual([{ user_id: 'eligible-one', n: 5 }, { user_id: 'eligible-two', n: 5 }])
  expect((await db.prepare('SELECT DISTINCT category FROM leaderboard_cache ORDER BY category').all()).results)
    .toEqual(['airlines', 'cities', 'countries', 'distance', 'flights'].map(category => ({ category })))
  expect(await call('/refresh-leaderboards', 'POST')).toEqual({ rows: 10 })
})
