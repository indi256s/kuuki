import { airportAssetPaths } from '../apps/next/src/lib/airport-models/catalog.generated'
// Production-mode custom Worker on local workerd. Synthetic D1, no live secrets or outbound calls.
import { execFileSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import {
  Miniflare,
  Log,
  LogLevel,
  Request as WorkerRequest,
  Response as WorkerResponse,
} from 'miniflare'
import { applyMigrations } from './_migrations'
import { freePort } from './free-port'
import { seedGroundJourneys } from './fixtures/ground'
import { seedLeaderboard } from './fixtures/leaderboard'
import { REAL_ACCOUNT_EMAIL, readRealSnapshot, seedRealAccount } from './fixtures/real-account'
import { hashPassword, sha256Hex } from '../functions/api/_lib/crypto'
import { SESSION_TTL_SECONDS } from '../functions/api/_lib/cookies'
import { refreshLeaderboards } from '../functions/api/_services/leaderboard'

const root = resolve('.')
// An explicit KUUKI_NEXT_PORT is strict; otherwise 8800 when free, else any free port.
const port = Number(process.env.KUUKI_NEXT_PORT ?? freePort(8800))
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Invalid KUUKI_NEXT_PORT')
const boundaryOnly = process.argv.includes('--check-boundary')
const check = process.argv.includes('--check') || boundaryOnly
const nextOnly = process.argv.includes('--next-only')
const origin = check ? 'https://app.fixture.test' : `http://127.0.0.1:${port}`
const bundleDir = join(root, nextOnly ? '.wrangler/next-only' : '.wrangler/next-build')
const assetsDir = join(root, 'apps/next/.open-next/assets')
let mailCalls = 0
let unexpectedOutboundCalls = 0
const analyticsOwnerId = 'analytics-owner-fixture'
let analyticsCookie = ''

execFileSync(
  'pnpm',
  [
    '--filter',
    '@kuuki/next',
    'exec',
    'wrangler',
    'deploy',
    ...(nextOnly ? ['.open-next/worker.js'] : []),
    '--dry-run',
    '--env',
    '',
    '--config',
    'wrangler.toml',
    '--outdir',
    bundleDir,
  ],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  },
)
const bundle = readdirSync(bundleDir).find((name) => /^worker\.(?:js|mjs)$/.test(name))
if (!bundle) throw new Error('Wrangler dry-run Worker bundle missing')
const modules = [
  { type: 'ESModule' as const, path: join(bundleDir, bundle) },
  ...readdirSync(bundleDir)
    .filter((name) => name.endsWith('.wasm'))
    .map((name) => ({ type: 'CompiledWasm' as const, path: join(bundleDir, name) })),
]

const mf = new Miniflare({
  name: 'kuuki-next-fixture',
  log: new Log(LogLevel.WARN),
  modules,
  compatibilityDate: '2026-08-06',
  compatibilityFlags: ['nodejs_compat'],
  host: '127.0.0.1',
  port,
  d1Databases: { DB: 'kuuki-next-synthetic-fixture' },
  bindings: {
    AUTH_SECRET: 'synthetic-browser-pepper',
    BETTER_AUTH_SECRET: 'synthetic-better-auth-secret-for-runtime-proof',
    GOOGLE_CLIENT_ID: 'synthetic-google-client',
    GOOGLE_CLIENT_SECRET: 'synthetic-google-secret',
    PAGES_ORIGIN: origin,
    MAINTENANCE_MODE: 'false',
    ADMIN_USER_ID: analyticsOwnerId,
    ...(check
      ? {
          ACTIVATION_ORIGIN: 'https://activate.fixture.test',
          ACTIVATION_MAIL_ACCOUNT_ID: '00000000000000000000000000000001',
          ACTIVATION_MAIL_AUTH_TOKEN: 'synthetic-mail-token',
          ACTIVATION_MAIL_FROM: 'accounts@example.test',
        }
      : {}),
    GEMINI_API_KEY: 'synthetic-provider-key',
  },
  // Browser layout checks need the production shell's binding-presence gate.
  // Import HTTP endpoints remain explicit test doubles; no job execution is supplied.
  serviceBindings:
    process.env.KUUKI_NEXT_DOCK_FIXTURE === '1'
      ? {
          IMPORT_JOBS: async () =>
            new WorkerResponse('Import execution unavailable in layout fixture', { status: 503 }),
        }
      : {},
  assets: {
    workerName: 'kuuki-next-fixture',
    directory: assetsDir,
    binding: 'ASSETS',
    routerConfig: { invoke_user_worker_ahead_of_assets: true, has_user_worker: true },
    assetConfig: { not_found_handling: 'none' },
  },
  outboundService: async (request: WorkerRequest) => {
    if (
      check &&
      request.url ===
        'https://api.cloudflare.com/client/v4/accounts/00000000000000000000000000000001/email/sending/send'
    ) {
      const body = (await request.json()) as { from: string; to: string[]; text: string }
      if (
        body.from !== 'accounts@example.test' ||
        body.to[0] !== 'reset@example.test' ||
        !body.text.includes('https://activate.fixture.test/activate#token=')
      )
        return new WorkerResponse('Bad synthetic mail', { status: 400 })
      mailCalls++
      return new WorkerResponse(
        JSON.stringify({
          success: true,
          errors: [],
          result: { delivered: [], queued: body.to, permanent_bounces: [] },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }
    unexpectedOutboundCalls++
    return new WorkerResponse('Outbound network disabled in Next fixture', { status: 502 })
  },
})

type FixtureRequestInit = Parameters<typeof mf.dispatchFetch>[1]

async function request(path: string, init?: FixtureRequestInit) {
  return mf.dispatchFetch(new URL(path, origin).toString(), init)
}
async function assertResponse(path: string, expected: number, init?: FixtureRequestInit) {
  const response = await request(path, init)
  if (response.status !== expected)
    throw new Error(
      `${path}: expected ${expected}, got ${response.status}: ${(await response.text()).slice(0, 300)}`,
    )
  return response
}

function artifact() {
  let bytes = 0,
    gzipBytes = 0,
    count = 0
  function walk(path: string) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (!file.endsWith('.map') && !file.endsWith('.md')) {
        const data = readFileSync(file)
        bytes += data.length
        gzipBytes += gzipSync(data).length
        count++
      }
    }
  }
  walk(bundleDir)
  let assets = 0,
    assetBytes = 0
  function walkAssets(path: string) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name)
      if (entry.isDirectory()) walkAssets(file)
      else {
        assets++
        assetBytes += statSync(file).size
      }
    }
  }
  walkAssets(assetsDir)
  return {
    node: process.version,
    workerModules: count,
    workerBytes: bytes,
    workerGzipBytes: gzipBytes,
    staticAssets: assets,
    staticBytes: assetBytes,
    next: '16.3.8',
    openNext: '1.20.10',
    compatibilityDate: '2026-08-06',
  }
}

async function maintenanceProbe() {
  const hold = new Miniflare({
    name: 'kuuki-next-maintenance-probe',
    modules,
    compatibilityDate: '2026-08-06',
    compatibilityFlags: ['nodejs_compat'],
    bindings: { PAGES_ORIGIN: origin, MAINTENANCE_MODE: 'true' },
    outboundService: async () => new WorkerResponse('Outbound disabled', { status: 502 }),
  })
  try {
    for (const path of [
      '/api/auth/me',
      '/overview',
      '/airports/TBS',
      '/journal',
      '/ground-travel',
      '/passport',
    ]) {
      const response = await hold.dispatchFetch(new URL(path, origin).toString(), {
        redirect: 'manual',
      })
      if (
        response.status !== 503 ||
        response.headers.get('Retry-After') !== '300' ||
        response.headers.get('Cache-Control') !== 'no-store'
      ) {
        throw new Error(`Maintenance gate failed before D1 for ${path}: ${response.status}`)
      }
    }
  } finally {
    await hold.dispose()
  }
}

// Preview journal for a@example.test. Flights go through the bulk endpoint, so the API derives distance, duration and
// zones from these airports as it does for a member. Playwright and the bench set KUUKI_NEXT_FIXTURE=minimal.
const JOURNAL_AIRPORTS = [
  ['LHR', 'London Heathrow Airport', 'London', 'United Kingdom', 'GB', 51.47, -0.4543],
  ['ORD', "O'Hare International Airport", 'Chicago', 'United States', 'US', 41.9742, -87.9073],
  [
    'SFO',
    'San Francisco International Airport',
    'San Francisco',
    'United States',
    'US',
    37.6213,
    -122.379,
  ],
  [
    'LAX',
    'Los Angeles International Airport',
    'Los Angeles',
    'United States',
    'US',
    33.9425,
    -118.4081,
  ],
  ['CDG', 'Charles de Gaulle Airport', 'Paris', 'France', 'FR', 49.0097, 2.5479],
  ['FRA', 'Frankfurt Airport', 'Frankfurt', 'Germany', 'DE', 50.0379, 8.5622],
  ['DXB', 'Dubai International Airport', 'Dubai', 'United Arab Emirates', 'AE', 25.2532, 55.3657],
  ['NRT', 'Narita International Airport', 'Tokyo', 'Japan', 'JP', 35.772, 140.3929],
]
const JOURNAL_AIRCRAFT = [
  ['B738', 'Boeing 737-800', 'Boeing', '737-800', 'narrowbody'],
  ['B789', 'Boeing 787-9', 'Boeing', '787-9', 'widebody'],
  ['A359', 'Airbus A350-900', 'Airbus', 'A350-900', 'widebody'],
]
// [date, origin, destination, airline, flight number, aircraft]; the aircraft is optional.
const JOURNAL_FLIGHTS: Array<
  [
    date: string,
    origin: string,
    destination: string,
    airline: string,
    number: string,
    aircraft?: string,
  ]
> = [
  ['2024-02-10', 'JFK', 'LHR', 'BA', '112', 'B789'],
  ['2024-02-17', 'LHR', 'JFK', 'BA', '117', 'B789'],
  ['2024-04-06', 'BOS', 'ORD', 'UA', '1376', 'A320'],
  ['2024-04-08', 'ORD', 'SFO', 'UA', '1502', 'B738'],
  ['2024-04-11', 'SFO', 'LAX', 'UA', '1181', 'A320'],
  ['2024-04-14', 'LAX', 'JFK', 'AA', '17'],
  ['2024-07-19', 'JFK', 'CDG', 'AF', '22', 'A359'],
  ['2024-07-27', 'CDG', 'JFK', 'AF', '23', 'A359'],
  ['2024-08-02', 'CDG', 'FRA', 'LH', '1218'],
  ['2024-08-05', 'FRA', 'BOS', 'LH', '400', 'B789'],
  ['2024-10-12', 'BOS', 'JFK', 'DL', '5260', 'A320'],
  ['2024-12-22', 'JFK', 'IST', 'TK', '1', 'A359'],
  ['2024-12-24', 'IST', 'TBS', 'TK', '1822', 'A320'],
  ['2025-01-02', 'TBS', 'IST', 'TK', '1823'],
  ['2025-01-03', 'IST', 'JFK', 'TK', '2', 'B789'],
  ['2025-05-17', 'JFK', 'DXB', 'EK', '201', 'B789'],
  ['2025-05-19', 'DXB', 'NRT', 'EK', '318', 'A359'],
  ['2025-05-25', 'NRT', 'SFO', 'UA', '837', 'B789'],
  ['2025-05-27', 'SFO', 'BOS', 'UA', '2155', 'B738'],
  ['2025-09-14', 'BOS', 'ORD', 'AA', '3311', 'A320'],
  ['2026-02-14', 'ORD', 'LAX', 'AA', '2216', 'B738'],
  ['2026-03-21', 'LAX', 'SFO', 'UA', '1192', 'A320'],
  ['2026-05-10', 'SFO', 'JFK', 'B6', '512', 'A320'],
  ['2026-06-18', 'JFK', 'LHR', 'BA', '112', 'B789'],
  ['2026-06-25', 'LHR', 'CDG', 'AF', '1080'],
  ['2026-07-04', 'CDG', 'BOS', 'AF', '338', 'A359'],
]

async function seedJournal(db: D1Database, cookie: string, csrf: string) {
  await db.batch([
    ...JOURNAL_AIRPORTS.map(([iata, name, city, country, countryCode, latitude, longitude]) =>
      db
        .prepare(
          'INSERT INTO airports_reference(iata,name,city,country,country_code,latitude,longitude) VALUES(?,?,?,?,?,?,?)',
        )
        .bind(iata, name, city, country, countryCode, latitude, longitude),
    ),
    ...JOURNAL_AIRCRAFT.map(([icao, name, manufacturer, model, type]) =>
      db
        .prepare(
          "INSERT INTO aircraft_reference(icao,name,manufacturer,model,type,engine_type,engine_count) VALUES(?,?,?,?,?,'jet',2)",
        )
        .bind(icao, name, manufacturer, model, type),
    ),
  ])
  const response = await request('/api/flights/bulk', {
    method: 'POST',
    headers: {
      Origin: origin,
      Cookie: cookie,
      'X-CSRF-Token': csrf,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: JOURNAL_FLIGHTS.map(
        ([date, from, to, airline_iata, flight_number, aircraft_icao], index) => ({
          key: `next-fixture-flight-${String(index + 2).padStart(3, '0')}`,
          flight: {
            date,
            origin: from,
            destination: to,
            airline_iata,
            flight_number,
            aircraft_icao,
          },
        }),
      ),
    }),
  })
  const body = (await response.json()) as { results?: Array<{ status: string }> }
  const created = body.results?.filter((result) => result.status === 'created').length
  if (!response.ok || created !== JOURNAL_FLIGHTS.length)
    throw new Error(`Synthetic journal create failed: ${response.status} ${JSON.stringify(body)}`)
  await seedGroundJourneys(request, origin, cookie, csrf)
}

async function main() {
  try {
    if (nextOnly) {
      await mf.ready
      const bootstrap = await fetch(`http://127.0.0.1:${port}/bootstrap.js`)
      console.log(
        JSON.stringify({
          nextOnly: true,
          bootstrapStatus: bootstrap.status,
          bootstrapType: bootstrap.headers.get('Content-Type'),
          bootstrapBody: (await bootstrap.text()).slice(0, 100),
        }),
      )
      const shell = await fetch(`http://127.0.0.1:${port}/`)
      console.log(
        JSON.stringify({
          nextOnly: true,
          status: shell.status,
          body: (await shell.text()).slice(0, 300),
        }),
      )
      if (shell.status !== 200) throw new Error('Direct OpenNext worker did not serve public shell')
      return
    }
    const db = await mf.getD1Database('DB')
    await applyMigrations(db)
    await db.batch([
      db.prepare(
        "INSERT INTO airports_reference(iata,name,city,country,country_code,latitude,longitude) VALUES('JFK','John F Kennedy','New York','United States','US',40.6413,-73.7781)",
      ),
      db.prepare(
        "INSERT INTO airports_reference(iata,name,city,country,country_code,latitude,longitude) VALUES('BOS','Logan','Boston','United States','US',42.3656,-71.0096)",
      ),
      db.prepare(
        "INSERT INTO airports_reference(iata,name,city,country,country_code,latitude,longitude) VALUES('TBS','Tbilisi International Airport','Tbilisi','Georgia','GE',41.6692008972,44.95470047)",
      ),
      db.prepare(
        "INSERT INTO airports_reference(iata,name,city,country,country_code,latitude,longitude) VALUES('IST','Istanbul Airport','Istanbul','Turkey','TR',41.2753,28.7519)",
      ),
      db.prepare(
        "INSERT INTO aircraft_reference(icao,name,manufacturer,model,type,engine_type,engine_count) VALUES('A320','Airbus A320','Airbus','A320','narrowbody','jet',2)",
      ),
      db.prepare("INSERT INTO _code_adjectives(word) VALUES('calm'),('bright'),('swift')"),
      db.prepare("INSERT INTO _code_nouns(word) VALUES('cloud'),('wing'),('sky')"),
    ])
    for (const [email, username] of [
      ['a@example.test', 'fixture-a'],
      ['b@example.test', 'fixture-b'],
      ['recovery@example.test', 'fixture-recovery'],
    ]) {
      const signup = await request('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'rehearsal-password-2026' }),
      })
      if (!signup.ok)
        throw new Error(`Synthetic signup failed: ${signup.status} ${await signup.text()}`)
      const result = (await signup.json()) as { user: { id: string } }
      await db
        .prepare(
          'UPDATE profiles SET username = ?, display_name = ?, onboarded_at = created_at WHERE id = ?',
        )
        .bind(username, username, result.user.id)
        .run()
    }
    // A credential row written before Better Auth cutover must still authenticate.
    const legacyId = analyticsOwnerId
    const legacyHash = await hashPassword('rehearsal-password-2026', 'synthetic-browser-pepper')
    const now = new Date().toISOString()
    await db.batch([
      db
        .prepare(
          'INSERT INTO users(id,email,password_hash,name,email_verified,updated_at) VALUES(?,?,?,?,?,?)',
        )
        .bind(legacyId, 'legacy@example.test', legacyHash, 'legacy-fixture', 1, now),
      db
        .prepare('INSERT INTO profiles(id,username,display_name,onboarded_at) VALUES(?,?,?,?)')
        .bind(legacyId, 'legacy-fixture', 'legacy-fixture', now),
      db
        .prepare(
          'INSERT INTO auth_accounts(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)',
        )
        .bind(`credential:${legacyId}`, legacyId, 'credential', legacyId, legacyHash, now, now),
    ])
    if (check) {
      const legacySignIn = await request('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'legacy@example.test', password: 'rehearsal-password-2026' }),
      })
      if (!legacySignIn.ok)
        throw new Error(
          `Composed legacy credential sign-in failed: ${legacySignIn.status} ${await legacySignIn.text()}`,
        )
      analyticsCookie = legacySignIn.headers
        .getSetCookie()
        .map((value) => value.split(';', 1)[0])
        .join('; ')
      await db
        .prepare(
          "INSERT INTO users(id,email,password_hash) VALUES('reset-fixture','reset@example.test','RESET_REQUIRED')",
        )
        .run()
      const activationRequest = await request('/api/auth/activation/request', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'reset@example.test' }),
      })
      if (!activationRequest.ok)
        throw new Error(`Composed activation request failed: ${activationRequest.status}`)
      const deadline = Date.now() + 5_000
      let tokens = 0
      while (Date.now() < deadline) {
        tokens =
          (
            await db
              .prepare(
                "SELECT COUNT(*) AS n FROM account_activation_tokens WHERE user_id='reset-fixture'",
              )
              .first<{ n: number }>()
          )?.n ?? 0
        if (tokens === 1 && mailCalls === 1) break
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      if (tokens !== 1 || mailCalls !== 1)
        throw new Error('Composed waitUntil activation delivery did not complete')
    }
    const seedSignIn = await request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.test', password: 'rehearsal-password-2026' }),
    })
    if (!seedSignIn.ok) throw new Error(`Synthetic seed sign-in failed: ${seedSignIn.status}`)
    const seedCookies = seedSignIn.headers.getSetCookie()
    const seedCookie = seedCookies.map((value) => value.split(';', 1)[0]).join('; ')
    const csrf = /(?:^|; )kuuki_csrf=([^;]+)/.exec(seedCookie)?.[1]
    if (!csrf) throw new Error('Synthetic seed sign-in omitted CSRF cookie')
    const created = await request('/api/flights', {
      method: 'POST',
      headers: {
        Origin: origin,
        Cookie: seedCookie,
        'X-CSRF-Token': csrf,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'next-fixture-flight-001',
      },
      body: JSON.stringify({ date: '2026-01-03', origin: 'JFK', destination: 'BOS' }),
    })
    if (created.status !== 201)
      throw new Error(`Synthetic flight create failed: ${created.status} ${await created.text()}`)
    await mf.ready
    if (!check) {
      if (process.env.KUUKI_NEXT_FIXTURE !== 'minimal') await seedJournal(db, seedCookie, csrf)
      // A dedicated account and one-use token exercise browser resets without mutating other journeys' credentials.
      const recoveryHash = await sha256Hex('R'.repeat(43))
      const recoveryNow = new Date().toISOString()
      await db
        .prepare(`INSERT INTO auth_verifications(id,identifier,value,expiresAt,createdAt,updatedAt)
        SELECT ?, 'password-reset:' || id, ?, ?, ?, ? FROM users WHERE email = 'recovery@example.test'`)
        .bind(
          `password-reset:${recoveryHash}`,
          recoveryHash,
          new Date(Date.now() + 30 * 60_000).toISOString(),
          recoveryNow,
          recoveryNow,
        )
        .run()
      await seedLeaderboard(db, process.env.KUUKI_NEXT_FIXTURE !== 'minimal')
      const snapshot = process.env.KUUKI_NEXT_FIXTURE !== 'minimal' ? readRealSnapshot() : undefined
      if (snapshot) {
        const signup = await request('/api/auth/sign-up/email', {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: REAL_ACCOUNT_EMAIL, password: 'rehearsal-password-2026' }),
        })
        if (!signup.ok)
          throw new Error(`Real-account signup failed: ${signup.status} ${await signup.text()}`)
        const result = (await signup.json()) as { user: { id: string } }
        await seedRealAccount(db, result.user.id, snapshot)
      }
      await refreshLeaderboards(db)
      console.log(`Next synthetic fixture ready: ${origin}`)
      console.log(
        `Accounts a@example.test / b@example.test${snapshot ? ` / ${REAL_ACCOUNT_EMAIL} (real data, snapshot ${snapshot.takenAt.slice(0, 10)})` : ''}; password rehearsal-password-2026. Ctrl-C stops and discards the fixture.`,
      )
      // Also stop when the launcher dies, so a killed agent shell leaves no orphaned port.
      const parent = process.ppid
      await new Promise<void>((resolve) => {
        process.once('SIGINT', resolve)
        process.once('SIGTERM', resolve)
        process.once('SIGHUP', resolve)
        setInterval(() => process.ppid !== parent && resolve(), 1000).unref()
      })
      return
    }
    const unknown = await assertResponse('/api/no-such-route', 404)
    if (!unknown.headers.get('Content-Type')?.includes('application/json'))
      throw new Error('Unknown API returned non-JSON content')
    const wrongMethod = await assertResponse('/api/flights/aircraft-batch', 405, { method: 'GET' })
    if (wrongMethod.headers.get('Allow') !== 'POST')
      throw new Error('Static API route lost to dynamic route')
    await assertResponse('/api', 404)
    const csrfDenied = await assertResponse('/api/auth/sign-out', 403, {
      method: 'POST',
      headers: { Origin: origin },
    })
    if (!csrfDenied.headers.get('Content-Type')?.includes('application/json'))
      throw new Error('CSRF denial was not JSON')
    const signIn = await assertResponse('/api/auth/sign-in/email', 200, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.test', password: 'rehearsal-password-2026' }),
    })
    const cookies = signIn.headers.getSetCookie()
    if (cookies.length < 2) throw new Error('Sign-in lost multiple Set-Cookie headers')
    const cookie = cookies.map((value) => value.split(';', 1)[0]).join('; ')
    const memberAirport = await assertResponse('/airports/TBS', 200, {
      headers: { Cookie: cookie },
    })
    if (memberAirport.headers.get('Cache-Control') !== 'no-store')
      throw new Error('Member airport lost no-store')
    for (const path of ['/airports/TBS', '/airports/ZZZ']) {
      const guest = await assertResponse(path, 307, { redirect: 'manual' })
      if (!guest.headers.get('Location')?.endsWith('/signin'))
        throw new Error('Guest airport request did not redirect to sign-in')
    }
    await assertResponse('/api/me/airports/TBS/history?owner=wrong', 409, {
      headers: { Cookie: cookie },
    })
    const overviewApi = await assertResponse('/api/me/overview/data', 200, {
      headers: { Cookie: cookie },
    })
    if (!overviewApi.headers.get('Content-Type')?.includes('application/json'))
      throw new Error('Overview API is not JSON')
    await assertResponse('/api/me/advanced-stats', 404, { headers: { Cookie: cookie } })
    await assertResponse('/api/me/dashboard-stats', 404, { headers: { Cookie: cookie } })
    const activation = await assertResponse('/activate', 200)
    if (
      activation.headers.get('Cache-Control') !== 'no-store' ||
      activation.headers.get('Referrer-Policy') !== 'no-referrer' ||
      !activation.headers.get('Content-Security-Policy')?.includes("default-src 'none'")
    )
      throw new Error('Activation isolation headers missing')
    const alias = await mf.dispatchFetch('https://activate.fixture.test/_next/static/chunk.js', {
      redirect: 'manual',
    })
    if (alias.status !== 302 || !alias.headers.get('Location')?.endsWith('/#'))
      throw new Error('Activation alias leaked Next assets or token fragment')
    await assertResponse('/legacy/flights', 404)
    for (const path of ['/activate', '/activate.js', '/sw.js', '/registerSW.js']) {
      const initial = await assertResponse(path, 200)
      const tag = initial.headers.get('ETag')
      if (!tag) throw new Error(`Static boundary has no ETag: ${path}`)
      const conditional = await assertResponse(path, 304, { headers: { 'If-None-Match': tag } })
      if (conditional.headers.get('Cache-Control') !== 'no-store')
        throw new Error(`Conditional boundary lost no-store: ${path}`)
    }
    for (const [cache, paths] of [
      [
        'public, max-age=31536000, immutable',
        [
          ...airportAssetPaths,
          '/maps/world-outline-110m-2.0.2.svg',
          '/maps/world-outline-110m-2.0.2-r2-light.svg',
          '/maps/world-outline-110m-2.0.2-r2-dark.svg',
          '/maps/world-outline-110m-2.0.2-r2-fine-light.svg',
          '/maps/world-outline-110m-2.0.2-r2-fine-dark.svg',
          '/maps/country-centers-110m-2.0.2-r2.json',
          '/maps/countries-110m-2.0.2-r2.geojson',
          '/maps/maplibre-6.13.0/maplibre-gl.css',
          '/maps/maplibre-6.13.0/maplibre-gl-worker.mjs',
        ],
      ],
      [
        'public, max-age=3600, must-revalidate',
        ['/fonts/Commissioner-Regular.woff2', '/fonts/PaperMono.woff2'],
      ],
    ] as const)
      for (const path of paths) {
        const asset = await assertResponse(path, 200)
        if (asset.headers.get('Cache-Control') !== cache)
          throw new Error(`Public asset cache mismatch: ${path}`)
        if (path.startsWith('/airport-models/')) {
          const mime = path.endsWith('.svg')
            ? 'image/svg+xml'
            : path.endsWith('.json')
              ? 'application/json'
              : 'text/plain'
          if (asset.headers.get('Content-Type')?.split(';')[0] !== mime)
            throw new Error(`Airport asset MIME mismatch: ${path}`)
        }
        const head = await assertResponse(path, 200, { method: 'HEAD' })
        if (head.headers.get('Cache-Control') !== cache)
          throw new Error(`Public asset HEAD cache mismatch: ${path}`)
        const tag = asset.headers.get('ETag')
        if (tag) {
          const conditional = await assertResponse(path, 304, { headers: { 'If-None-Match': tag } })
          if (conditional.headers.get('Cache-Control') !== cache)
            throw new Error(`Public asset 304 cache mismatch: ${path}`)
        }
      }
    for (const path of [
      '/airport-models/model.json',
      '/airport-models/missing/model.json',
      '/airport-models/unknown.html',
      '/bootstrap.js',
      '/maps/missing-110m-2.0.2.svg',
      '/maps/maplibre-6.13.0/LICENSE.txt',
      '/fonts/missing.woff2',
      '/fonts/Commissioner-OFL.txt',
    ]) {
      const response = await request(path)
      if (response.headers.get('Cache-Control') !== 'no-store')
        throw new Error(`Unversioned or missing asset became cacheable: ${path}`)
      if (path.includes('/missing') && response.status < 400)
        throw new Error('Missing public asset did not fail')
    }
    const airlineLogo = await assertResponse('/airlines/TK.png', 200)
    const logoBytes = new Uint8Array(await airlineLogo.arrayBuffer())
    if (
      airlineLogo.headers.get('Content-Type') !== 'image/png' ||
      logoBytes[0] !== 137 ||
      logoBytes[1] !== 80 ||
      logoBytes[2] !== 78 ||
      logoBytes[3] !== 71
    ) {
      throw new Error('Airline logo was not served as a local PNG asset')
    }
    const bootstrapHead = await assertResponse('/bootstrap.js', 200, { method: 'HEAD' })
    if (bootstrapHead.headers.get('Cache-Control') !== 'no-store')
      throw new Error('Unversioned HEAD became cacheable')
    await maintenanceProbe()
    if (boundaryOnly) {
      console.log(JSON.stringify({ result: 'Next boundary smoke passed', artifact: artifact() }))
      return
    }
    const publicShell = await fetch(`http://127.0.0.1:${port}/`)
    if (publicShell.status !== 200)
      throw new Error(
        `Public Next shell failed: ${publicShell.status} ${(await publicShell.text()).slice(0, 300)}`,
      )
    await assertResponse('/signin', 200)
    const analyticsGuest = await assertResponse('/admin/users', 307, { redirect: 'manual' })
    if (!analyticsGuest.headers.get('Location')?.endsWith('/signin'))
      throw new Error('Guest analytics request did not redirect to sign-in')
    await assertResponse('/admin/users', 404, { headers: { Cookie: cookie } })
    await assertResponse('/api/me/activity', 401, { method: 'POST' })
    const activityCsrf = /(?:^|; )kuuki_csrf=([^;]+)/.exec(analyticsCookie)?.[1]
    if (!activityCsrf) throw new Error('Owner activity fixture omitted CSRF cookie')
    await assertResponse('/api/me/activity', 200, {
      method: 'POST',
      headers: { Cookie: analyticsCookie, Origin: origin, 'X-CSRF-Token': activityCsrf },
    })
    for (const days of [7, 30, 90]) {
      const analytics = await assertResponse(`/admin/users?days=${days}`, 200, {
        headers: { Cookie: analyticsCookie },
      })
      const html = await analytics.text()
      if (
        analytics.headers.get('Cache-Control') !== 'no-store' ||
        !html.includes('ua-metrics') ||
        !html.includes('ua-activity-metrics')
      )
        throw new Error('Owner analytics did not render private statistics')
      if (html.includes('a@example.test') || html.includes('legacy@example.test'))
        throw new Error('Analytics leaked account email addresses')
    }
    const oldUpdate = new Date(Date.now() - 2 * 86_400_000).toISOString()
    const oldExpiry = new Date(
      Date.now() + SESSION_TTL_SECONDS * 1000 - 2 * 86_400_000,
    ).toISOString()
    await db
      .prepare(
        "UPDATE auth_sessions SET updatedAt = ?, expiresAt = ? WHERE userId = (SELECT id FROM users WHERE email = 'a@example.test')",
      )
      .bind(oldUpdate, oldExpiry)
      .run()
    const overview = await assertResponse('/overview', 200, { headers: { Cookie: cookie } })
    if (!overview.headers.get('Content-Type')?.includes('text/html'))
      throw new Error('Next overview is not HTML')
    if (overview.headers.getSetCookie().length)
      throw new Error('Server page read wrote a renewal cookie')
    const reader = overview.body?.getReader()
    if (!reader) throw new Error('Next response has no streaming body')
    const first = await reader.read()
    if (!first.value?.length) throw new Error('Next response did not stream an initial chunk')
    await reader.cancel()
    const updateAfterPage = await db
      .prepare(
        "SELECT MAX(updatedAt) AS updatedAt FROM auth_sessions WHERE userId = (SELECT id FROM users WHERE email = 'a@example.test')",
      )
      .first<{ updatedAt: string }>()
    if (updateAfterPage?.updatedAt !== oldUpdate)
      throw new Error('Server page read slid the session')
    const renewal = await assertResponse('/api/auth/me', 200, { headers: { Cookie: cookie } })
    if (!renewal.headers.getSetCookie().length)
      throw new Error('Cookie-writing API did not renew an old session')
    const updateAfterRenewal = await db
      .prepare(
        "SELECT MAX(updatedAt) AS updatedAt FROM auth_sessions WHERE userId = (SELECT id FROM users WHERE email = 'a@example.test')",
      )
      .first<{ updatedAt: string }>()
    if (!updateAfterRenewal?.updatedAt || updateAfterRenewal.updatedAt <= oldUpdate)
      throw new Error('Cookie-writing API did not slide session expiry')
    await db
      .prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 10)
      INSERT INTO flights(user_id,date,origin,destination,lifecycle_state,confirmation_source,confirmed_at,
        departure_time,duration_minutes,duration_source,distance_km,origin_tz,dest_tz,zones_overflown)
      SELECT (SELECT id FROM users WHERE email='a@example.test'),'2026-01-03','JFK','BOS','logged','save',
        '2026-01-03T12:00:00Z','10:00',70,'times',300,'America/New_York','America/New_York',0 FROM n`)
      .run()
    const outboundBeforeCard = unexpectedOutboundCalls
    const card = await assertResponse('/api/me/overview/share.png', 200, {
      headers: { Cookie: cookie },
    })
    if (
      card.headers.get('Content-Type') !== 'image/png' ||
      card.headers.get('Cache-Control') !== 'no-store'
    ) {
      throw new Error('Share card lost PNG or private cache headers')
    }
    const png = new Uint8Array(await card.arrayBuffer()),
      ihdr = new DataView(png.buffer)
    if (
      png.slice(0, 8).join(',') !== '137,80,78,71,13,10,26,10' ||
      ihdr.getUint32(16) !== 1200 ||
      ihdr.getUint32(20) !== 1500
    ) {
      throw new Error('Share card did not render a 1200x1500 PNG in workerd')
    }
    if (unexpectedOutboundCalls !== outboundBeforeCard)
      throw new Error('Share rendering made an outbound request')
    await assertResponse('/api/me/overview/share.png', 401)
    await assertResponse('/api/me/overview/share.png?filter=invalid', 400, {
      headers: { Cookie: cookie },
    })
    console.log(
      JSON.stringify({
        result: 'Share card workerd passed',
        width: 1200,
        height: 1500,
        bytes: png.length,
        outboundCalls: 0,
      }),
    )
    console.log(JSON.stringify({ result: 'Next workerd smoke passed', artifact: artifact() }))
  } finally {
    await mf.dispose()
  }
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
