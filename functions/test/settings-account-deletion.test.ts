import { expect, it } from 'vitest'
import { deleteAccountRequest } from '../api/auth/account'
import { createUserWithProfile } from '../api/_lib/users'
import { createSession, resolveSession } from '../api/_lib/session'
import { createApiDatabase, csrfRequest, count } from './harness'

it('the settings deletion boundary refuses CSRF and wrong passwords, then revokes every owner session and preserves another account', async () => {
  const { db, dispose } = await createApiDatabase()
  const secret = 'settings-delete-test-secret'
  try {
    const owner = await createUserWithProfile(
      db,
      { email: 'owner@example.test', password: 'current-password' },
      secret,
    )
    const other = await createUserWithProfile(
      db,
      { email: 'other@example.test', password: 'other-password' },
      secret,
    )
    const first = await createSession(db, owner.id),
      second = await createSession(db, owner.id),
      kept = await createSession(db, other.id)
    for (const [id, userId] of [
      ['better-first', owner.id],
      ['better-second', owner.id],
      ['better-kept', other.id],
    ]) {
      await db
        .prepare(
          'INSERT INTO auth_sessions (id,expiresAt,token,createdAt,updatedAt,userId) VALUES (?,?,?,?,?,?)',
        )
        .bind(
          id,
          '2099-01-01T00:00:00.000Z',
          id,
          '2026-10-05T00:00:00.000Z',
          '2026-10-05T00:00:00.000Z',
          userId,
        )
        .run()
    }
    const env = { DB: db, AUTH_SECRET: secret } as Env
    const data = { user: owner }
    const denied = await deleteAccountRequest(
      new Request('https://kuuki.test/api/auth/account', {
        method: 'DELETE',
        headers: { Origin: 'https://kuuki.test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'current-password' }),
      }),
      env,
      data,
    )
    expect(denied.status).toBe(403)
    expect(await count(db, 'users')).toBe(2)
    const wrong = await deleteAccountRequest(
      csrfRequest('/api/auth/account', 'DELETE', { password: 'wrong-password' }),
      env,
      data,
    )
    expect(wrong.status).toBe(401)
    expect(await wrong.json()).toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(await resolveSession(db, first.token)).not.toBeNull()
    expect(await resolveSession(db, second.token)).not.toBeNull()
    const deleted = await deleteAccountRequest(
      csrfRequest('/api/auth/account', 'DELETE', { password: 'current-password' }),
      env,
      data,
    )
    expect(deleted.status).toBe(200)
    expect(deleted.headers.get('Set-Cookie')).toContain('Max-Age=0')
    expect(await resolveSession(db, first.token)).toBeNull()
    expect(await resolveSession(db, second.token)).toBeNull()
    expect((await resolveSession(db, kept.token))?.user.id).toBe(other.id)
    expect(await count(db, 'users')).toBe(1)
    expect(await db.prepare('SELECT id FROM auth_sessions ORDER BY id').all()).toMatchObject({
      results: [{ id: 'better-kept' }],
    })
  } finally {
    await dispose()
  }
})
