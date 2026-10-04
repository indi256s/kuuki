import { expect, it } from 'vitest'
import { apiContext, createApiDatabase, csrfRequest } from './harness'
import { onRequestPost as checkCandidates } from '../api/flights/duplicate-candidates'

const user = { id: 'candidate-owner', email: 'candidate@example.test' }

function post(db: D1Database, candidates: unknown) {
  const request = csrfRequest('/api/flights/duplicate-candidates', 'POST', { candidates })
  return checkCandidates({ ...apiContext(db, request), data: { user } } as never)
}

it('checks the entire owned history with per-candidate edit exclusion', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch([
      db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(user.id, user.email, 'hash'),
      db.prepare("INSERT INTO users (id,email,password_hash) VALUES ('other','other@example.test','hash')"),
    ])
    await db.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 1200)
      INSERT INTO flights (user_id,date,origin,destination)
      SELECT ?, date('2020-01-01', '+' || x || ' days'), 'AAA', 'BBB' FROM n`).bind(user.id).run()
    await db.batch([
      db.prepare('INSERT INTO flights (user_id,date,origin,destination) VALUES (?,?,?,?)').bind(user.id, '2025-06-01', 'CCC', 'DDD'),
      db.prepare('INSERT INTO flights (user_id,date,origin,destination) VALUES (?,?,?,?)').bind(user.id, '2025-06-01', 'CCC', 'DDD'),
      db.prepare('INSERT INTO flights (user_id,date,origin,destination) VALUES (?,?,?,?)').bind('other', '2026-01-01', 'EEE', 'FFF'),
    ])
    const matches = await post(db, [
      { date: '2023-04-15', origin: 'AAA', destination: 'BBB' },
      { date: '2025-06-01', origin: 'CCC', destination: 'DDD', excludeId: 1201 },
      { date: '2025-06-01', origin: 'CCC', destination: 'DDD', excludeId: 1202 },
      { date: '2026-01-01', origin: 'EEE', destination: 'FFF' },
    ])
    expect(matches.status).toBe(200)
    expect(await matches.json()).toEqual({ matches: [
      { candidateIndex: 0, flightId: 1200 },
      { candidateIndex: 1, flightId: 1202 },
      { candidateIndex: 2, flightId: 1201 },
    ] })
  } finally { await dispose() }
})

it('rejects malformed candidates and an oversized batch', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    for (const candidates of [[{ date: '2025-02-30', origin: 'AAA', destination: 'BBB' }],
      [{ date: '2025-01-01', origin: 'AAA', destination: 'BBB', excludeId: -1 }],
      Array.from({ length: 101 }, () => ({ date: '2025-01-01', origin: 'AAA', destination: 'BBB' }))]) {
      expect((await post(db, candidates)).status).toBe(400)
    }
  } finally { await dispose() }
})
