// Isolated synthetic app fixture for functional browser checks on real local workerd.
// Build the web app and Pages Functions first. No .dev.vars, snapshot, or cloud bindings.
import { resolve } from 'node:path'
import { Miniflare, Log, LogLevel, Request as WorkerRequest, Response as WorkerResponse } from 'miniflare'
import { applyMigrations } from './_migrations'

const port = Number(process.env.KUUKI_SMOKE_PORT ?? 8799)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid KUUKI_SMOKE_PORT')
const checkOnly = process.argv.includes('--check')
const origin = checkOnly ? 'https://app.fixture.test' : `http://localhost:${port}`
let mailCalls = 0
const fixtureFlight = {
  date: '2026-01-03', origin: 'JFK', destination: 'BOS', airline_iata: 'AA',
  flight_number: '100', aircraft_icao: '', departure_time: '10:00', arrival_time: '11:30',
  confidence: 0.8, field_confidence: { date_year_explicit: true },
}
const mf = new Miniflare({
  name: 'kuuki-fixture',
  log: new Log(LogLevel.WARN),
  modules: true,
  scriptPath: resolve('.wrangler/functions-build/index.js'),
  compatibilityDate: '2026-01-01',
  compatibilityFlags: ['nodejs_compat'],
  host: '127.0.0.1', port,
  d1Databases: { DB: 'kuuki-synthetic-browser-fixture' },
  bindings: {
    AUTH_SECRET: 'synthetic-browser-pepper', BETTER_AUTH_SECRET: 'synthetic-better-auth-secret-for-runtime-proof', PAGES_ORIGIN: origin,
    GEMINI_API_KEY: 'synthetic-provider-key',
    ...(checkOnly ? {
      ACTIVATION_ORIGIN: 'https://activate.fixture.test',
      ACTIVATION_MAIL_ACCOUNT_ID: '00000000000000000000000000000001',
      ACTIVATION_MAIL_AUTH_TOKEN: 'synthetic-mail-token',
      ACTIVATION_MAIL_FROM: 'accounts@example.test',
    } : {}),
  },
  assets: {
    workerName: 'kuuki-fixture',
    directory: resolve('apps/web/dist'), binding: 'ASSETS',
    routerConfig: { invoke_user_worker_ahead_of_assets: true, has_user_worker: true },
    assetConfig: { not_found_handling: 'single-page-application' },
  },
  outboundService: async (request: WorkerRequest) => {
    const url = new URL(request.url)
    if (checkOnly && url.href === 'https://api.cloudflare.com/client/v4/accounts/00000000000000000000000000000001/email/sending/send') {
      const body = await request.json() as { from: string; to: string[]; text: string }
      if (body.from !== 'accounts@example.test' || body.to.length !== 1 || body.to[0] !== 'legacy@example.test' ||
          !body.text.includes('https://activate.fixture.test/activate#token=')) {
        return new WorkerResponse('Invalid synthetic mail payload', { status: 400 })
      }
      mailCalls++
      return new WorkerResponse(JSON.stringify({ success: true, errors: [], result: {
        delivered: [], queued: body.to, permanent_bounces: [],
      } }), { headers: { 'Content-Type': 'application/json' } })
    }
    // Deny other external destinations except this deterministic provider response.
    if (url.hostname !== 'generativelanguage.googleapis.com') return new WorkerResponse('External calls disabled', { status: 502 })
    const body = await request.text()
    if (body.includes('FAKE_PROVIDER_QUOTA')) {
      return new WorkerResponse(JSON.stringify({ error: { code: 429, message: 'Synthetic quota exceeded', status: 'RESOURCE_EXHAUSTED' } }), { status: 429 })
    }
    if (body.includes('FAKE_MODEL_MISSING')) {
      return new WorkerResponse(JSON.stringify({ error: { code: 404, message: 'Synthetic model unavailable', status: 'NOT_FOUND' } }), { status: 404 })
    }
    if (body.includes('google_search') || body.includes('googleSearch')) {
      return new WorkerResponse(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ results: [{ index: 1, icao: null, name: null, confidence: 0 }] }) }] } }] }), { headers: { 'Content-Type': 'application/json' } })
    }
    const text = JSON.stringify({ flights: [fixtureFlight] })
    return new WorkerResponse(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
})

async function main() {
try {
  const db = await mf.getD1Database('DB')
  await applyMigrations(db)
  await db.batch([
    ...[
      ['JFK', 'John F Kennedy', 'New York', 40.6413, -73.7781],
      ['LAX', 'Los Angeles', 'Los Angeles', 33.9416, -118.4085],
      ['BOS', 'Logan', 'Boston', 42.3656, -71.0096],
    ].map(([iata, name, city, lat, lon]) => db.prepare(
      'INSERT INTO airports_reference(iata,name,city,country,country_code,latitude,longitude) VALUES(?,?,?,\'United States\',\'US\',?,?)',
    ).bind(iata, name, city, lat, lon)),
    db.prepare("INSERT INTO aircraft_reference(icao,name,manufacturer,model,type,engine_type,engine_count) VALUES('B738','Boeing 737-800','Boeing','737-800','narrowbody','jet',2)"),
    db.prepare("INSERT INTO _code_adjectives(word) VALUES('calm'),('bright'),('swift')"),
    db.prepare("INSERT INTO _code_nouns(word) VALUES('cloud'),('wing'),('sky')"),
  ])
  // Hashing and signup happen inside the compiled workerd API, rather than in Node.
  for (const [email, username] of [['a@example.test', 'fixture-a'], ['b@example.test', 'fixture-b']]) {
    const response = await mf.dispatchFetch(`${origin}/api/auth/sign-up/email`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'rehearsal-password-2026' }),
    })
    if (!response.ok) throw new Error(`Synthetic signup failed: ${response.status} ${await response.text()}`)
    const result = await response.json() as { user: { id: string } }
    await db.prepare('UPDATE profiles SET username = ?, display_name = ? WHERE id = ?').bind(username, username, result.user.id).run()
  }
  await mf.ready
  if (checkOnly) {
    await db.prepare("INSERT INTO users(id,email,password_hash) VALUES('legacy-fixture','legacy@example.test','RESET_REQUIRED')").run()
    const activation = await mf.dispatchFetch(`${origin}/api/auth/activation/request`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'legacy@example.test' }),
    })
    if (!activation.ok) throw new Error('Compiled activation request failed')
    // waitUntil continues after dispatchFetch returns. Observe its D1 write and
    // fake provider acknowledgement before asserting the compiled tail completed.
    const deliveryDeadline = Date.now() + 5_000
    let issued = 0
    while (Date.now() < deliveryDeadline) {
      issued = (await db.prepare("SELECT COUNT(*) AS n FROM account_activation_tokens WHERE user_id = 'legacy-fixture'").first<{ n: number }>())?.n ?? 0
      if (mailCalls === 1 && issued === 1) break
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    if (mailCalls !== 1 || issued !== 1) throw new Error('Compiled activation sender failed')
    const signin = await mf.dispatchFetch(`${origin}/api/auth/sign-in/email`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.test', password: 'rehearsal-password-2026' }),
    })
    if (!signin.ok) throw new Error(`Workerd sign-in failed: ${signin.status}`)
    const setCookie = signin.headers.get('Set-Cookie') ?? ''
    const session = /kuuki_auth_session=([^;]+)/.exec(setCookie)?.[1]
    const csrf = /kuuki_csrf=([^;]+)/.exec(setCookie)?.[1]
    if (!session || !csrf) throw new Error('Workerd sign-in did not set both cookies')
    const sessionCookieName = origin.startsWith('https:') ? '__Secure-kuuki_auth_session' : 'kuuki_auth_session'
    const cookie = `${sessionCookieName}=${session}; kuuki_csrf=${csrf}`
    const me = await mf.dispatchFetch(`${origin}/api/auth/me`, { headers: { Cookie: cookie } })
    const identity = await me.json() as { user: { email: string } | null }
    if (!me.ok || identity.user?.email !== 'a@example.test') throw new Error('Workerd cookie identity mismatch')
    const mutationHeaders = { Origin: origin, Cookie: cookie, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' }
    for (const [type, content] of [['text', '2026-01-03 JFK BOS AA100'], ['image', '/9j/'], ['pdf', 'JVBERi0xLjQ=']]) {
      const response = await mf.dispatchFetch(`${origin}/api/import/parse`, {
        method: 'POST', headers: mutationHeaders, body: JSON.stringify({ type, content }),
      })
      const result = await response.json() as { flights?: unknown[] }
      if (!response.ok || result.flights?.length !== 1) throw new Error(`Compiled ${type} import/SDK contract failed: ${response.status}`)
    }
    for (const [content, expectedCode] of [['FAKE_PROVIDER_QUOTA', 'PROVIDER_QUOTA'], ['FAKE_MODEL_MISSING', 'MODEL_UNAVAILABLE']]) {
      const response = await mf.dispatchFetch(`${origin}/api/import/parse`, {
        method: 'POST', headers: mutationHeaders, body: JSON.stringify({ type: 'text', content }),
      })
      const result = await response.json() as { code?: string }
      if (response.ok || result.code !== expectedCode) throw new Error(`Compiled provider error contract failed: ${response.status}`)
    }
    const input = { date: '2026-01-03', origin: 'JFK', destination: 'LAX' }
    const createHeaders = { ...mutationHeaders, 'Idempotency-Key': 'compiled-flight-001' }
    const created = await mf.dispatchFetch(`${origin}/api/flights`, { method: 'POST', headers: createHeaders, body: JSON.stringify(input) })
    const saved = await created.json() as { id: number; distance_km: number; derived_state: string }
    if (created.status !== 201 || saved.derived_state !== 'ready') throw new Error('Compiled flight create/repair failed')
    const replay = await mf.dispatchFetch(`${origin}/api/flights`, { method: 'POST', headers: createHeaders, body: JSON.stringify(input) })
    if (replay.status !== 200 || (await replay.json() as { id: number }).id !== saved.id) throw new Error('Compiled flight replay failed')
    const patched = await mf.dispatchFetch(`${origin}/api/flights/${saved.id}`, { method: 'PATCH', headers: mutationHeaders, body: JSON.stringify({ destination: 'BOS' }) })
    const changed = await patched.json() as { distance_km: number; derived_state: string }
    if (!patched.ok || changed.distance_km >= saved.distance_km || changed.derived_state !== 'ready') throw new Error('Compiled route recalculation failed')
    const forbidden = await mf.dispatchFetch(`${origin}/api/auth/sign-out`, {
      method: 'POST', headers: { Origin: origin, Cookie: cookie },
    })
    if (forbidden.status !== 403) throw new Error('Workerd accepted missing CSRF')
    const signout = await mf.dispatchFetch(`${origin}/api/auth/sign-out`, {
      method: 'POST', headers: { Origin: origin, Cookie: cookie, 'X-CSRF-Token': csrf },
    })
    if (!signout.ok) throw new Error(`Workerd signout failed: ${signout.status}`)
    const revoked = await mf.dispatchFetch(`${origin}/api/auth/me`, { headers: { Cookie: cookie } })
    const revokedIdentity = await revoked.json() as { user: unknown }
    if (revokedIdentity.user !== null) throw new Error('Workerd did not revoke session')
    console.log('Compiled workerd proof passed: activation sender, hash/cookies/identity/CSRF/revocation, create/replay/route repair, text/image/PDF SDK integration and provider errors; isolated synthetic D1, no external calls.')
  } else {
  console.log(`Synthetic fixture ready: ${origin}`)
  console.log('Accounts a@example.test / b@example.test; password rehearsal-password-2026. All external calls are faked or denied. Ctrl-C stops and discards the database.')
  await new Promise<void>(resolve => {
    process.once('SIGINT', resolve)
    process.once('SIGTERM', resolve)
  })
  }
} finally {
  await mf.dispose()
}
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Synthetic runtime failed')
  process.exitCode = 1
})
