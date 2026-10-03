// Synthetic hosted Pages smoke. Never run against production or real accounts.
// Example: pnpm exec tsx scripts/smoke-hosted-runtime.ts \
//   --url https://staging.kuuki.pages.dev \
//   --database-id 80e0c789-c1ab-4aa5-a6fe-e65c6e6cb74c \
//   --evidence /absolute/private/staging-hosted-smoke.json
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute } from 'node:path'

const PREVIEW_DB = '80e0c789-c1ab-4aa5-a6fe-e65c6e6cb74c'
const PROD_DB = '2a8e3895-6a98-4473-8d7b-a43ca0c0026f'
const ALLOWED_ORIGIN = 'https://staging.kuuki.pages.dev'

function option(name: string): string {
  const index = process.argv.indexOf(name)
  if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) {
    throw new Error(`Missing ${name}`)
  }
  return process.argv[index + 1]
}

function assertTarget(): { origin: string; evidence: string } {
  const raw = option('--url')
  const url = new URL(raw)
  const databaseId = option('--database-id').toLowerCase()
  const evidence = option('--evidence')
  if (databaseId === PROD_DB || databaseId !== PREVIEW_DB) throw new Error('Staging D1 ID required')
  if (url.origin !== ALLOWED_ORIGIN || url.href !== `${ALLOWED_ORIGIN}/` ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('Only the configured staging origin is allowed')
  }
  if (!isAbsolute(evidence)) throw new Error('Evidence path must be absolute')
  return { origin: url.origin, evidence }
}

type Actor = { email: string; password: string; id: string; cookie: string; csrf: string }
type Result = { status: number; body: Record<string, unknown>; response: Response }
const steps: string[] = []

async function request(origin: string, path: string, init: RequestInit = {}): Promise<Result> {
  const response = await fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(15000), redirect: 'manual' })
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  return { status: response.status, body, response }
}

function expectStatus(result: Result, expected: number, step: string): void {
  if (result.status !== expected) {
    throw new Error(`${step}: HTTP ${result.status}, code ${String(result.body.code ?? 'unknown')}; expected ${expected}`)
  }
  steps.push(step)
}

function cookies(response: Response): { cookie: string; csrf: string } {
  const lines = response.headers.getSetCookie?.() ?? [response.headers.get('Set-Cookie') ?? '']
  const read = (name: string) => lines.map(line => new RegExp(`(?:^|,\\s*)${name}=([^;]+)`).exec(line)?.[1]).find(Boolean)
  const session = read('kuuki_session')
  const csrf = read('kuuki_csrf')
  if (!session || !csrf) throw new Error('Session/CSRF cookies missing')
  return { cookie: `kuuki_session=${session}; kuuki_csrf=${csrf}`, csrf }
}

function headers(origin: string, actor: Actor, csrf = true): HeadersInit {
  return {
    Origin: origin,
    Cookie: actor.cookie,
    ...(csrf ? { 'X-CSRF-Token': actor.csrf } : {}),
    'Content-Type': 'application/json',
  }
}

async function main(): Promise<void> {
  const { origin, evidence } = assertTarget()
  const suffix = randomBytes(8).toString('hex')
  const password = randomBytes(24).toString('base64url')
  const actors: Actor[] = []
  const run = { origin, databaseId: PREVIEW_DB, startedAt: new Date().toISOString(), steps, credentialsFile: `${evidence}.credentials.json` }
  mkdirSync(dirname(evidence), { recursive: true, mode: 0o700 })
  // Retain the disposable account credentials privately for later staging cleanup.
  const save = () => writeFileSync(run.credentialsFile, JSON.stringify(actors.map(({ email, password, id }) => ({ email, password, id })), null, 2), { mode: 0o600 })
  save()
  try {
    const initial = await request(origin, '/api/auth/me')
    expectStatus(initial, 200, 'anonymous bootstrap')
    if (initial.body.user !== null) throw new Error('Anonymous request resolved to an account')

    for (const label of ['a', 'b']) {
      const email = `staging-smoke-${label}-${suffix}@example.test`
      const signup = await request(origin, '/api/auth/signup', {
        method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName: `Staging ${label.toUpperCase()}` }),
      })
      expectStatus(signup, 201, `signup ${label}`)
      const id = (signup.body.user as { id?: string } | undefined)?.id
      if (!id) throw new Error(`Signup ${label} returned no ID`)
      actors.push({ email, password, id, ...cookies(signup.response) })
      save()
    }

    const [a, b] = actors
    const signout = await request(origin, '/api/auth/signout', { method: 'POST', headers: headers(origin, a) })
    expectStatus(signout, 200, 'signout A')
    const revoked = await request(origin, '/api/auth/me', { headers: { Cookie: a.cookie } })
    expectStatus(revoked, 200, 'revoked session response')
    if (revoked.body.user !== null) throw new Error('Old session survived signout')
    const signin = await request(origin, '/api/auth/signin', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: a.email, password: a.password }),
    })
    expectStatus(signin, 200, 'signin A')
    Object.assign(a, cookies(signin.response))
    const me = await request(origin, '/api/auth/me', { headers: { Cookie: a.cookie } })
    expectStatus(me, 200, 'identity A')
    if ((me.body.user as { id?: string } | null)?.id !== a.id) throw new Error('Signed-in identity mismatch')

    const input = { date: '2026-01-03', origin: 'JFK', destination: 'LAX' }
    const key = `hosted-smoke-${suffix}`
    const noCsrf = await request(origin, '/api/flights', {
      method: 'POST', headers: { ...headers(origin, a, false), 'Idempotency-Key': key }, body: JSON.stringify(input),
    })
    expectStatus(noCsrf, 403, 'missing CSRF rejected')
    const createInit = { method: 'POST', headers: { ...headers(origin, a), 'Idempotency-Key': key }, body: JSON.stringify(input) }
    const created = await request(origin, '/api/flights', createInit)
    expectStatus(created, 201, 'create flight A')
    const flightId = created.body.id
    if (typeof flightId !== 'number' || flightId < 1) throw new Error('Created flight ID invalid')
    if (created.body.derived_state !== 'ready') throw new Error('Derived state was not published after create')
    const replay = await request(origin, '/api/flights', createInit)
    expectStatus(replay, 200, 'idempotent replay')
    if (replay.body.id !== flightId) throw new Error('Replay created a second flight')
    const own = await request(origin, `/api/flights/${flightId}`, { headers: { Cookie: a.cookie } })
    expectStatus(own, 200, 'owner read')
    const denied = await request(origin, `/api/flights/${flightId}`, { headers: { Cookie: b.cookie } })
    expectStatus(denied, 404, 'cross-account read denied')
    const deniedDelete = await request(origin, `/api/flights/${flightId}`, { method: 'DELETE', headers: headers(origin, b) })
    expectStatus(deniedDelete, 404, 'cross-account delete denied')
    const patched = await request(origin, `/api/flights/${flightId}`, {
      method: 'PATCH', headers: headers(origin, a), body: JSON.stringify({ destination: 'BOS' }),
    })
    expectStatus(patched, 200, 'route update')
    if (patched.body.destination !== 'BOS' || patched.body.derived_state !== 'ready') throw new Error('Updated route or derived state mismatch')
    if (Number(patched.body.distance_km) >= Number(created.body.distance_km)) throw new Error('Distance did not decrease')
    const derived = await request(origin, '/api/me/derived-state', { headers: { Cookie: a.cookie } })
    expectStatus(derived, 200, 'derived state read')
    if (derived.body.derived_state !== 'ready' || derived.body.revision !== derived.body.published_revision) {
      throw new Error('Derived publication is not current')
    }
    const deleted = await request(origin, `/api/flights/${flightId}`, { method: 'DELETE', headers: headers(origin, a) })
    expectStatus(deleted, 200, 'delete flight A')
    const gone = await request(origin, '/api/flights', createInit)
    expectStatus(gone, 410, 'deleted replay rejected')
    const aList = await request(origin, '/api/flights', { headers: { Cookie: a.cookie } })
    expectStatus(aList, 200, 'empty owner list')
    if (aList.body.total !== 0) throw new Error('Deleted flight remained in owner list')
    const bList = await request(origin, '/api/flights', { headers: { Cookie: b.cookie } })
    expectStatus(bList, 200, 'empty other account list')
    if (bList.body.total !== 0) throw new Error('Other account received flight data')
    writeFileSync(evidence, JSON.stringify({ ...run, completedAt: new Date().toISOString(), success: true, accountCount: actors.length }, null, 2), { mode: 0o600 })
    console.log(`Hosted synthetic smoke passed: ${steps.length} checks; evidence ${evidence}`)
  } catch (error) {
    writeFileSync(evidence, JSON.stringify({ ...run, completedAt: new Date().toISOString(), success: false, error: error instanceof Error ? error.message : 'Unknown error' }, null, 2), { mode: 0o600 })
    throw error
  }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Hosted smoke failed')
  process.exitCode = 1
})
