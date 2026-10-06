import { afterEach, expect, it, vi } from 'vitest'
import { createApiDatabase, apiContext } from './harness'
import { requestActivation, completeActivation } from '../api/_lib/activation'
import type { MailSender } from '../api/_lib/activationSender'
import { hashPassword, verifyPassword, sha256Hex } from '../api/_lib/crypto'
import { createSession } from '../api/_lib/session'
import { rateLimit } from '../api/_lib/ratelimit'
import { onRequest as middleware } from '../_middleware'
import { onRequestPost as requestRoute } from '../api/auth/activation/request'
import { onRequestPost as completeRoute } from '../api/auth/activation/complete'
import { onRequestPost as signoutRoute } from '../api/auth/signout'
import { setSessionCookies } from '../api/_lib/authCookies'

const ORIGIN = 'https://kuuki.test'
const ACTIVATION_ORIGIN = 'https://activate.kuuki.test'
const SECRET = 'synthetic-test-pepper'

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

async function seedUser(db: D1Database, id: string, email: string, hash = 'RESET_REQUIRED') {
  await db.batch([
    db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(id, email, hash),
    db.prepare('INSERT INTO profiles (id) VALUES (?)').bind(id),
  ])
}

function activationRequest(db: D1Database, path: string, body: object, headers: Record<string, string> = {}, origin = ORIGIN, extraEnv: Record<string, string> = {}, background: Promise<unknown>[] = []) {
  const request = new Request(`${origin}${path}`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  return {
    ...apiContext(db, request),
    env: { DB: db, AUTH_SECRET: SECRET, PAGES_ORIGIN: ORIGIN, ACTIVATION_ORIGIN, ...extraEnv },
    waitUntil(task: Promise<unknown>) { background.push(task) },
  } as never
}

it('activates only a RESET_REQUIRED user once and keeps an active account unchanged', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seedUser(db, 'legacy', 'legacy@example.test')
    const activeHash = await hashPassword('old-password', SECRET)
    await seedUser(db, 'active', 'active@example.test', activeHash)
    const activeSession = await createSession(db, 'active')
    const links: string[] = []
    const sender: MailSender = { async send(_to, link) { links.push(link) } }
    await requestActivation(db, 'missing@example.test', ORIGIN, sender)
    await requestActivation(db, 'active@example.test', ORIGIN, sender)
    expect(links).toHaveLength(0)
    await requestActivation(db, 'legacy@example.test', ORIGIN, sender)
    expect(links).toHaveLength(1)
    expect(new URL(links[0]).pathname).toBe('/activate')
    const token = new URL(links[0]).hash.slice('#token='.length)
    const results = await Promise.all([
      completeActivation(db, token, 'new-password-1', SECRET),
      completeActivation(db, token, 'new-password-2', SECRET),
    ])
    expect(results.sort()).toEqual([false, true])
    expect(await completeActivation(db, token, 'new-password-3', SECRET)).toBe(false)
    const legacy = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind('legacy').first<{ password_hash: string }>()
    expect(legacy?.password_hash).not.toBe('RESET_REQUIRED')
    expect(await verifyPassword('new-password-1', legacy!.password_hash, SECRET) ||
      await verifyPassword('new-password-2', legacy!.password_hash, SECRET)).toBe(true)
    const active = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind('active').first<{ password_hash: string }>()
    expect(active?.password_hash).toBe(activeHash)
    expect(await db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').bind('active').first<{ n: number }>()).toEqual({ n: 1 })
    expect(activeSession.token).toBeTruthy()
    expect(await db.prepare('SELECT COUNT(*) AS n FROM account_activation_tokens').first<{ n: number }>()).toEqual({ n: 0 })
  } finally { await dispose() }
})

it('rejects expired and stale tokens without revoking sessions', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seedUser(db, 'legacy', 'legacy@example.test')
    const links: string[] = []
    await requestActivation(db, 'legacy@example.test', ORIGIN, { async send(_to, link) { links.push(link) } })
    const token = new URL(links[0]).hash.slice('#token='.length)
    await db.prepare('UPDATE account_activation_tokens SET expires_at = ?').bind('2000-01-01T00:00:00.000Z').run()
    expect(await completeActivation(db, token, 'new-password', SECRET)).toBe(false)
    const hash = await hashPassword('existing-password', SECRET)
    await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, 'legacy').run()
    await createSession(db, 'legacy')
    await db.prepare('UPDATE account_activation_tokens SET expires_at = ?').bind('2999-01-01T00:00:00.000Z').run()
    expect(await completeActivation(db, token, 'new-password', SECRET)).toBe(false)
    expect((await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind('legacy').first<{ password_hash: string }>())?.password_hash).toBe(hash)
    expect((await db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').bind('legacy').first<{ n: number }>())?.n).toBe(1)
  } finally { await dispose() }
})

it('fails closed without sender configuration and requires same-origin bearer completion', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seedUser(db, 'legacy', 'legacy@example.test')
    const unknown = await requestRoute(activationRequest(db, '/api/auth/activation/request', { email: 'missing@example.test' }))
    const legacy = await requestRoute(activationRequest(db, '/api/auth/activation/request', { email: 'legacy@example.test' }))
    expect([unknown.status, legacy.status]).toEqual([503, 503])
    expect(legacy.headers.get('Cache-Control')).toBe('no-store')
    expect((await db.prepare('SELECT COUNT(*) AS n FROM account_activation_tokens').first<{ n: number }>())?.n).toBe(0)
    const noBearer = await completeRoute(activationRequest(db, '/api/auth/activation/complete', { password: 'new-password' }, {}, ACTIVATION_ORIGIN))
    expect(noBearer.status).toBe(400)
    const foreign = await completeRoute(activationRequest(db, '/api/auth/activation/complete', { password: 'new-password' }, { Origin: 'https://foreign.test' }, ACTIVATION_ORIGIN))
    expect(foreign.status).toBe(403)
  } finally { await dispose() }
})

it('uses the configured dedicated activation origin and keeps request responses generic', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seedUser(db, 'legacy', 'legacy@example.test')
    await seedUser(db, 'active', 'active@example.test', await hashPassword('active-password', SECRET))
    let finishSend!: (response: Response) => void
    const sendPending = new Promise<Response>(resolve => { finishSend = resolve })
    const send = vi.spyOn(globalThis, 'fetch').mockReturnValue(sendPending)
    const acknowledged = new Response(JSON.stringify({
      success: true, errors: [], result: { delivered: [], queued: ['legacy@example.test'], permanent_bounces: [] },
    }))
    const senderEnv = {
      ACTIVATION_MAIL_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
      ACTIVATION_MAIL_AUTH_TOKEN: 'synthetic-sender-secret',
      ACTIVATION_MAIL_FROM: 'sender@example.test',
    }
    const statuses = []
    const background: Promise<unknown>[] = []
    for (const email of ['missing@example.test', 'active@example.test', 'legacy@example.test']) {
      const response = await requestRoute(activationRequest(db, '/api/auth/activation/request', { email }, {}, ORIGIN, senderEnv, background))
      statuses.push(response.status)
      expect(await response.json()).toEqual({ ok: true })
    }
    expect(statuses).toEqual([200, 200, 200])
    expect(background).toHaveLength(3)
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    // The account-dependent send remains pending after the generic 200 response.
    expect((await db.prepare('SELECT COUNT(*) AS n FROM account_activation_tokens').first<{ n: number }>())?.n).toBe(1)
    finishSend(acknowledged)
    await Promise.all(background)
    expect((await db.prepare('SELECT COUNT(*) AS n FROM account_activation_tokens').first<{ n: number }>())?.n).toBe(1)
    expect(send).toHaveBeenCalledOnce()
    const [senderUrl, init] = send.mock.calls[0]
    expect(String(senderUrl)).toBe(`https://api.cloudflare.com/client/v4/accounts/${senderEnv.ACTIVATION_MAIL_ACCOUNT_ID}/email/sending/send`)
    const body = JSON.parse(String(init?.body)) as { text: string }
    const link = body.text.match(/https:\/\/[^\s]+/)?.[0]
    expect(link).toBeTruthy()
    expect(new URL(link!).origin).toBe(ACTIVATION_ORIGIN)
    expect(new URL(link!).pathname).toBe('/activate')
    expect(new URL(link!).search).toBe('')
    expect(new URL(link!).hash).toMatch(/^#token=/)
    const invalidOrigin = await requestRoute(activationRequest(db, '/api/auth/activation/request', { email: 'legacy@example.test' }, {}, ORIGIN, {
      ...senderEnv, ACTIVATION_ORIGIN: ORIGIN,
    }))
    expect(invalidOrigin.status).toBe(503)
  } finally { await dispose() }
})

it('removes the activation token and keeps account responses generic when delivery fails', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seedUser(db, 'legacy', 'legacy@example.test')
    await seedUser(db, 'active', 'active@example.test', await hashPassword('active-password', SECRET))
    const senderEnv = {
      ACTIVATION_MAIL_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
      ACTIVATION_MAIL_AUTH_TOKEN: 'synthetic-sender-secret',
      ACTIVATION_MAIL_FROM: 'sender@example.test',
    }
    let sentLink = ''
    const send = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { text: string }
      sentLink = body.text.match(/https:\/\/[^\s]+/)?.[0] ?? ''
      throw new Error(`provider failure for legacy@example.test: ${sentLink}`)
    })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const responses = []
    const background: Promise<unknown>[] = []
    for (const email of ['missing@example.test', 'active@example.test', 'legacy@example.test']) {
      const response = await requestRoute(activationRequest(db, '/api/auth/activation/request', { email }, {}, ORIGIN, senderEnv, background))
      responses.push({ status: response.status, body: await response.json() })
    }

    expect(responses).toEqual(Array(3).fill({ status: 200, body: { ok: true } }))
    await Promise.all(background)
    expect(send).toHaveBeenCalledOnce()
    expect(sentLink).toMatch(/^https:\/\/activate\.kuuki\.test\/activate#token=/)
    expect((await db.prepare('SELECT COUNT(*) AS n FROM account_activation_tokens').first<{ n: number }>())?.n).toBe(0)
    const logged = log.mock.calls.flat().join(' ')
    expect(logged).toContain('activation_sender_failed')
    expect(logged).not.toContain(sentLink)
    expect(logged).not.toContain('legacy@example.test')
    expect(logged).not.toContain('provider failure')
  } finally { await dispose() }
})

it('rolls back activation claim, password change, and session revocation on a D1 batch failure', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seedUser(db, 'legacy', 'legacy@example.test')
    await createSession(db, 'legacy')
    const links: string[] = []
    const sender: MailSender = { async send(_to, link) { links.push(link) } }
    await requestActivation(db, 'legacy@example.test', ACTIVATION_ORIGIN, sender)
    await requestActivation(db, 'legacy@example.test', ACTIVATION_ORIGIN, sender)
    const token = new URL(links[0]).hash.slice('#token='.length)
    await db.prepare(`CREATE TRIGGER fail_activation_hash BEFORE UPDATE OF password_hash ON users
      BEGIN SELECT RAISE(ABORT, 'synthetic update failure'); END`).run()
    await expect(completeActivation(db, token, 'new-password', SECRET)).rejects.toThrow()
    expect((await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind('legacy').first<{ password_hash: string }>())?.password_hash).toBe('RESET_REQUIRED')
    expect((await db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').bind('legacy').first<{ n: number }>())?.n).toBe(1)
    expect((await db.prepare('SELECT COUNT(*) AS n FROM account_activation_tokens WHERE user_id = ? AND claim_id IS NULL').bind('legacy').first<{ n: number }>())?.n).toBe(2)
  } finally { await dispose() }
})

it('atomically counts concurrent auth attempts within a fixed window', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    const results = await Promise.allSettled(Array.from({ length: 21 }, () => rateLimit(db, 'signin:test', 20, 900)))
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(20)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect((await db.prepare('SELECT count FROM auth_rate_limits WHERE key = ?').bind('signin:test').first<{ count: number }>())?.count).toBe(21)
  } finally { await dispose() }
})

it('renews session and existing CSRF together, while a handler-owned session wins', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seedUser(db, 'a', 'a@example.test', await hashPassword('password-a', SECRET))
    await seedUser(db, 'b', 'b@example.test', await hashPassword('password-b', SECRET))
    const a = await createSession(db, 'a')
    await db.prepare('UPDATE sessions SET last_seen_at = ? WHERE user_id = ?').bind('2000-01-01T00:00:00.000Z', 'a').run()
    const cookie = `kuuki_session=${a.token}; kuuki_csrf=existing-csrf`
    const request = new Request(`${ORIGIN}/api/auth/me`, { headers: { Cookie: cookie } })
    const renewed = await middleware({ ...apiContext(db, request), next: async () => new Response('ok') } as never)
    const setCookies = renewed.headers.get('Set-Cookie') ?? ''
    expect(setCookies).toContain(`kuuki_session=${a.token}`)
    expect(setCookies).toContain('kuuki_csrf=existing-csrf')

    const b = await createSession(db, 'b')
    await db.prepare('UPDATE sessions SET last_seen_at = ? WHERE user_id = ?').bind('2000-01-01T00:00:00.000Z', 'a').run()
    const switched = await middleware({ ...apiContext(db, request), next: async () => {
      const response = new Response('switched')
      setSessionCookies(response.headers, b.token)
      return response
    } } as never)
    const switchedCookies = switched.headers.get('Set-Cookie') ?? ''
    expect(switchedCookies).toContain(`kuuki_session=${b.token}`)
    expect(switchedCookies).not.toContain(`kuuki_session=${a.token}`)
  } finally { await dispose() }
})

it('renews a missing CSRF on day 29, permits signout on day 31, and expires an inactive session', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seedUser(db, 'active', 'active@example.test', await hashPassword('active-password', SECRET))
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const live = await createSession(db, 'active')
    const inactive = await createSession(db, 'active')
    const liveHash = await sha256Hex(live.token)
    // Only Date is controlled; Miniflare's timers and D1 runtime remain real.
    vi.setSystemTime(new Date('2026-01-30T00:00:00.000Z'))
    const liveRequest = new Request(`${ORIGIN}/api/auth/me`, { headers: { Cookie: `kuuki_session=${live.token}` } })
    const recovered = await middleware({ ...apiContext(db, liveRequest), next: async () => new Response('ok') } as never)
    const setCookies = recovered.headers.get('Set-Cookie') ?? ''
    expect(setCookies).toContain(`kuuki_session=${live.token}`)
    expect(setCookies).toContain('kuuki_csrf=')
    const csrf = /kuuki_csrf=([^;]+)/.exec(setCookies)?.[1]
    expect(csrf).toBeTruthy()
    const renewed = await db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').bind(liveHash).first<{ expires_at: string }>()
    expect(renewed?.expires_at).toBe('2026-03-01T00:00:00.000Z')

    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'))
    const signoutRequest = new Request(`${ORIGIN}/api/auth/signout`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Cookie: `kuuki_session=${live.token}; kuuki_csrf=${csrf}`,
        'X-CSRF-Token': csrf!,
      },
    })
    const signoutContext = apiContext(db, signoutRequest)
    const signedOut = await middleware({ ...signoutContext, next: () => signoutRoute(signoutContext as never) } as never)
    expect(signedOut.status).toBe(200)
    expect((await signedOut.json()) as unknown).toEqual({ ok: true })
    expect((await db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE token_hash = ?').bind(liveHash).first<{ n: number }>())?.n).toBe(0)

    const expiredRequest = new Request(`${ORIGIN}/api/auth/me`, { headers: { Cookie: `kuuki_session=${inactive.token}` } })
    const expired = await middleware({ ...apiContext(db, expiredRequest), next: async () => new Response('anonymous') } as never)
    expect(expired.headers.get('Set-Cookie')).toBeNull()
    expect(await expired.text()).toBe('anonymous')
  } finally { vi.useRealTimers(); await dispose() }
})

it('serves only the token page and completion API on the activation alias before DB access', async () => {
  const db = { prepare: vi.fn(() => { throw Error('DB touched') }) }
  const env = { DB: db, ACTIVATION_ORIGIN, PAGES_ORIGIN: ORIGIN }
  const next = vi.fn(async () => new Response('allowed'))
  for (const path of ['/activate', '/activate.html', '/activate.js']) {
    const response = await middleware({ request: new Request(`${ACTIVATION_ORIGIN}${path}`), env, data: {}, next } as never)
    expect(response.status).toBe(200)
  }
  const complete = await middleware({ request: new Request(`${ACTIVATION_ORIGIN}/api/auth/activation/complete`, { method: 'POST' }), env, data: {}, next } as never)
  expect(complete.status).toBe(200)
  expect(db.prepare).not.toHaveBeenCalled()
  for (const path of ['/', '/sw.js', '/manifest.webmanifest', '/api/auth/me']) {
    const response = await middleware({ request: new Request(`${ACTIVATION_ORIGIN}${path}`), env, data: {}, next } as never)
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(`${ORIGIN}/#`)
  }
  const signIn = await middleware({ request: new Request(`${ACTIVATION_ORIGIN}/?mode=signin&token=discard`), env, data: {}, next } as never)
  expect(signIn.status).toBe(302)
  // The redirect keeps mode=signin for a legacy rollback; the Next card reads only the password-saved notice.
  expect(signIn.headers.get('Location')).toBe(`${ORIGIN}/?mode=signin&notice=password-saved#`)
  expect(signIn.headers.get('Cache-Control')).toBe('no-store')
  expect(signIn.headers.get('Referrer-Policy')).toBe('no-referrer')
  const forbidden = await middleware({ request: new Request(`${ACTIVATION_ORIGIN}/api/auth/signin`, { method: 'POST' }), env, data: {}, next } as never)
  expect(forbidden.status).toBe(403)
  expect(db.prepare).not.toHaveBeenCalled()
})

it('leaves cookies intact when signout fails to revoke the session', async () => {
  const request = new Request(`${ORIGIN}/api/auth/signout`, {
    method: 'POST',
    headers: { Origin: ORIGIN, Cookie: 'kuuki_session=token; kuuki_csrf=csrf', 'X-CSRF-Token': 'csrf' },
  })
  const response = await signoutRoute({
    ...apiContext({ prepare() { throw new Error('D1 unavailable') } } as never, request),
  } as never)
  expect(response.status).toBe(500)
  expect(response.headers.get('Set-Cookie')).toBeNull()
})

it('rejects malformed password-hash parameters without calling PBKDF2', async () => {
  const valid = await hashPassword('password', SECRET)
  const parts = valid.split('$')
  for (const changed of [
    [1, 'v2'], [3, '100000junk'], [3, '100001'], [3, '-1'], [4, 'AA=='], [5, 'AA=='],
  ] as const) {
    const copy = [...parts]
    copy[changed[0]] = changed[1]
    expect(await verifyPassword('password', copy.join('$'), SECRET)).toBe(false)
  }
})
