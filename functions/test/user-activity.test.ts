import { afterEach, expect, it, vi } from 'vitest'
import { onRequestPost } from '../api/me/activity'
import { readUserAnalytics } from '../api/_services/userAnalytics'
import { deleteUserCascade } from '../api/_lib/users'
import * as time from '../api/_lib/time'
import { apiContext, createApiDatabase, csrfRequest } from './harness'

afterEach(() => vi.restoreAllMocks())

it('requires a signed-in session and CSRF before writing a visit', async () => {
  const db = {
    batch() {
      throw new Error('Unauthorized write')
    },
    prepare() {
      throw new Error('Unauthorized write')
    },
  } as unknown as D1Database
  const guest = await onRequestPost(
    apiContext(db, csrfRequest('/api/me/activity', 'POST')) as never,
  )
  expect(guest.status).toBe(401)
  const member = await onRequestPost({
    ...apiContext(db, new Request('https://kuuki.test/api/me/activity', { method: 'POST' })),
    data: { user: { id: 'member', email: 'member@example.test' } },
  } as never)
  expect(member.status).toBe(403)
})

it('records one server-dated visit per account/day and counts distinct active accounts across UTC windows', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch(
      ['owner', 'member', 'old', 'weekly', 'monthly', 'future'].map((id) =>
        db
          .prepare('INSERT INTO users(id,email,password_hash) VALUES(?,?,?)')
          .bind(id, `${id}@example.test`, 'hash'),
      ),
    )
    const clock = vi.spyOn(time, 'nowIso')
    const record = async (id: string, at: string) => {
      clock.mockReturnValue(at)
      return onRequestPost({
        ...apiContext(
          db,
          csrfRequest('/api/me/activity', 'POST', { user_id: 'forged', day: '1900-01-01' }),
        ),
        data: { user: { id, email: `${id}@example.test` } },
      } as never)
    }
    expect((await record('old', '2026-09-28T12:00:00Z')).status).toBe(200)
    await record('owner', '2026-09-29T00:00:00Z')
    await record('owner', '2026-10-22T00:00:00Z')
    await record('owner', '2026-10-28T00:00:00Z')
    const repeat = await record('owner', '2026-10-28T08:00:00Z')
    expect(await repeat.json()).toEqual({ day: '2026-10-28' })
    await record('member', '2026-10-28T09:00:00Z')
    await record('weekly', '2026-10-22T00:00:00Z')
    await record('monthly', '2026-09-29T00:00:00Z')
    await record('monthly', '2026-10-21T23:59:59.999Z')
    await record('future', '2026-10-28T12:00:00.001Z')
    await record('old', '2026-10-29T00:00:00Z')
    expect(await db.prepare('SELECT COUNT(*) AS n FROM user_activity_days').first()).toEqual({
      n: 10,
    })
    const env = { DB: db, ADMIN_USER_ID: 'owner' }
    const now = new Date('2026-10-28T12:00:00Z')
    expect((await readUserAnalytics(env, 'owner', 30, now)).activity).toEqual({
      since: '2026-09-28T12:00:00Z',
      daily: 2,
      weekly: 3,
      monthly: 4,
    })
    await deleteUserCascade(db, 'member')
    expect(
      await db
        .prepare("SELECT COUNT(*) AS n FROM user_activity_days WHERE user_id='member'")
        .first(),
    ).toEqual({ n: 0 })
    expect((await readUserAnalytics(env, 'owner', 7, now)).activity).toEqual({
      since: '2026-09-28T12:00:00Z',
      daily: 1,
      weekly: 2,
      monthly: 3,
    })
    expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
  } finally {
    await dispose()
  }
})
