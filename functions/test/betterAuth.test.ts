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
  environment: Partial<Env> = {},
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
  const context = { ...apiContext(db, request), env: { DB: db, ...env, ...environment } }
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

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

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

it('treats an invalid Better Auth cookie as signed out', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const invalid = '__Secure-kuuki_auth_session=invalid.signature'
    expect(await (await call(db, '/api/auth/me', 'GET', undefined, invalid)).json()).toEqual({
      user: null,
      profile: null,
    })
    expect(
      await (await call(db, '/api/auth/get-session', 'GET', undefined, invalid)).json(),
    ).toBeNull()
  } finally {
    await dispose()
  }
})

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

const googleEnv = {
  GOOGLE_CLIENT_ID: 'synthetic-google-client',
  GOOGLE_CLIENT_SECRET: 'synthetic-google-secret',
}

function mockGoogle(profile: Record<string, unknown>) {
  const fetch = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url !== 'https://oauth2.googleapis.com/token') throw new Error(`Unexpected fetch: ${url}`)
    const claims = { sub: 'google-subject', email_verified: true, name: 'Google name', ...profile }
    // The trusted token endpoint is the network boundary; Better Auth consumes its ID token.
    const idToken = `${btoa(JSON.stringify({ alg: 'RS256' }))}.${btoa(JSON.stringify(claims))}.signature`
    return Response.json({
      access_token: 'synthetic-access-token',
      refresh_token: 'synthetic-refresh-token',
      id_token: idToken,
      token_type: 'Bearer',
      expires_in: 3600,
    })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

async function startGoogle(db: D1Database, cookie = '') {
  const start = await call(
    db,
    '/api/auth/sign-in/social',
    'POST',
    {
      provider: 'google',
      callbackURL: 'https://foreign.test/steal',
      newUserCallbackURL: 'https://foreign.test/new',
      errorCallbackURL: 'https://foreign.test/error',
    },
    cookie,
    {},
    googleEnv,
  )
  expect(start.status).toBe(200)
  const body = (await start.json()) as { url: string; redirect: boolean }
  const authorization = new URL(body.url)
  expect(authorization.origin).toBe('https://accounts.google.com')
  expect(authorization.searchParams.get('prompt')).toBe('select_account')
  expect(authorization.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/callback/google`)
  expect(authorization.searchParams.get('code_challenge')).toBeTruthy()
  expect(body.redirect).toBe(false)
  return { state: authorization.searchParams.get('state')!, cookie: responseCookies(start) }
}

it('creates a private Google profile before the session, discards provider tokens and rejects replayed state', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    mockGoogle({ email: 'new@gmail.com' })
    const flow = await startGoogle(db)
    const callbackPath = `/api/auth/callback/google?code=synthetic-code&state=${flow.state}`
    const callback = await call(db, callbackPath, 'GET', undefined, flow.cookie, {}, googleEnv)
    expect(callback.status).toBe(302)
    expect(callback.headers.get('Location')).toBe(`${ORIGIN}/welcome/name`)
    expect(responseCookies(callback)).toContain('kuuki_csrf=')
    const cookie = responseCookies(callback)
    const me = await call(db, '/api/auth/me', 'GET', undefined, cookie)
    const own = (await me.json()) as { user: { id: string }; profile: Record<string, unknown> }
    expect(own.user.id).toBeTruthy()
    expect(own.profile).toMatchObject({ id: own.user.id, is_public: false })
    expect(
      await db
        .prepare('SELECT password_hash, email_verified FROM users WHERE id = ?')
        .bind(own.user.id)
        .first(),
    ).toMatchObject({ password_hash: 'RESET_REQUIRED', email_verified: 1 })
    expect(
      await db
        .prepare('SELECT accessToken, refreshToken, idToken FROM auth_accounts WHERE userId = ?')
        .bind(own.user.id)
        .first(),
    ).toEqual({ accessToken: null, refreshToken: null, idToken: null })
    const replay = await call(db, callbackPath, 'GET', undefined, flow.cookie, {}, googleEnv)
    expect(replay.headers.get('Location')).toContain(`${ORIGIN}/signin?`)
    expect(responseCookies(replay)).not.toContain('kuuki_auth_session=')
    expect(
      (await db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').first<{ n: number }>())?.n,
    ).toBe(1)
  } finally {
    await dispose()
  }
}, 30_000)

it.each([
  ['verified Gmail', 'existing@gmail.com', 1, {}],
  ['migrated Gmail', 'existing@gmail.com', 0, {}],
  ['migrated Workspace', 'existing@workspace.test', 0, { hd: 'workspace.test' }],
])(
  'links %s without changing its journal identity or profile',
  async (_reason, email, verified, claims) => {
    const { db, dispose } = await createApiDatabase()
    try {
      const previous = await call(db, '/api/auth/sign-up/email', 'POST', {
        email: 'previous@example.test',
        password: 'password-123',
      })
      const previousCookie = responseCookies(previous)
      await db.batch([
        db
          .prepare(
            "INSERT INTO users(id,email,password_hash,email_verified) VALUES('existing',?,'RESET_REQUIRED',?)",
          )
          .bind(email, verified),
        db.prepare(
          "INSERT INTO profiles(id,display_name,username,is_public) VALUES('existing','Chosen name','chosen',1)",
        ),
      ])
      mockGoogle({ email, ...claims })
      const legacyCookie = 'kuuki_session=stale-token'
      const flow = await startGoogle(db, legacyCookie)
      expect(flow.cookie).not.toContain('kuuki_session=')
      const callback = await call(
        db,
        `/api/auth/callback/google?code=code&state=${flow.state}`,
        'GET',
        undefined,
        `${previousCookie}; ${legacyCookie}; ${flow.cookie}`,
        {},
        googleEnv,
      )
      expect(callback.headers.get('Location')).toBe(`${ORIGIN}/overview`)
      expect(responseCookies(callback)).toContain('kuuki_session=;')
      const me = await call(db, '/api/auth/me', 'GET', undefined, responseCookies(callback))
      expect(await me.json()).toMatchObject({
        user: { id: 'existing' },
        profile: { display_name: 'Chosen name', username: 'chosen', is_public: true },
      })
      expect((await db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>())?.n).toBe(
        2,
      )
      expect(
        await db
          .prepare('SELECT email_verified, password_hash FROM users WHERE id = ?')
          .bind('existing')
          .first(),
      ).toMatchObject({ email_verified: 1, password_hash: 'RESET_REQUIRED' })
      const repeat = await startGoogle(db)
      const repeatedCallback = await call(
        db,
        `/api/auth/callback/google?code=code&state=${repeat.state}`,
        'GET',
        undefined,
        repeat.cookie,
        {},
        googleEnv,
      )
      expect(repeatedCallback.headers.get('Location')).toBe(`${ORIGIN}/overview`)
      expect(
        await (
          await call(db, '/api/auth/me', 'GET', undefined, responseCookies(repeatedCallback))
        ).json(),
      ).toMatchObject({ user: { id: 'existing' } })
      expect(
        (
          await db
            .prepare("SELECT COUNT(*) AS n FROM auth_accounts WHERE providerId = 'google'")
            .first<{ n: number }>()
        )?.n,
      ).toBe(1)
      expect(
        await (await call(db, '/api/auth/me', 'GET', undefined, previousCookie)).json(),
      ).toEqual({
        user: null,
        profile: null,
      })
      expect(
        (await db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').first<{ n: number }>())?.n,
      ).toBe(2)
    } finally {
      await dispose()
    }
  },
  30_000,
)

it.each([
  ['unverified password identity', 'existing@gmail.com', 0, 'password', {}, false],
  ['third-party Google mailbox', 'existing@example.test', 1, 'RESET_REQUIRED', {}, false],
  [
    'unverified Google Gmail',
    'existing@gmail.com',
    0,
    'RESET_REQUIRED',
    { email_verified: false },
    false,
  ],
  ['existing provider identity', 'existing@gmail.com', 0, 'RESET_REQUIRED', {}, true],
])(
  'refuses implicit Google linking for %s',
  async (_reason, email, verified, password, claims, existingProvider) => {
    const { db, dispose } = await createApiDatabase()
    try {
      await db.batch([
        db
          .prepare('INSERT INTO users(id,email,password_hash,email_verified) VALUES(?,?,?,?)')
          .bind('existing', email, password, verified),
        db.prepare("INSERT INTO profiles(id,display_name) VALUES('existing','Existing journal')"),
      ])
      if (existingProvider)
        await db
          .prepare(
            "INSERT INTO auth_accounts (id,providerId,accountId,userId,createdAt,updatedAt) VALUES ('existing-provider','google','another-subject','existing',datetime('now'),datetime('now'))",
          )
          .run()
      const previousAccounts = await db
        .prepare('SELECT id, providerId, accountId, userId FROM auth_accounts')
        .all()
      mockGoogle({ email, ...claims })
      const flow = await startGoogle(db)
      const callback = await call(
        db,
        `/api/auth/callback/google?code=code&state=${flow.state}`,
        'GET',
        undefined,
        flow.cookie,
        {},
        googleEnv,
      )
      expect(new URL(callback.headers.get('Location')!).searchParams.get('error')).toBe(
        'account_not_linked',
      )
      expect(responseCookies(callback)).not.toContain('kuuki_auth_session=')
      expect(
        (
          await db
            .prepare('SELECT email_verified FROM users WHERE id = ?')
            .bind('existing')
            .first<{ email_verified: number }>()
        )?.email_verified,
      ).toBe(verified)
      expect(
        (await db.prepare('SELECT id, providerId, accountId, userId FROM auth_accounts').all())
          .results,
      ).toEqual(previousAccounts.results)
      expect(
        (await db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').first<{ n: number }>())?.n,
      ).toBe(0)
    } finally {
      await dispose()
    }
  },
  30_000,
)

it('rejects unsafe social starts and routes Google cancellation to the local sign-in page', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    for (const body of [
      { provider: 'github' },
      { provider: 'google', idToken: { token: 'bypass' } },
    ]) {
      expect(
        (await call(db, '/api/auth/sign-in/social', 'POST', body, '', {}, googleEnv)).status,
      ).toBe(400)
    }
    expect(
      (
        await call(
          db,
          '/api/auth/sign-in/social',
          'POST',
          { provider: 'google' },
          '',
          { Origin: 'https://foreign.test' },
          googleEnv,
        )
      ).status,
    ).toBe(403)
    expect(
      (await call(db, '/api/auth/sign-in/social', 'POST', { provider: 'google' })).status,
    ).toBe(503)
    const flow = await startGoogle(db)
    const cancelled = await call(
      db,
      `/api/auth/callback/google?error=access_denied&state=${flow.state}`,
      'GET',
      undefined,
      flow.cookie,
      {},
      googleEnv,
    )
    expect(cancelled.headers.get('Location')).toContain(`${ORIGIN}/signin?`)
    expect(new URL(cancelled.headers.get('Location')!).searchParams.get('error')).toBe(
      'access_denied',
    )
    expect(responseCookies(cancelled)).not.toContain('kuuki_auth_session=')
    expect((await db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>())?.n).toBe(0)
  } finally {
    await dispose()
  }
}, 30_000)

it('withholds a Google session when profile provisioning fails and recovers on the next sign-in', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db
      .prepare(
        "CREATE TRIGGER fail_profile BEFORE INSERT ON profiles BEGIN SELECT RAISE(ABORT, 'synthetic profile failure'); END",
      )
      .run()
    mockGoogle({ email: 'recover@gmail.com' })
    const failedFlow = await startGoogle(db)
    const failed = await call(
      db,
      `/api/auth/callback/google?code=code&state=${failedFlow.state}`,
      'GET',
      undefined,
      failedFlow.cookie,
      {},
      googleEnv,
    )
    expect(responseCookies(failed)).not.toContain('kuuki_auth_session=')
    expect(
      (await db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').first<{ n: number }>())?.n,
    ).toBe(0)
    expect((await db.prepare('SELECT COUNT(*) AS n FROM profiles').first<{ n: number }>())?.n).toBe(
      0,
    )
    await db.prepare('DROP TRIGGER fail_profile').run()
    const retryFlow = await startGoogle(db)
    const retry = await call(
      db,
      `/api/auth/callback/google?code=code&state=${retryFlow.state}`,
      'GET',
      undefined,
      retryFlow.cookie,
      {},
      googleEnv,
    )
    expect(retry.headers.get('Location')).toBe(`${ORIGIN}/overview`)
    expect(responseCookies(retry)).toContain('kuuki_auth_session=')
    expect((await db.prepare('SELECT COUNT(*) AS n FROM profiles').first<{ n: number }>())?.n).toBe(
      1,
    )
    expect((await db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>())?.n).toBe(1)
  } finally {
    await dispose()
  }
}, 30_000)
