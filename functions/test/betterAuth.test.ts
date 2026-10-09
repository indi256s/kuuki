import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Miniflare } from 'miniflare'
import { unstable_splitSqlQuery } from 'wrangler'
import { afterEach, expect, it, vi } from 'vitest'
import { createApiDatabase, apiContext } from './harness'
import { onRequest as middleware } from '../_middleware'
import { onRequest as authRoute } from '../api/auth/[[path]]'
import { onRequestPost as continueRoute } from '../api/auth/continue'
import { onRequestGet as meRoute } from '../api/auth/me'
import { onRequestDelete as deleteRoute } from '../api/auth/account'
import { hashPassword } from '../api/_lib/crypto'
import { createSession } from '../api/_lib/session'
import { completeActivation, requestActivation } from '../api/_lib/activation'

const ORIGIN = 'https://kuuki.test'
const SECRET = 'synthetic-test-pepper'
const env = {
  AUTH_SECRET: SECRET,
  BETTER_AUTH_SECRET: 'synthetic-better-auth-test-secret-32-characters',
  PAGES_ORIGIN: ORIGIN,
}

async function call(
  db: D1Database,
  path: string,
  method = 'GET',
  body?: object,
  cookie = '',
  headers: Record<string, string> = {},
) {
  const csrf = /(?:^|; )kuuki_csrf=([^;]+)/.exec(cookie)?.[1]
  const request = new Request(`${ORIGIN}${path}`, {
    method,
    headers: {
      Origin: ORIGIN,
      Cookie: cookie,
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const context = { ...apiContext(db, request), env: { DB: db, ...env } }
  const handler =
    path === '/api/auth/me'
      ? meRoute
      : path === '/api/auth/account'
        ? deleteRoute
        : path === '/api/auth/continue'
          ? continueRoute
          : authRoute
  return middleware({ ...context, next: () => handler(context as never) } as never)
}

afterEach(() => vi.restoreAllMocks())

it('reports session creation failure as unavailable rather than bad credentials on both sign-in paths', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    expect(
      (
        await call(db, '/api/auth/sign-up/email', 'POST', {
          email: 'a@example.test',
          password: 'password-123',
        })
      ).status,
    ).toBe(201)
    await db.prepare('DELETE FROM auth_sessions').run()
    await db
      .prepare(
        'CREATE TRIGGER refuse_session BEFORE INSERT ON auth_sessions BEGIN SELECT RAISE(IGNORE); END',
      )
      .run()
    for (const path of ['/api/auth/sign-in/email', '/api/auth/continue']) {
      const response = await call(db, path, 'POST', {
        email: 'a@example.test',
        password: 'password-123',
      })
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({
        error: 'Sign-in is temporarily unavailable',
        code: 'AUTH_UNAVAILABLE',
      })
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(response.headers.getSetCookie()).toEqual([])
    }
    expect(
      (await db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').first<{ n: number }>())?.n,
    ).toBe(0)
    const signup = await call(db, '/api/auth/sign-up/email', 'POST', {
      email: 'new@example.test',
      password: 'password-123',
    })
    expect(signup.status).toBe(503)
    expect(await signup.json()).toMatchObject({ code: 'SIGN_IN_REQUIRED' })
  } finally {
    await dispose()
  }
}, 30_000)

function responseCookies(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

it('uses a signed Better Auth session for signup, private profile bootstrap and logout revocation', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const signup = await call(db, '/api/auth/sign-up/email', 'POST', {
      email: 'New@Example.test',
      password: 'password-123',
      name: 'New user',
    })
    expect(signup.status).toBe(201)
    const result = (await signup.json()) as {
      user: { id: string; email: string }
      profile: { id: string; display_name: string }
    }
    expect(result).not.toHaveProperty('token')
    expect(result.user.email).toBe('new@example.test')
    expect(result.profile).toMatchObject({ id: result.user.id, display_name: 'New user' })
    const cookie = responseCookies(signup)
    expect(signup.headers.get('Set-Cookie')).toContain('__Secure-kuuki_auth_session=')
    expect(signup.headers.get('Set-Cookie')).toContain('HttpOnly')
    expect((await db.prepare('SELECT COUNT(*) AS n FROM sessions').first<{ n: number }>())?.n).toBe(
      0,
    )
    expect((await call(db, '/api/auth/me', 'GET', undefined, cookie)).status).toBe(200)
    const session = await call(db, '/api/auth/get-session', 'GET', undefined, cookie)
    expect(session.status).toBe(200)
    const sessionBody = (await session.json()) as {
      user: Record<string, unknown>
      session: Record<string, unknown>
    }
    expect(sessionBody.user.id).toBe(result.user.id)
    expect(sessionBody.user).not.toHaveProperty('password_hash')
    expect(sessionBody.session).not.toHaveProperty('token')
    const logout = await call(db, '/api/auth/sign-out', 'POST', {}, cookie)
    expect(logout.status).toBe(200)
    expect(await (await call(db, '/api/auth/me', 'GET', undefined, cookie)).json()).toEqual({
      user: null,
      profile: null,
    })
    expect(
      (await db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').first<{ n: number }>())?.n,
    ).toBe(0)
  } finally {
    await dispose()
  }
}, 30_000)

it('rejects bad credentials, cross-origin auth and logout without CSRF', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const signup = await call(db, '/api/auth/sign-up/email', 'POST', {
      email: 'a@example.test',
      password: 'password-123',
    })
    expect(signup.status).toBe(201)
    const cookie = responseCookies(signup)
    const wrong = await call(db, '/api/auth/sign-in/email', 'POST', {
      email: 'a@example.test',
      password: 'wrong-password',
    })
    expect(wrong.status).toBe(401)
    expect(wrong.headers.get('Set-Cookie')).toBeNull()
    const foreign = await call(
      db,
      '/api/auth/sign-in/email',
      'POST',
      { email: 'a@example.test', password: 'password-123' },
      '',
      { Origin: 'https://foreign.test' },
    )
    expect(foreign.status).toBe(403)
    const noCsrf = await call(db, '/api/auth/sign-out', 'POST', {}, cookie, { 'X-CSRF-Token': '' })
    expect(noCsrf.status).toBe(403)
    expect(
      (await db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').first<{ n: number }>())?.n,
    ).toBe(1)
    const blocked = await call(
      db,
      '/api/auth/change-password',
      'POST',
      { newPassword: 'new-password' },
      cookie,
    )
    expect(blocked.status).toBe(404)
  } finally {
    await dispose()
  }
}, 30_000)

it('answers an unknown email, a wrong password and a RESET_REQUIRED account identically on sign-in', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    expect(
      (
        await call(db, '/api/auth/sign-up/email', 'POST', {
          email: 'a@example.test',
          password: 'password-123',
        })
      ).status,
    ).toBe(201)
    await db.batch([
      db.prepare(
        "INSERT INTO users(id,email,password_hash) VALUES('pending-user','pending@example.test','RESET_REQUIRED')",
      ),
      db.prepare("INSERT INTO profiles(id) VALUES('pending-user')"),
    ])
    const outcome = async (email: string) => {
      const response = await call(db, '/api/auth/sign-in/email', 'POST', {
        email,
        password: 'wrong-password',
      })
      return {
        status: response.status,
        type: response.headers.get('Content-Type'),
        cache: response.headers.get('Cache-Control'),
        cookie: response.headers.get('Set-Cookie'),
        body: await response.json(),
      }
    }
    const unknown = await outcome('nobody@example.test')
    expect(unknown).toEqual({
      status: 401,
      type: 'application/json; charset=utf-8',
      cache: 'no-store',
      cookie: null,
      body: { error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
    })
    expect(await outcome('a@example.test')).toEqual(unknown)
    expect(await outcome('pending@example.test')).toEqual(unknown)
  } finally {
    await dispose()
  }
}, 30_000)

it('runs a password verification on sign-in for an unknown email, a wrong password and a RESET_REQUIRED account', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    expect(
      (
        await call(db, '/api/auth/sign-up/email', 'POST', {
          email: 'a@example.test',
          password: 'password-123',
        })
      ).status,
    ).toBe(201)
    await db.batch([
      db.prepare(
        "INSERT INTO users(id,email,password_hash) VALUES('pending-user','pending@example.test','RESET_REQUIRED')",
      ),
      db.prepare("INSERT INTO profiles(id) VALUES('pending-user')"),
    ])
    const derive = vi.spyOn(crypto.subtle, 'deriveBits')
    const verifications = async (email: string) => {
      derive.mockClear()
      expect(
        (await call(db, '/api/auth/sign-in/email', 'POST', { email, password: 'wrong-password' }))
          .status,
      ).toBe(401)
      return derive.mock.calls.length
    }
    const wrongPassword = await verifications('a@example.test')
    expect(wrongPassword).toBeGreaterThan(0)
    expect(await verifications('nobody@example.test')).toBe(wrongPassword)
    expect(await verifications('pending@example.test')).toBe(wrongPassword)
  } finally {
    await dispose()
  }
}, 30_000)

it('preserves migrated user IDs, profiles and peppered passwords and activates pending accounts', async () => {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    d1Databases: { DB: 'auth-migration-test' },
  })
  try {
    const db = await mf.getD1Database('DB')
    for (const file of ['0001_init.sql', '0002_auth_activation.sql', '0003_derived_recovery.sql']) {
      for (const statement of unstable_splitSqlQuery(
        readFileSync(resolve('db/migrations', file), 'utf8'),
      ))
        await db.prepare(statement).run()
    }
    const hash = await hashPassword('original-password', SECRET)
    await db.batch([
      db
        .prepare('INSERT INTO users(id,email,password_hash) VALUES(?,?,?)')
        .bind('original-user', 'old@example.test', hash),
      db.prepare(
        "INSERT INTO profiles(id,display_name) VALUES('original-user','Existing profile')",
      ),
      db.prepare(
        "INSERT INTO users(id,email,password_hash) VALUES('pending-user','pending@example.test','RESET_REQUIRED')",
      ),
      db.prepare("INSERT INTO profiles(id) VALUES('pending-user')"),
    ])
    for (const statement of unstable_splitSqlQuery(
      readFileSync(resolve('db/migrations/0004_better_auth.sql'), 'utf8'),
    ))
      await db.prepare(statement).run()
    const signin = await call(db, '/api/auth/sign-in/email', 'POST', {
      email: 'old@example.test',
      password: 'original-password',
    })
    expect(signin.status).toBe(200)
    expect(await signin.json()).toMatchObject({
      user: { id: 'original-user' },
      profile: { display_name: 'Existing profile' },
    })
    expect(
      (
        await db
          .prepare("SELECT password FROM auth_accounts WHERE userId='original-user'")
          .first<{ password: string }>()
      )?.password,
    ).toBe(hash)
    const pending = await call(db, '/api/auth/sign-in/email', 'POST', {
      email: 'pending@example.test',
      password: 'original-password',
    })
    expect(pending.status).toBe(401)
    let link = ''
    await requestActivation(db, 'pending@example.test', 'https://activate.kuuki.test', {
      async send(_to, value) {
        link = value
      },
    })
    expect(
      await completeActivation(
        db,
        new URL(link).hash.slice('#token='.length),
        'activated-password',
        SECRET,
      ),
    ).toBe(true)
    const activated = await call(db, '/api/auth/sign-in/email', 'POST', {
      email: 'pending@example.test',
      password: 'activated-password',
    })
    expect(activated.status).toBe(200)
    expect(await activated.json()).toMatchObject({ user: { id: 'pending-user' } })
  } finally {
    await mf.dispose()
  }
}, 30_000)

it('replaces a legacy session and refuses to fall back from an invalid Better Auth cookie', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const signup = await call(db, '/api/auth/sign-up/email', 'POST', {
      email: 'a@example.test',
      password: 'password-123',
    })
    const { user } = (await signup.json()) as { user: { id: string } }
    const legacy = await createSession(db, user.id)
    const legacyCookie = `kuuki_session=${legacy.token}; kuuki_csrf=legacy-csrf`
    expect(
      await (await call(db, '/api/auth/me', 'GET', undefined, legacyCookie)).json(),
    ).toMatchObject({ user: { id: user.id } })
    const invalid = await call(
      db,
      '/api/auth/me',
      'GET',
      undefined,
      `${legacyCookie}; __Secure-kuuki_auth_session=invalid.signature`,
    )
    expect(await invalid.json()).toEqual({ user: null, profile: null })
    expect(await (await call(db, '/api/auth/me', 'GET', undefined, legacyCookie)).json()).toEqual({
      user: null,
      profile: null,
    })
    const secondLegacy = await createSession(db, user.id)
    const sessionCookie = `kuuki_session=${secondLegacy.token}; kuuki_csrf=legacy-csrf`
    const invalidSession = await call(
      db,
      '/api/auth/get-session',
      'GET',
      undefined,
      `${sessionCookie}; __Secure-kuuki_auth_session=invalid.signature`,
    )
    expect(await invalidSession.json()).toBeNull()
    expect(await (await call(db, '/api/auth/me', 'GET', undefined, sessionCookie)).json()).toEqual({
      user: null,
      profile: null,
    })
    const signin = await call(
      db,
      '/api/auth/sign-in/email',
      'POST',
      { email: 'a@example.test', password: 'password-123' },
      sessionCookie,
    )
    expect(signin.status).toBe(200)
    expect((await db.prepare('SELECT COUNT(*) AS n FROM sessions').first<{ n: number }>())?.n).toBe(
      0,
    )
  } finally {
    await dispose()
  }
}, 30_000)

it('requires the password for account deletion and revokes every Better Auth session', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const signup = await call(db, '/api/auth/sign-up/email', 'POST', {
      email: 'a@example.test',
      password: 'password-123',
    })
    const cookie = responseCookies(signup)
    const second = await call(db, '/api/auth/sign-in/email', 'POST', {
      email: 'a@example.test',
      password: 'password-123',
    })
    const otherCookie = responseCookies(second)
    const denied = await call(
      db,
      '/api/auth/account',
      'DELETE',
      { password: 'wrong-password' },
      cookie,
    )
    expect(denied.status).toBe(401)
    expect((await db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>())?.n).toBe(1)
    const deleted = await call(
      db,
      '/api/auth/account',
      'DELETE',
      { password: 'password-123' },
      cookie,
    )
    expect(deleted.status).toBe(200)
    expect(deleted.headers.get('Set-Cookie')).toContain('__Secure-kuuki_auth_session=;')
    for (const table of ['users', 'profiles', 'auth_accounts', 'auth_sessions']) {
      expect(
        (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n,
      ).toBe(0)
    }
    expect(await (await call(db, '/api/auth/me', 'GET', undefined, otherCookie)).json()).toEqual({
      user: null,
      profile: null,
    })
  } finally {
    await dispose()
  }
}, 30_000)

it('keeps signup provisioning atomic and makes a failed session recoverable by signing in', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db
      .prepare(
        "CREATE TRIGGER fail_profile BEFORE INSERT ON profiles BEGIN SELECT RAISE(ABORT, 'synthetic profile failure'); END",
      )
      .run()
    const failed = await call(db, '/api/auth/sign-up/email', 'POST', {
      email: 'rollback@example.test',
      password: 'password-123',
    })
    expect(failed.status).toBe(500)
    for (const table of ['users', 'profiles', 'auth_accounts']) {
      expect(
        (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n,
      ).toBe(0)
    }
    await db.prepare('DROP TRIGGER fail_profile').run()
    await db
      .prepare(
        "CREATE TRIGGER fail_session BEFORE INSERT ON auth_sessions BEGIN SELECT RAISE(ABORT, 'synthetic session failure'); END",
      )
      .run()
    const created = await call(db, '/api/auth/sign-up/email', 'POST', {
      email: 'recover@example.test',
      password: 'password-123',
    })
    expect(created.status).toBe(503)
    expect(await created.json()).toMatchObject({
      code: 'SIGN_IN_REQUIRED',
      error: 'Your account was created. Please sign in to continue.',
    })
    await db.prepare('DROP TRIGGER fail_session').run()
    const recovered = await call(db, '/api/auth/sign-in/email', 'POST', {
      email: 'recover@example.test',
      password: 'password-123',
    })
    expect(recovered.status).toBe(200)
  } finally {
    await dispose()
  }
}, 30_000)
