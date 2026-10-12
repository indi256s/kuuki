import { expect, it, vi, afterEach } from 'vitest'
import { createApiDatabase } from './harness'
import { createUserWithProfile } from '../api/_lib/users'
import * as users from '../api/_lib/users'
import { verifyPassword, sha256Hex } from '../api/_lib/crypto'
import { createSession } from '../api/_lib/session'
import { requestPasswordRecovery, completePasswordRecovery } from '../api/_lib/passwordRecovery'
import { requestPasswordReset } from '../api/auth/password-reset/request'
import { completePasswordReset } from '../api/auth/password-reset/complete'

const ORIGIN = 'https://kuuki.test'
const SECRET = 'synthetic-recovery-pepper'
const senderEnv = {
  ACTIVATION_MAIL_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  ACTIVATION_MAIL_AUTH_TOKEN: 'test-token',
  ACTIVATION_MAIL_FROM: 'sender@example.test',
}

afterEach(() => vi.restoreAllMocks())

function req(path: string, body: object, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}
function env(db: D1Database) {
  return {
    DB: db,
    AUTH_SECRET: SECRET,
    PAGES_ORIGIN: ORIGIN,
    ACTIVATION_ORIGIN: 'https://activate.kuuki.test',
    ...senderEnv,
  } as Env
}

it('uses a one-use fragment token, changes both credential hashes, and revokes both session families', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const user = await createUserWithProfile(
      db,
      { email: 'person@example.test', password: 'old-password' },
      SECRET,
    )
    await createSession(db, user.id)
    await db
      .prepare(
        `INSERT INTO auth_sessions(id, expiresAt,token,createdAt,updatedAt,userId) VALUES('sid','2999-01-01','auth-token','2026-01-01','2026-01-01',?)`,
      )
      .bind(user.id)
      .run()
    const links: string[] = []
    await requestPasswordRecovery(db, user.email, ORIGIN, {
      async send(_to, link) {
        links.push(link)
      },
    })
    expect(links).toHaveLength(1)
    const link = new URL(links[0])
    expect(link.pathname).toBe('/reset-password')
    expect(link.search).toBe('')
    const token = link.hash.slice('#token='.length)
    const tokenHash = await sha256Hex(token)
    const stored = await db
      .prepare('SELECT id,identifier,value FROM auth_verifications')
      .first<{ id: string; identifier: string; value: string }>()
    expect(stored).toEqual({
      id: `password-reset:${tokenHash}`,
      identifier: `password-reset:${user.id}`,
      value: tokenHash,
    })
    expect(
      await db.prepare('SELECT email_verified FROM users WHERE id = ?').bind(user.id).first(),
    ).toEqual({ email_verified: 0 })
    const results = await Promise.all([
      completePasswordRecovery(db, token, 'new-password-1', SECRET),
      completePasswordRecovery(db, token, 'new-password-2', SECRET),
    ])
    expect(results.sort()).toEqual([false, true])
    expect(await completePasswordRecovery(db, token, 'third-password', SECRET)).toBe(false)
    const recovered = (await db
      .prepare('SELECT id, email, password_hash, email_verified FROM users WHERE id = ?')
      .bind(user.id)
      .first<{ id: string; email: string; password_hash: string; email_verified: number }>())!
    expect(recovered).toMatchObject({ id: user.id, email: user.email, email_verified: 1 })
    const userHash = recovered.password_hash
    const authHash = (await db
      .prepare(`SELECT password FROM auth_accounts WHERE userId = ? AND providerId = 'credential'`)
      .bind(user.id)
      .first<{ password: string }>())!.password
    expect(authHash).toBe(userHash)
    expect(await verifyPassword('old-password', userHash, SECRET)).toBe(false)
    expect(
      (await verifyPassword('new-password-1', userHash, SECRET)) ||
        (await verifyPassword('new-password-2', userHash, SECRET)),
    ).toBe(true)
    expect(
      (
        await db
          .prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?')
          .bind(user.id)
          .first<{ n: number }>()
      )?.n,
    ).toBe(0)
    expect(
      (
        await db
          .prepare('SELECT COUNT(*) AS n FROM auth_sessions WHERE userId = ?')
          .bind(user.id)
          .first<{ n: number }>()
      )?.n,
    ).toBe(0)
    expect(
      (await db.prepare('SELECT COUNT(*) AS n FROM auth_verifications').first<{ n: number }>())?.n,
    ).toBe(0)
  } finally {
    await dispose()
  }
})

it('does not issue links to unknown or activation-only users and never changes expired credentials', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch([
      db.prepare(
        `INSERT INTO users(id,email,password_hash) VALUES('pending','pending@example.test','RESET_REQUIRED')`,
      ),
      db.prepare(`INSERT INTO profiles(id) VALUES('pending')`),
    ])
    const user = await createUserWithProfile(
      db,
      { email: 'active@example.test', password: 'old-password' },
      SECRET,
    )
    const links: string[] = []
    const sender = {
      async send(_to: string, link: string) {
        links.push(link)
      },
    }
    await requestPasswordRecovery(db, 'missing@example.test', ORIGIN, sender)
    await requestPasswordRecovery(db, 'pending@example.test', ORIGIN, sender)
    expect(links).toHaveLength(0)
    await requestPasswordRecovery(db, user.email, ORIGIN, sender)
    const token = new URL(links[0]).hash.slice('#token='.length)
    await db.prepare('UPDATE auth_verifications SET expiresAt = ?').bind('2000-01-01').run()
    expect(await completePasswordRecovery(db, token, 'new-password', SECRET)).toBe(false)
    const row = await db
      .prepare('SELECT password_hash, email_verified FROM users WHERE id = ?')
      .bind(user.id)
      .first<{ password_hash: string; email_verified: number }>()
    expect(row?.email_verified).toBe(0)
    expect(await verifyPassword('old-password', row!.password_hash, SECRET)).toBe(true)
    expect(
      (
        await db
          .prepare('SELECT password_hash FROM users WHERE id = ?')
          .bind('pending')
          .first<{ password_hash: string }>()
      )?.password_hash,
    ).toBe('RESET_REQUIRED')
  } finally {
    await dispose()
  }
})

it('returns identical public request responses and ignores caller supplied redirect', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await createUserWithProfile(
      db,
      { email: 'active@example.test', password: 'old-password' },
      SECRET,
    )
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          errors: [],
          result: { delivered: [], queued: ['active@example.test'], permanent_bounces: [] },
        }),
      ),
    )
    const backgrounds: Promise<unknown>[] = []
    for (const email of ['missing@example.test', 'active@example.test']) {
      const response = await requestPasswordReset(
        req('/api/auth/password-reset/request', { email, redirect: 'https://evil.test/' }),
        env(db),
        (task) => backgrounds.push(task),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ok: true })
    }
    await Promise.all(backgrounds)
    expect(send).toHaveBeenCalledOnce()
    const body = JSON.parse(String(send.mock.calls[0][1]?.body)) as {
      text: string
      subject: string
    }
    expect(body.subject).toBe('Reset your Kuuki password')
    expect(body.text).toContain(`${ORIGIN}/reset-password#token=`)
    expect(body.text).not.toContain('evil.test')
    const foreign = await requestPasswordReset(
      req(
        '/api/auth/password-reset/request',
        { email: 'active@example.test' },
        { Origin: 'https://evil.test' },
      ),
      env(db),
      () => {},
    )
    expect(foreign.status).toBe(403)
    const invalid = await completePasswordReset(
      req('/api/auth/password-reset/complete', { password: 'new-password' }),
      env(db),
    )
    expect(invalid.status).toBe(400)
  } finally {
    await dispose()
  }
})

it('answers known and unknown emails before the account-dependent lookup and send finish', async () => {
  const { db, dispose } = await createApiDatabase()
  let release!: () => void
  const backgrounds: Promise<unknown>[] = []
  try {
    await createUserWithProfile(
      db,
      { email: 'active@example.test', password: 'old-password' },
      SECRET,
    )
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const getUser = users.getUserByEmail
    vi.spyOn(users, 'getUserByEmail').mockImplementation(async (...args) => {
      await held
      return getUser(...args)
    })
    const send = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            errors: [],
            result: { delivered: [], queued: ['active@example.test'], permanent_bounces: [] },
          }),
        ),
    )
    for (const email of ['missing@example.test', 'active@example.test']) {
      let response: Response | undefined
      const pending = requestPasswordReset(
        req('/api/auth/password-reset/request', { email }),
        env(db),
        (task) => backgrounds.push(task),
      ).then((value) => {
        response = value
        return value
      })
      await vi.waitFor(() => expect(response?.status).toBe(200))
      expect(await (await pending).json()).toEqual({ ok: true })
    }
    expect(send).not.toHaveBeenCalled()
  } finally {
    release?.()
    await Promise.all(backgrounds)
    await dispose()
  }
})

it('cleans failed delivery and clears both cookie families after successful completion', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const user = await createUserWithProfile(
      db,
      { email: 'active@example.test', password: 'old-password' },
      SECRET,
    )
    await requestPasswordRecovery(db, user.email, ORIGIN, {
      async send() {
        throw new Error('private provider detail')
      },
    })
    expect(
      (await db.prepare('SELECT COUNT(*) AS n FROM auth_verifications').first<{ n: number }>())?.n,
    ).toBe(0)
    let link = ''
    await requestPasswordRecovery(db, user.email, ORIGIN, {
      async send(_to, value) {
        link = value
      },
    })
    const token = new URL(link).hash.slice('#token='.length)
    const response = await completePasswordReset(
      req(
        '/api/auth/password-reset/complete',
        { password: 'new-password' },
        { Authorization: `Bearer ${token}` },
      ),
      env(db),
    )
    expect(response.status).toBe(200)
    const cookies = response.headers.getSetCookie().join('; ')
    expect(cookies).toContain('kuuki_session=')
    expect(cookies).toContain('kuuki_csrf=')
    expect(cookies).toContain('__Secure-kuuki_auth_session=')
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  } finally {
    await dispose()
  }
})

it('enforces same-origin and rate limits with the same configuration result for known and unknown emails', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await createUserWithProfile(
      db,
      { email: 'active@example.test', password: 'old-password' },
      SECRET,
    )
    for (const email of ['active@example.test', 'missing@example.test']) {
      const response = await requestPasswordReset(
        req('/api/auth/password-reset/request', { email }),
        { ...env(db), ACTIVATION_MAIL_AUTH_TOKEN: '' },
        () => {},
      )
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({
        error: 'Password recovery is temporarily unavailable',
        code: 'RECOVERY_UNAVAILABLE',
      })
    }
    const background: Promise<unknown>[] = []
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await requestPasswordReset(
        req('/api/auth/password-reset/request', { email: 'missing@example.test' }),
        env(db),
        (task) => background.push(task),
      )
      expect(response.status).toBe(200)
    }
    const limited = await requestPasswordReset(
      req('/api/auth/password-reset/request', { email: 'missing@example.test' }),
      env(db),
      () => {},
    )
    expect(limited.status).toBe(429)
    await Promise.all(background)
  } finally {
    await dispose()
  }
})
