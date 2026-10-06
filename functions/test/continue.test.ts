import { afterEach, expect, it, vi } from 'vitest'
import { count, createApiDatabase, apiContext } from './harness'
import { onRequest as middleware } from '../_middleware'
import { onRequestPost as continueRoute } from '../api/auth/continue'
import { onRequestPost as signupRoute } from '../api/auth/signup'
import { createUserWithProfile } from '../api/_lib/users'

const ORIGIN = 'https://kuuki.test'
const SECRET = 'synthetic-test-pepper'
const env = { AUTH_SECRET: SECRET, BETTER_AUTH_SECRET: 'synthetic-better-auth-test-secret-32-characters', PAGES_ORIGIN: ORIGIN }

afterEach(() => vi.restoreAllMocks())

async function post(db: D1Database, path: string, body: unknown, { ip = '203.0.113.1', cookie = '' } = {}) {
  const request = new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { Origin: ORIGIN, Cookie: cookie, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const context = { ...apiContext(db, request), env: { DB: db, ...env } }
  const handler = path === '/api/auth/signup' ? signupRoute : continueRoute
  return middleware({ ...context, next: () => handler(context as never) } as never)
}

const cont = (db: D1Database, body: unknown, options?: { ip?: string; cookie?: string }) => post(db, '/api/auth/continue', body, options)

const seed = (db: D1Database) => createUserWithProfile(db, { email: 'known@example.test', password: 'password-123' }, SECRET)

it('issues a session for a verified password with the sign-in body shape', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const user = await seed(db)
    const response = await cont(db, { email: ' Known@Example.test ', password: 'password-123' })
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const cookies = response.headers.getSetCookie().join('\n')
    expect(cookies).toContain('__Secure-kuuki_auth_session=')
    expect(cookies).toContain('kuuki_csrf=')
    const result = await response.json() as Record<string, unknown>
    expect(result).toMatchObject({ user: { id: user.id, email: 'known@example.test' }, profile: { id: user.id } })
    expect(result).not.toHaveProperty('token')
    expect(result).not.toHaveProperty('next')
    expect(await count(db, 'auth_sessions')).toBe(1)
  } finally { await dispose() }
}, 30_000)

it('replaces an existing session instead of renewing the old identity', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const first = await cont(db, { email: 'known@example.test', password: 'password-123' })
    const cookie = first.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    const second = await cont(db, { email: 'known@example.test', password: 'password-123' }, { cookie })
    expect(second.status).toBe(200)
    expect(second.headers.getSetCookie().join('\n')).toContain('__Secure-kuuki_auth_session=')
    expect(await count(db, 'auth_sessions')).toBe(2)
  } finally { await dispose() }
}, 30_000)

it('answers 401 INVALID_CREDENTIALS for a wrong password without a session', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const response = await cont(db, { email: 'known@example.test', password: 'wrong-password' })
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await count(db, 'auth_sessions')).toBe(0)
  } finally { await dispose() }
}, 30_000)

it('answers 401 INVALID_CREDENTIALS for a RESET_REQUIRED account', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await db.batch([
      db.prepare("INSERT INTO users(id,email,password_hash) VALUES('pending-user','pending@example.test','RESET_REQUIRED')"),
      db.prepare("INSERT INTO profiles(id) VALUES('pending-user')"),
    ])
    const response = await cont(db, { email: 'pending@example.test', password: 'anything-at-all' })
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(await count(db, 'auth_sessions')).toBe(0)
  } finally { await dispose() }
}, 30_000)

it('answers { next: "create" } for an unknown email and stores nothing', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const before = { users: await count(db, 'users'), profiles: await count(db, 'profiles'), accounts: await count(db, 'auth_accounts') }
    const response = await cont(db, { email: 'new@example.test', password: 'short' })
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(await response.json()).toEqual({ next: 'create' })
    expect({ users: await count(db, 'users'), profiles: await count(db, 'profiles'), accounts: await count(db, 'auth_accounts') }).toEqual(before)
    expect(await count(db, 'auth_sessions')).toBe(0)
  } finally { await dispose() }
}, 30_000)

it('runs a password verification for both a wrong password and an unknown email', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const derive = vi.spyOn(crypto.subtle, 'deriveBits')
    expect((await cont(db, { email: 'known@example.test', password: 'wrong-password' })).status).toBe(401)
    const wrongPasswordCalls = derive.mock.calls.length
    expect(wrongPasswordCalls).toBeGreaterThan(0)
    derive.mockClear()
    expect((await cont(db, { email: 'nobody@example.test', password: 'wrong-password' })).status).toBe(200)
    expect(derive.mock.calls.length).toBe(wrongPasswordCalls)
  } finally { await dispose() }
}, 30_000)

it('rejects malformed input with the existing 400 codes', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const bad = async (body: unknown) => { const r = await cont(db, body); return [r.status, ((await r.json()) as { code: string }).code] }
    expect(await bad('not json')).toEqual([400, 'MISSING_CREDENTIALS'])
    expect(await bad({ password: 'password-123' })).toEqual([400, 'MISSING_CREDENTIALS'])
    expect(await bad({ email: 'not-an-email', password: 'password-123' })).toEqual([400, 'INVALID_EMAIL'])
    expect(await bad({ email: 'a@example.test', password: '' })).toEqual([400, 'MISSING_PASSWORD'])
    expect(await bad({ email: 'a@example.test' })).toEqual([400, 'MISSING_PASSWORD'])
    expect(await count(db, 'users')).toBe(0)
  } finally { await dispose() }
}, 30_000)

it('rejects a cross-origin call', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const request = new Request(`${ORIGIN}/api/auth/continue`, {
      method: 'POST',
      headers: { Origin: 'https://foreign.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.test', password: 'password-123' }),
    })
    const response = await continueRoute({ ...apiContext(db, request), env: { DB: db, ...env } } as never)
    expect(response.status).toBe(403)
  } finally { await dispose() }
}, 30_000)

it('returns 429 once the per-IP sign-in bucket is spent', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    for (let i = 0; i < 20; i++) expect((await cont(db, { email: 'known@example.test', password: 'wrong-password' })).status).toBe(401)
    const limited = await cont(db, { email: 'known@example.test', password: 'wrong-password' })
    expect(limited.status).toBe(429)
    expect(await limited.json()).toMatchObject({ code: 'RATE_LIMITED' })
    expect((await cont(db, { email: 'known@example.test', password: 'wrong-password' }, { ip: '203.0.113.2' })).status).toBe(401)
  } finally { await dispose() }
}, 60_000)

async function exhaustSignupBucket(db: D1Database) {
  for (let i = 0; i < 10; i++) expect(await (await cont(db, { email: `new${i}@example.test`, password: 'password-123' })).json()).toEqual({ next: 'create' })
}

it('returns 429 after 10 create answers, while known-account calls do not spend the signup bucket', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    for (let i = 0; i < 5; i++) expect((await cont(db, { email: 'known@example.test', password: 'wrong-password' })).status).toBe(401)
    await exhaustSignupBucket(db)
    const limited = await cont(db, { email: 'new10@example.test', password: 'password-123' })
    expect(limited.status).toBe(429)
    expect(await limited.json()).toMatchObject({ code: 'RATE_LIMITED' })
    // The signup bucket is shared with sign-up, so the same IP cannot create either.
    expect((await post(db, '/api/auth/signup', { email: 'new11@example.test', password: 'password-123' })).status).toBe(429)
  } finally { await dispose() }
}, 60_000)

it('answers an identical 429 for unknown and known emails once the signup bucket is spent', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await db.batch([
      db.prepare("INSERT INTO users(id,email,password_hash) VALUES('pending-user','pending@example.test','RESET_REQUIRED')"),
      db.prepare("INSERT INTO profiles(id) VALUES('pending-user')"),
    ])
    await exhaustSignupBucket(db)
    const seen = async (email: string) => { const r = await cont(db, { email, password: 'wrong-password' }); return [r.status, await r.json()] }
    const unknown = await seen('nobody@example.test')
    expect(unknown).toEqual([429, expect.objectContaining({ code: 'RATE_LIMITED' })])
    expect(await seen('known@example.test')).toEqual(unknown)
    expect(await seen('pending@example.test')).toEqual(unknown)
    // The refusals are peeks: they do not spend the signup bucket further.
    expect((await db.prepare("SELECT count FROM auth_rate_limits WHERE key = 'signup:203.0.113.1'").first<{ count: number }>())?.count).toBe(10)
  } finally { await dispose() }
}, 60_000)

it('still signs a known account in with the right password once the signup bucket is spent', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await exhaustSignupBucket(db)
    const response = await cont(db, { email: 'known@example.test', password: 'password-123' })
    expect(response.status).toBe(200)
    expect(response.headers.getSetCookie().join('\n')).toContain('__Secure-kuuki_auth_session=')
  } finally { await dispose() }
}, 60_000)

it('still verifies a password for unknown and known emails once the signup bucket is spent', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    await exhaustSignupBucket(db)
    const derive = vi.spyOn(crypto.subtle, 'deriveBits')
    expect((await cont(db, { email: 'known@example.test', password: 'wrong-password' })).status).toBe(429)
    const knownCalls = derive.mock.calls.length
    expect(knownCalls).toBeGreaterThan(0)
    derive.mockClear()
    expect((await cont(db, { email: 'nobody@example.test', password: 'wrong-password' })).status).toBe(429)
    expect(derive.mock.calls.length).toBe(knownCalls)
  } finally { await dispose() }
}, 60_000)

it('neither renews nor rewrites an existing session on a failed or create-answer Continue', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const first = await cont(db, { email: 'known@example.test', password: 'password-123' })
    const cookie = first.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    // Make the session renewal-eligible: last touched two days ago, expiring in 20 days.
    const stale = new Date(Date.now() - 2 * 86_400_000).toISOString()
    const expiry = new Date(Date.now() + 20 * 86_400_000).toISOString()
    await db.prepare('UPDATE auth_sessions SET updatedAt = ?, expiresAt = ?').bind(stale, expiry).run()
    for (const body of [{ email: 'known@example.test', password: 'wrong-password' }, { email: 'nobody@example.test', password: 'password-123' }]) {
      const response = await cont(db, body, { cookie })
      expect(response.headers.getSetCookie()).toEqual([])
    }
    expect(await db.prepare('SELECT expiresAt, updatedAt FROM auth_sessions').first()).toEqual({ expiresAt: expiry, updatedAt: stale })
  } finally { await dispose() }
}, 30_000)

it('signs up without a confirm field and answers 409 for a taken email', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const created = await post(db, '/api/auth/signup', { email: 'fresh@example.test', password: 'password-123' })
    expect(created.status).toBe(201)
    expect(await created.json()).toMatchObject({ user: { email: 'fresh@example.test' } })
    expect(await count(db, 'users')).toBe(1)
    const taken = await post(db, '/api/auth/signup', { email: 'Fresh@Example.test', password: 'password-123' })
    expect(taken.status).toBe(409)
    expect(await taken.json()).toMatchObject({ code: 'EMAIL_TAKEN' })
    expect(await count(db, 'users')).toBe(1)
  } finally { await dispose() }
}, 30_000)
