import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { gzipSync } from 'node:zlib'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { RouteProjection } from '@kuuki/shared'

type Sample = { route: string; history: number; phase: 'cold' | 'warm'; iteration: number;
  responseMs: number | null; readyMs: number; requests: number; responseBytes: number; jsGzipBytes: number;
  scriptSeconds: number | null; taskSeconds: number | null; heapBytes: number | null }
type MapSample = { routes: number; action: string; ms: number; heapBytes: number | null }
type NavigationSample = { history: number; from: string; to: string; iteration: number;
  urlMs: number; readyMs: number; rscResponseMs: number | null; documentRequests: number }
type SaveSample = { iteration: number; responseMs: number; serverTiming: string | null;
  apiDurationMs: number | null; derivedState: string | null }
const root = fileURLToPath(new URL('../../../', import.meta.url))
const assets = path.join(root, 'apps/next/.open-next/assets')
const out = path.join(root, 'docs/research/.local-performance.json')
const histories = [0, 1, 10, 500]
const samples: Sample[] = []
const maps: MapSample[] = []
const navigations: NavigationSample[] = []
const saves: SaveSample[] = []

test.afterEach(async ({ browser }, info) => {
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), browserVersion: browser.version(), completed: info.status === 'passed', samples, maps, navigations, saves }, null, 2))
  console.log(`Local performance raw samples: ${out}`)
})

function metric(metrics: { name: string; value: number }[], name: string) {
  return metrics.find(item => item.name === name)?.value ?? null
}
async function uniqueJsGzip(urls: Set<string>): Promise<number> {
  let bytes = 0
  for (const url of urls) {
    const pathname = decodeURIComponent(new URL(url).pathname)
    if (!pathname.endsWith('.js') && !pathname.endsWith('.mjs')) continue
    const file = path.resolve(assets, `.${pathname}`)
    if (!file.startsWith(`${assets}${path.sep}`)) continue
    try { bytes += gzipSync(await readFile(file)).byteLength } catch { /* external or runtime-generated URL */ }
  }
  return bytes
}
async function seed(context: BrowserContext, origin: string, count: number): Promise<void> {
  const signup = await context.request.post('/api/auth/sign-up/email', { headers: { Origin: origin },
    data: { email: `performance-${count}-${crypto.randomUUID()}@example.test`, password: 'performance-password-2026' } })
  expect(signup.status(), await signup.text()).toBe(201)
  const csrf = (await context.cookies(origin)).find(cookie => cookie.name === 'kuuki_csrf')?.value
  expect(csrf).toBeTruthy()
  const profile = await context.request.patch('/api/profiles/me', {
    headers: { Origin: origin, 'X-CSRF-Token': csrf! },
    data: { username: `perf-${crypto.randomUUID().slice(0, 8)}` },
  })
  expect(profile.status(), await profile.text()).toBe(200)
  for (let start = 0; start < count; start += 50) {
    const items = Array.from({ length: Math.min(50, count - start) }, () => ({
      key: crypto.randomUUID(), flight: { date: '2025-06-01', origin: 'JFK', destination: 'BOS', source: 'manual' },
    }))
    const response = await context.request.post('/api/flights/bulk', { data: { items },
      headers: { Origin: origin, 'X-CSRF-Token': csrf! } })
    expect(response.status(), await response.text()).toBe(200)
    const result = await response.json() as { results: { status: string }[] }
    expect(result.results.map(item => item.status)).toEqual(items.map(() => 'created'))
  }
  const list = await context.request.get('/api/flights?limit=1')
  expect(list.status()).toBe(200)
  expect((await list.json() as { total: number }).total).toBe(count)
}
async function ready(page: Page, route: string, count: number) {
  const formatted = count.toLocaleString('en-US')
  if (route === 'overview') {
    if (count === 0) await expect(page.getByTestId('overview-empty')).toBeVisible()
    else await expect(page.getByTestId('overview-flights')).toHaveText(formatted)
  } else if (route === 'journal') {
    await expect(page.getByTestId('journal-data').getByText(`${formatted} ${count === 1 ? 'flight' : 'flights'}`, { exact: true })).toBeVisible()
  } else {
    await expect(page.getByTestId('passport-data').locator('.passport-figures strong').first()).toHaveText(count ? '1' : '0')
  }
}
async function shellNavigation(page: Page, from: string, to: string, count: number, iteration: number) {
  let rscResponseMs: number | null = null, documentRequests = 0
  const start = performance.now()
  const onRequest = (request: import('@playwright/test').Request) => {
    if (request.isNavigationRequest() && request.resourceType() === 'document') documentRequests++
  }
  const onResponse = (response: import('@playwright/test').Response) => {
    if (new URL(response.url()).pathname === `/${to}` && response.request().headers().rsc === '1' && rscResponseMs === null)
      rscResponseMs = performance.now() - start
  }
  page.on('request', onRequest); page.on('response', onResponse)
  try {
    await page.locator(`nav a[href="/${to}"]:visible`).first().click()
    await page.waitForURL(url => url.pathname === `/${to}`)
    const urlMs = performance.now() - start
    await ready(page, to, count)
    const readyMs = performance.now() - start
    expect(documentRequests, 'Next Link transition fell back to a document request').toBe(0)
    navigations.push({ history: count, from, to, iteration, urlMs, readyMs, rscResponseMs, documentRequests })
  } finally { page.off('request', onRequest); page.off('response', onResponse) }
}
async function singleFlightSaves(context: BrowserContext, origin: string) {
  await seed(context, origin, 0)
  const csrf = (await context.cookies(origin)).find(cookie => cookie.name === 'kuuki_csrf')?.value
  expect(csrf).toBeTruthy()
  for (let iteration = 0; iteration < 20; iteration++) {
    const key = crypto.randomUUID()
    const started = performance.now()
    const response = await context.request.post('/api/flights', {
      headers: { Origin: origin, 'X-CSRF-Token': csrf!, 'Idempotency-Key': key },
      data: { date: '2025-06-01', origin: 'JFK', destination: 'BOS', source: 'manual' },
    })
    const responseMs = performance.now() - started
    expect(response.status(), await response.text()).toBe(201)
    const body = await response.json() as { derived_state?: string }
    const serverTiming = response.headers()['server-timing'] ?? null
    const apiDurationMs = serverTiming ? Number(/(?:^|,)\s*api;dur=([\d.]+)/.exec(serverTiming)?.[1]) : NaN
    saves.push({ iteration, responseMs, serverTiming, apiDurationMs: Number.isFinite(apiDurationMs) ? apiDurationMs : null,
      derivedState: body.derived_state ?? null })
  }
  const list = await context.request.get('/api/flights?limit=1')
  expect((await list.json() as { total: number }).total).toBe(20)
}
async function navigate(page: Page, route: string, count: number, phase: 'cold' | 'warm', iteration: number) {
  const url = `/${route}`
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: phase === 'cold' })
  const before = (await cdp.send('Performance.getMetrics')).metrics
  let requests = 0, responseBytes = 0, responseMs: number | null = null
  const scripts = new Set<string>()
  const started = performance.now()
  const onRequest = () => { requests++ }
  const onResponse = async (response: import('@playwright/test').Response) => {
    try {
      const address = new URL(response.url())
      if (address.pathname.endsWith('.js') || address.pathname.endsWith('.mjs')) scripts.add(response.url())
      const length = Number(response.headers()['content-length'])
      if (Number.isFinite(length)) responseBytes += length
      if (address.pathname === url && responseMs === null) responseMs = performance.now() - started
    } catch { /* response completed after navigation */ }
  }
  page.on('request', onRequest); page.on('response', onResponse)
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await ready(page, route, count)
    const readyMs = performance.now() - started
    // Include scripts requested before readiness; this is the loaded JS closure,
    // not every chunk present in the build output.
    const after = (await cdp.send('Performance.getMetrics')).metrics
    samples.push({ route, history: count, phase, iteration, responseMs, readyMs, requests,
      responseBytes, jsGzipBytes: await uniqueJsGzip(scripts),
      scriptSeconds: metric(after, 'ScriptDuration') === null || metric(before, 'ScriptDuration') === null ? null : metric(after, 'ScriptDuration')! - metric(before, 'ScriptDuration')!,
      taskSeconds: metric(after, 'TaskDuration') === null || metric(before, 'TaskDuration') === null ? null : metric(after, 'TaskDuration')! - metric(before, 'TaskDuration')!,
      heapBytes: metric(after, 'JSHeapUsedSize') })
  } finally { page.off('request', onRequest); page.off('response', onResponse); await cdp.detach() }
}
function projection(count: number, baseline: RouteProjection): RouteProjection {
  // Many unique valid three-letter route keys, using coordinates around the
  // globe. This is renderer load only: it does not imply such airport rows exist.
  const code = (n: number) => Array.from({ length: 3 }, (_, i) => String.fromCharCode(65 + Math.floor(n / 26 ** i) % 26)).join('')
  return { ...baseline, routeCount: count, limit: count, truncated: false, routes: [],
    pairs: Array.from({ length: count }, (_, i): RouteProjection['pairs'][number] => {
      const [a, b] = [code(i), code(i + 6000)].sort()
      return { a, b, count: 1, forward: 1, reverse: 0, lastDate: '2025-06-01',
        aCountry: 'US', bCountry: 'GB',
        from: [-160 + (i * 17) % 320, -60 + (i * 7) % 120],
        to: [-160 + (i * 19 + 40) % 320, -60 + (i * 11 + 20) % 120] }
    }) }
}
async function twoFrames(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}
async function heap(page: Page): Promise<number | null> {
  const cdp = await page.context().newCDPSession(page)
  try { await cdp.send('Performance.enable'); return metric((await cdp.send('Performance.getMetrics')).metrics, 'JSHeapUsedSize') }
  finally { await cdp.detach() }
}
async function mapAction(page: Page, routes: number, action: string, task: () => Promise<void>) {
  const start = performance.now(); await task(); await twoFrames(page)
  maps.push({ routes, action, ms: performance.now() - start, heapBytes: await heap(page) })
}

test('local production read and map measurements', async ({ browser, baseURL }) => {
  const origin = baseURL!
  for (const count of histories) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })
    try {
      await seed(context, origin, count)
      const page = await context.newPage()
      const routes = ['overview', 'journal', 'passport']
      for (let i = 0; i < 8; i++) {
        const phase = i < 3 ? 'cold' : 'warm'
        const order = i % 2 ? [...routes].reverse() : routes
        for (const route of order) {
          await navigate(page, route, count, phase, i)
        }
      }
      await page.goto('/overview')
      await ready(page, 'overview', count)
      let from = 'overview'
      for (const [iteration, to] of ['journal', 'passport', 'overview', 'journal', 'passport'].entries()) {
        await shellNavigation(page, from, to, count, iteration)
        from = to
      }
      await page.close()
    } finally { await context.close() }
  }
  const saveContext = await browser.newContext({ locale: 'en-US' })
  try { await singleFlightSaves(saveContext, origin) } finally { await saveContext.close() }
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' })
  try {
    await seed(context, origin, 0)
    const identity = await context.request.get('/api/auth/get-session')
    expect(identity.status()).toBe(200)
    const body = await identity.json() as { user?: { id?: string } }
    const ownerId = body.user?.id
    expect(ownerId).toBeTruthy()
    const baselineResponse = await context.request.get('/api/flights/route-projection?period=all')
    expect(baselineResponse.status()).toBe(200)
    const baseline = await baselineResponse.json() as RouteProjection
    expect(baseline.ownerId).toBe(ownerId)
    const page = await context.newPage()
    await page.setViewportSize({ width: 1280, height: 800 })
    const setMenuTheme = async (target: typeof page, name: string) => { await target.getByRole('button', { name: 'Account menu' }).click(); await target.getByRole('menuitemradio', { name }).click() }
    for (const count of [50, 500, 5000]) {
      await page.route('**/api/flights/route-projection?*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projection(count, baseline)) }))
      await page.goto('/passport')
      await expect(page.getByTestId('passport-data')).toBeVisible()
      await setMenuTheme(page, 'Light')
      await mapAction(page, count, 'open-to-controls', async () => {
        await page.getByRole('radio', { name: 'Map', exact: true }).click()
        await page.waitForURL(url => url.searchParams.get('view') === 'map')
        await page.getByRole('radiogroup', { name: 'Map layer' }).getByRole('radio', { name: 'Routes', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Fit routes' })).toBeVisible({ timeout: 60_000 })
      })
      await mapAction(page, count, 'select', async () => {
        const button = page.getByRole('list', { name: 'Route list' }).getByRole('button').first()
        await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true')
      })
      await mapAction(page, count, 'theme', async () => {
        await setMenuTheme(page, 'Dark')
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      })
      await mapAction(page, count, 'fit', async () => { await page.getByRole('button', { name: 'Fit routes' }).click() })
      await mapAction(page, count, 'close', async () => {
        await page.getByRole('button', { name: 'Close map' }).click()
        await expect(page.locator('.maplibregl-canvas')).toHaveCount(0)
      })
      await mapAction(page, count, 'reopen-to-controls', async () => {
        await page.getByRole('button', { name: 'Open map' }).click()
        await expect(page.getByRole('button', { name: 'Fit routes' })).toBeVisible({ timeout: 60_000 })
      })
      await page.unroute('**/api/flights/route-projection?*')
    }
  } finally { await context.close() }
})
