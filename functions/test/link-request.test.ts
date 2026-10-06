import { expect, it, vi, afterEach } from 'vitest'
import { createApiDatabase } from './harness'
import { createUserWithProfile } from '../api/_lib/users'
import { onRequestPost as linkRequest } from '../api/auth/link/request'

const ORIGIN = 'https://kuuki.test'
const ACTIVATION_ORIGIN = 'https://activate.kuuki.test'
const SECRET = 'synthetic-link-pepper'
const senderEnv = { ACTIVATION_MAIL_ACCOUNT_ID: '0123456789abcdef0123456789abcdef', ACTIVATION_MAIL_AUTH_TOKEN: 'test-token', ACTIVATION_MAIL_FROM: 'sender@example.test' }

afterEach(() => vi.restoreAllMocks())

function env(db: D1Database, extra: Record<string, string> = {}) {
  return { DB: db, AUTH_SECRET: SECRET, PAGES_ORIGIN: ORIGIN, ACTIVATION_ORIGIN, ...senderEnv, ...extra } as Env
}

async function post(db: D1Database, body: unknown, options: { extra?: Record<string, string>; headers?: Record<string, string>; background?: Promise<unknown>[] } = {}) {
  const request = new Request(`${ORIGIN}/api/auth/link/request`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body),
  })
  const background = options.background ?? []
  return linkRequest({ request, env: env(db, options.extra), waitUntil: (task: Promise<unknown>) => { background.push(task) } } as never)
}

function mockMail(...recipients: string[]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response(JSON.stringify({ success: true, errors: [], result: { delivered: [], queued: recipients, permanent_bounces: [] } })))
}

function sent(send: ReturnType<typeof mockMail>) {
  return send.mock.calls.map(call => JSON.parse(String(call[1]?.body)) as { subject: string; text: string; to: string[] })
}

async function seed(db: D1Database) {
  await db.batch([
    db.prepare(`INSERT INTO users(id,email,password_hash) VALUES('pending','pending@example.test','RESET_REQUIRED')`),
    db.prepare(`INSERT INTO profiles(id) VALUES('pending')`),
  ])
  await createUserWithProfile(db, { email: 'active@example.test', password: 'old-password' }, SECRET)
}

it('returns the same generic result for every account state and mails only the matching link', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const send = mockMail('pending@example.test', 'active@example.test')
    const background: Promise<unknown>[] = []
    for (const email of ['missing@example.test', 'pending@example.test', 'active@example.test']) {
      const response = await post(db, { email }, { background })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ok: true })
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
    }
    await Promise.all(background)
    const mails = sent(send)
    expect(mails).toHaveLength(2)
    const activation = mails.find(mail => mail.to[0] === 'pending@example.test')!
    expect(activation.subject).toBe('Activate your Kuuki account')
    expect(activation.text).toContain(`${ACTIVATION_ORIGIN}/activate#token=`)
    const reset = mails.find(mail => mail.to[0] === 'active@example.test')!
    expect(reset.subject).toBe('Reset your Kuuki password')
    expect(reset.text).toContain(`${ORIGIN}/reset-password#token=`)
  } finally { await dispose() }
})

it('rejects malformed emails and foreign origins without sending', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    await seed(db)
    const send = mockMail('active@example.test')
    for (const body of [{}, { email: 42 }, { email: 'not-an-email' }, { email: `${'a'.repeat(320)}@example.test` }]) {
      const response = await post(db, body)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'INVALID_EMAIL' })
    }
    const foreign = await post(db, { email: 'active@example.test' }, { headers: { Origin: 'https://evil.test' } })
    expect(foreign.status).toBe(403)
    expect(send).not.toHaveBeenCalled()
  } finally { await dispose() }
})

it('limits each IP to 10 requests an hour', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    mockMail()
    const headers = { 'CF-Connecting-IP': '203.0.113.10' }
    for (let attempt = 0; attempt < 10; attempt++) {
      expect((await post(db, { email: `person${attempt}@example.test` }, { headers })).status).toBe(200)
    }
    const limited = await post(db, { email: 'person10@example.test' }, { headers })
    expect(limited.status).toBe(429)
    expect(await limited.json()).toMatchObject({ code: 'RATE_LIMITED' })
    expect((await post(db, { email: 'person10@example.test' }, { headers: { 'CF-Connecting-IP': '203.0.113.11' } })).status).toBe(200)
  } finally { await dispose() }
})

it('limits each email to 3 requests an hour across IPs, ignoring case', async () => {
  const { db, dispose } = await createApiDatabase()
  try {
    mockMail()
    const emails = ['person@example.test', 'Person@Example.test', ' person@example.test', 'PERSON@example.test']
    for (const [index, email] of emails.slice(0, 3).entries()) {
      expect((await post(db, { email }, { headers: { 'CF-Connecting-IP': `203.0.113.${20 + index}` } })).status).toBe(200)
    }
    const limited = await post(db, { email: emails[3] }, { headers: { 'CF-Connecting-IP': '203.0.113.30' } })
    expect(limited.status).toBe(429)
    expect(await limited.json()).toMatchObject({ code: 'RATE_LIMITED' })
    const keys = await db.prepare(`SELECT key FROM auth_rate_limits WHERE key LIKE 'link-email:%'`).all<{ key: string }>()
    expect(keys.results).toHaveLength(1)
    expect(keys.results[0].key).not.toContain('person')
  } finally { await dispose() }
})

const unconfigured: Record<string, Record<string, string>> = {
  'activation origin missing': { ACTIVATION_ORIGIN: '' },
  'activation origin equal to the main origin': { ACTIVATION_ORIGIN: ORIGIN },
  'recovery origin not https': { PAGES_ORIGIN: 'not-an-origin' },
  'mail sender missing': { ACTIVATION_MAIL_AUTH_TOKEN: '' },
}

for (const [name, extra] of Object.entries(unconfigured)) {
  it(`returns the same 503 before any lookup for known and unknown emails when ${name}`, async () => {
    const { db, dispose } = await createApiDatabase()
    try {
      await seed(db)
      const send = mockMail('pending@example.test', 'active@example.test')
      const results: Array<{ status: number; body: unknown }> = []
      for (const email of ['missing@example.test', 'pending@example.test', 'active@example.test']) {
        const response = await post(db, { email }, { extra })
        results.push({ status: response.status, body: await response.json() })
      }
      expect(results[0].status).toBe(503)
      expect(results[1]).toEqual(results[0])
      expect(results[2]).toEqual(results[0])
      expect(send).not.toHaveBeenCalled()
      expect((await db.prepare('SELECT COUNT(*) AS n FROM auth_rate_limits').first<{ n: number }>())?.n).toBe(0)
      expect((await db.prepare('SELECT COUNT(*) AS n FROM account_activation_tokens').first<{ n: number }>())?.n).toBe(0)
    } finally { await dispose() }
  })
}
