// Local rollback rehearsal against compiled Workers and one disposable D1. No cloud bindings.
// Build the three bundles before running this script; it never deploys or reaches production.
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Miniflare, Log, LogLevel, Request as WorkerRequest, Response as WorkerResponse } from 'miniflare'
import { applyMigrations } from './_migrations'

const root = resolve('.')
const port = Number(process.env.KUUKI_ROLLBACK_PORT ?? 8811)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid KUUKI_ROLLBACK_PORT')
const origin = `http://127.0.0.1:${port}`
const databaseId = 'kuuki-synthetic-rollback-rehearsal'
const nextDir = join(root, '.wrangler/next-build')
const pagesDir = join(root, '.wrangler/functions-build')
const maintenanceDir = join(root, 'workers/maintenance/.wrangler/maintenance-build')
function bundle(dir: string, pattern: RegExp): string {
  const file = existsSync(dir) && readdirSync(dir).find(name => pattern.test(name))
  if (!file) throw new Error(`Built Worker missing from ${dir}`)
  return join(dir, file)
}
const nextBundle = bundle(nextDir, /^worker\.(?:js|mjs)$/)
const pagesBundle = bundle(pagesDir, /^index\.(?:js|mjs)$/)
const maintenanceBundle = bundle(maintenanceDir, /^index\.(?:js|mjs)$/)
const appBindings = {
  AUTH_SECRET: 'synthetic-browser-pepper',
  BETTER_AUTH_SECRET: 'synthetic-better-auth-secret-for-runtime-proof',
  PAGES_ORIGIN: origin,
  GEMINI_API_KEY: 'synthetic-provider-key',
  MAINTENANCE_MODE: 'false',
}
const noOutbound = async (_request: WorkerRequest) => new WorkerResponse('External calls disabled in rollback rehearsal', { status: 502 })
const mf = new Miniflare({
  log: new Log(LogLevel.WARN), host: '127.0.0.1', port,
  workers: [
    {
      name: 'candidate-next', modules: [{ type: 'ESModule', path: nextBundle }],
      compatibilityDate: '2026-08-06', compatibilityFlags: ['nodejs_compat'],
      d1Databases: { DB: databaseId }, bindings: appBindings, outboundService: noOutbound,
      assets: { workerName: 'candidate-next', directory: join(root, 'apps/next/.open-next/assets'), binding: 'ASSETS',
        routerConfig: { invoke_user_worker_ahead_of_assets: true, has_user_worker: true },
        assetConfig: { not_found_handling: 'none' } },
    },
    {
      name: 'fallback-pages', modules: true, scriptPath: pagesBundle,
      compatibilityDate: '2025-09-23', compatibilityFlags: ['nodejs_compat'],
      d1Databases: { DB: databaseId }, bindings: appBindings, outboundService: noOutbound,
      assets: { workerName: 'fallback-pages', directory: join(root, 'apps/web/dist'), binding: 'ASSETS',
        routerConfig: { invoke_user_worker_ahead_of_assets: true, has_user_worker: true },
        assetConfig: { not_found_handling: 'single-page-application' } },
    },
    {
      name: 'maintenance-held', modules: [{ type: 'ESModule', path: maintenanceBundle }],
      compatibilityDate: '2025-09-23', bindings: { MAINTENANCE_MODE: 'true' },
      outboundService: noOutbound,
    },
    {
      name: 'maintenance-draining', modules: [{ type: 'ESModule', path: maintenanceBundle }],
      compatibilityDate: '2025-09-23', d1Databases: { DB: databaseId },
      bindings: { MAINTENANCE_MODE: 'false' }, outboundService: noOutbound,
    },
  ],
})

type Target = 'candidate-next' | 'fallback-pages'
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message)
}
async function main() {
  try {
    const db = await mf.getD1Database('DB', 'candidate-next')
    await applyMigrations(db)
    await db.batch([
      db.prepare("INSERT INTO airports_reference(iata,name,city,country,country_code,latitude,longitude) VALUES('JFK','John F Kennedy','New York','United States','US',40.6413,-73.7781)"),
      db.prepare("INSERT INTO airports_reference(iata,name,city,country,country_code,latitude,longitude) VALUES('BOS','Logan','Boston','United States','US',42.3656,-71.0096)"),
      db.prepare("INSERT INTO airports_reference(iata,name,city,country,country_code,latitude,longitude) VALUES('LAX','Los Angeles','Los Angeles','United States','US',33.9416,-118.4085)"),
      db.prepare("INSERT INTO _code_adjectives(word) VALUES('calm'),('bright'),('swift')"),
      db.prepare("INSERT INTO _code_nouns(word) VALUES('cloud'),('wing'),('sky')"),
    ])
    await mf.ready
    const next = await mf.getWorker('candidate-next')
    const pages = await mf.getWorker('fallback-pages')
    const router: { target: Target } = { target: 'candidate-next' }
    let simulateCandidate503 = false
    const route = async (path: string, init?: RequestInit) => {
      const url = `${origin}${path}`
      const workerInit = init as Parameters<typeof next.fetch>[1]
      // This local router switch models a 503 decision at the edge. All successful
      // responses below come from the compiled Next or Pages worker in workerd.
      const response = router.target === 'candidate-next' && simulateCandidate503
        ? new WorkerResponse('Synthetic candidate unavailable', { status: 503 })
        : await (router.target === 'candidate-next' ? next : pages).fetch(url, workerInit)
      if (response.status === 503 && router.target === 'candidate-next') {
        router.target = 'fallback-pages'
        return pages.fetch(url, workerInit)
      }
      return response
    }
    const json = async <T>(path: string, init: RequestInit, expected: number): Promise<T> => {
      const response = await route(path, init)
      if (response.status !== expected) {
        throw new Error(`${init.method ?? 'GET'} ${path}: expected ${expected}, got ${response.status}: ${(await response.text()).slice(0, 300)}`)
      }
      return response.json() as Promise<T>
    }
    const signup = await json<{ user: { id: string } }>('/api/auth/sign-up/email', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rollback@example.test', password: 'rehearsal-password-2026' }),
    }, 201)
    const userId = signup.user.id
    assert(userId, 'Next signup omitted user id')
    const signin = await route('/api/auth/sign-in/email', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rollback@example.test', password: 'rehearsal-password-2026' }),
    })
    assert(signin.ok, `Next sign-in failed: ${signin.status}`)
    const cookie = signin.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ')
    const csrf = /(?:^|; )kuuki_csrf=([^;]+)/.exec(cookie)?.[1]
    assert(csrf, 'Next sign-in omitted CSRF cookie')
    const mutationHeaders = { Origin: origin, Cookie: cookie, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' }
    const identity = await json<{ user: { id: string } }>('/api/auth/me', { headers: { Cookie: cookie } }, 200)
    assert(identity.user?.id === userId, 'Next session identity mismatch')
    const input = { date: '2026-01-03', origin: 'JFK', destination: 'LAX' }
    const createHeaders = { ...mutationHeaders, 'Idempotency-Key': 'rollback-flight-001' }
    const created = await json<{ id: number }>('/api/flights', {
      method: 'POST', headers: createHeaders, body: JSON.stringify(input),
    }, 201)
    assert(Number.isInteger(created.id), 'Next flight create omitted id')
    const before = await db.prepare('SELECT COUNT(*) AS n FROM flights WHERE user_id = ?').bind(userId).first<{ n: number }>()
    assert(before?.n === 1, 'Next create did not persist in synthetic D1')

    simulateCandidate503 = true
    const replay = await json<{ id: number }>('/api/flights', {
      method: 'POST', headers: createHeaders, body: JSON.stringify(input),
    }, 200)
    assert(router.target === 'fallback-pages' && replay.id === created.id, 'Pages fallback did not replay Next receipt')
    const fallbackIdentity = await json<{ user: { id: string } }>('/api/auth/me', { headers: { Cookie: cookie } }, 200)
    assert(fallbackIdentity.user?.id === userId, 'Pages fallback did not accept Next session')
    await json(`/api/flights/${created.id}`, {
      method: 'PATCH', headers: mutationHeaders, body: JSON.stringify({ destination: 'BOS' }),
    }, 200)
    const edited = await db.prepare('SELECT destination FROM flights WHERE id = ?').bind(created.id).first<{ destination: string }>()
    assert(edited?.destination === 'BOS', 'Pages edit did not mutate Next flight')
    await json('/api/passport/claims/US', { method: 'PUT', headers: mutationHeaders }, 201)
    const ground = await json<{ id: string }>('/api/passport/ground-visits', {
      method: 'POST', headers: mutationHeaders, body: JSON.stringify({ countryCode: 'US', visitYear: 2026, entryMethod: 'land' }),
    }, 201)
    assert(ground.id, 'Pages ground visit omitted id')
    const claims = await json<Array<{ country_code: string }>>('/api/passport/claims', { headers: { Cookie: cookie } }, 200)
    assert(claims.some(row => row.country_code === 'US'), 'Pages claim missing')
    await json(`/api/passport/ground-visits/${ground.id}`, { method: 'DELETE', headers: mutationHeaders }, 200)
    await json(`/api/flights/${created.id}`, { method: 'DELETE', headers: mutationHeaders }, 200)
    const after = await db.prepare('SELECT COUNT(*) AS n FROM flights WHERE user_id = ?').bind(userId).first<{ n: number }>()
    assert(after?.n === 0, 'Pages delete left Next flight')

    // A held cron has deliberately no DB binding. A successful scheduled event
    // proves its guard returns before the first DB access.
    const held = await (await mf.getWorker('maintenance-held')).scheduled({ cron: '*/5 * * * *' })
    assert(held.outcome === 'ok', `Held cron failed: ${held.outcome}`)
    const statusBefore = await db.prepare('SELECT last_success_at FROM maintenance_status WHERE id = 1').first<{ last_success_at: string | null }>()
    assert(statusBefore?.last_success_at === null, 'Held cron touched maintenance status')
    // Seed an overdue canonical flight and an independently dirty derived revision.
    await db.prepare("INSERT INTO flights(user_id,date,origin,destination,is_upcoming,enrichment_status) VALUES(?, '2020-01-02','JFK','BOS',1,'skipped')").bind(userId).run()
    await db.prepare('INSERT INTO user_derived_state(user_id,revision,published_revision) VALUES(?,2,1) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1, published_revision=revision').bind(userId).run()
    const dirtyBefore = await db.prepare('SELECT revision,published_revision FROM user_derived_state WHERE user_id=?').bind(userId).first<{ revision: number; published_revision: number }>()
    assert(dirtyBefore && dirtyBefore.revision > dirtyBefore.published_revision, 'Dirty revision fixture missing')
    const drained = await (await mf.getWorker('maintenance-draining')).scheduled({ cron: '*/5 * * * *' })
    assert(drained.outcome === 'ok', `Draining cron failed: ${drained.outcome}`)
    const flight = await db.prepare("SELECT is_upcoming FROM flights WHERE user_id=? AND date='2020-01-02'").bind(userId).first<{ is_upcoming: number }>()
    const dirtyAfter = await db.prepare('SELECT revision,published_revision FROM user_derived_state WHERE user_id=?').bind(userId).first<{ revision: number; published_revision: number }>()
    const statusAfter = await db.prepare('SELECT last_success_at,last_error FROM maintenance_status WHERE id=1').first<{ last_success_at: string | null; last_error: string | null }>()
    assert(flight?.is_upcoming === 0 && dirtyAfter !== null && dirtyAfter.revision === dirtyAfter.published_revision && statusAfter?.last_success_at && !statusAfter.last_error,
      'Draining owner did not finish rollover, repair and status')
    console.log(JSON.stringify({ rehearsal: 'passed', candidate: 'compiled Next', fallback: 'compiled Pages',
      sharedD1: true, rollbackOn503: true, receiptReplay: true, cookieHandoff: true,
      pagesMutations: ['edit', 'claim', 'ground', 'delete'], heldCron: true, drainingCron: true }))
  } finally {
    await mf.dispose()
  }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Rollback rehearsal failed')
  process.exitCode = 1
})
