import { test, expect, type Page } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { claimUsername, fixtureHeaders, signIn } from './helpers'

const rendererChunks = readdirSync(new URL('../.next/static/chunks/', import.meta.url)).filter(
  (name) =>
    name.endsWith('.js') &&
    readFileSync(new URL(`../.next/static/chunks/${name}`, import.meta.url), 'utf8').includes(
      'WebGLRenderer',
    ),
)

async function account(page: Page, origin: string) {
  const created = await page.request.post('/api/auth/sign-up/email', {
    headers: fixtureHeaders(origin),
    data: {
      email: `airport-${crypto.randomUUID()}@example.test`,
      password: 'airport-fixture-password-2026',
    },
  })
  expect(created.status()).toBe(201)
  await claimUsername(page, origin)
  const csrf = decodeURIComponent(
    (await page.context().cookies()).find((cookie) => cookie.name === 'kuuki_csrf')!.value,
  )
  const headers = { Origin: origin, 'X-CSRF-Token': csrf }
  const bulk = await page.request.post('/api/flights/bulk', {
    headers,
    data: {
      items: [
        ...Array.from({ length: 5 }, (_, index) => ({
          date: `2024-03-${String(index + 1).padStart(2, '0')}`,
          origin: 'IST',
          destination: 'JFK',
          airline_iata: 'TK',
          flight_number: `100${index}`,
        })),
        {
          date: '2024-03-10',
          origin: 'IST',
          destination: 'TBS',
          airline_iata: 'TK',
          flight_number: 'EXACT1',
        },
        {
          date: '2024-03-12',
          origin: 'TBS',
          destination: 'IST',
          airline_iata: 'TK',
          flight_number: 'EXACT2',
        },
        {
          date: '2023-04-01',
          origin: 'TBS',
          destination: 'JFK',
          airline_iata: 'BA',
          flight_number: 'OUTSIDE',
        },
      ].map((flight, index) => ({ key: `airport-fixture-${index}`, flight })),
    },
  })
  expect(bulk.ok()).toBe(true)
  const results = await bulk.json()
  expect(results.results.every((item: { status: string }) => item.status === 'created')).toBe(true)
  const preferences = await (await page.request.get('/api/me/overview/prefs')).json()
  const filter = { period: { years: [2024] }, airlines: ['TK'], months: [3] }
  expect(
    (
      await page.request.put('/api/me/overview/prefs', {
        headers,
        data: { ...preferences, filter },
      })
    ).ok(),
  ).toBe(true)
}

for (const width of [1440, 390]) {
  test(`airport history, comparison and source-entry return survive reload at ${width}px`, async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
    await account(page, baseURL!)
    const downloads: string[] = []
    page.on('request', (request) => {
      if (
        /\/airport-models\/.*\/(model|plan)\.json/.test(request.url()) ||
        rendererChunks.some((chunk) => request.url().endsWith('/' + chunk))
      )
        downloads.push(request.url())
    })
    await page.goto('/overview')
    if (width === 390) await page.locator('[data-section-tile="rankings"]').click()
    const rankings =
      width === 390
        ? page.locator('[data-airport-chapter="rankings"]:not([inert])')
        : page.locator('section[data-section="rankings"]')
    await rankings.getByRole('radio', { name: 'Airports', exact: true }).check()
    await rankings.locator('[data-chart-key="TBS"]').click()
    const entry = rankings.getByRole('link', { name: 'Open airport', exact: true })
    await expect(entry).toHaveAttribute('href', /\/airports\/TBS\?scope=/)
    expect(downloads).toEqual([])
    const sheetY =
      width === 390
        ? await rankings.evaluate((node) => {
            node.scrollTop = 20
            return node.scrollTop
          })
        : 0
    if (width === 390) expect(sheetY).toBeGreaterThan(0)
    // Deliberately fail preference saves: the entry snapshot still owns exact return state.
    await page.route('**/api/me/overview/prefs', async (route) => {
      if (route.request().method() === 'PUT')
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"error":"fixture save failure","code":"UNAVAILABLE"}',
        })
      else await route.continue()
    })
    await entry.click()
    await expect(page).toHaveURL(/\/airports\/TBS\?/)
    await expect(page.locator('main')).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Tbilisi International Airport',
    )
    await page.getByRole('button', { name: 'History', exact: true }).click()
    const history = page.getByRole('complementary', { name: 'Your flights', exact: true })
    await expect(history).toContainText('EXACT1')
    await expect(history).not.toContainText('OUTSIDE')
    await history.getByRole('button', { name: 'All history', exact: true }).click()
    await expect(history).toContainText('OUTSIDE')
    await page.getByRole('button', { name: 'Objects', exact: true }).click()
    const objects = page.getByRole('complementary', { name: 'Objects', exact: true })
    await objects.locator('.airport-object-list button').first().click()
    await expect(
      page.getByRole('complementary', { name: 'Selected object', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Back to flights', exact: true }).click()
    await expect(history).toContainText('OUTSIDE')
    await page.getByRole('button', { name: 'Compare with BER', exact: true }).click()
    await expect(page).toHaveURL(/compare=BER/)
    await expect(page.locator('.airport-comparison-panel')).toHaveCount(2)
    await expect(
      page.locator('.airport-comparison-panel svg > g:first-child').first(),
    ).toBeVisible()
    const scales = await page
      .locator('.airport-comparison-panel svg > g:first-child')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('transform')?.match(/scale\(([^ ]+)/)?.[1]),
      )
    expect(scales).toHaveLength(2)
    expect(scales[0]).toBeTruthy()
    expect(scales[0]).toBe(scales[1])
    await page.goBack()
    await expect(page).not.toHaveURL(/compare=/)
    await expect(history).toContainText('OUTSIDE')
    if (width === 390) await page.reload()
    await page.goBack()
    await expect(page).toHaveURL(/\/overview$/)
    const restored =
      width === 390
        ? page.locator('[data-airport-chapter="rankings"]:not([inert])')
        : page.locator('section[data-section="rankings"]')
    await expect(restored.getByRole('radio', { name: 'Airports', exact: true })).toBeChecked()
    await expect(restored.locator('[data-chart-key="TBS"]')).toHaveAttribute('data-picked', 'true')
    await expect(restored.getByRole('link', { name: 'Open airport', exact: true })).toBeFocused()
    if (width === 390)
      await expect.poll(() => restored.evaluate((node) => node.scrollTop)).toBe(sheetY)
    await restored.locator('[data-chart-key="JFK"]').click()
    await page.goForward()
    await expect(page).toHaveURL(/\/airports\/TBS/)
    await page.goBack()
    await expect(restored.locator('[data-chart-key="JFK"]')).toHaveAttribute('data-picked', 'true')
    await page.goForward()
    await page.getByRole('button', { name: 'Overview', exact: true }).click()
    await expect(page).toHaveURL(/\/overview$/)
    await expect(restored.locator('[data-chart-key="JFK"]')).toHaveAttribute('data-picked', 'true')
    await page.goto('/journal')
    await page.goto('/overview')
    if (width === 390) await expect(page.locator('.ov3-section-sheet')).toHaveCount(0)
  })
}

test('direct comparison closes in place, and invalid scope stays explicit during WebGL/asset failure', async ({
  page,
  baseURL,
}) => {
  await signIn(page, baseURL!)
  await page.route('**/airport-models/**/model.json', (route) => route.abort())
  await page.goto('/airports/TBS?scope=broken&compare=BER')
  await expect(page.locator('.airport-comparison-panel')).toHaveCount(2)
  await page.getByRole('button', { name: 'Back to model', exact: true }).click()
  await expect(page).toHaveURL(/\/airports\/TBS\?scope=broken$/)
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await expect(page.getByRole('complementary').getByRole('alert')).toContainText(
    'Invalid history selection',
  )
  await page.getByRole('button', { name: 'All history', exact: true }).click()
  await expect(page.getByRole('complementary')).toContainText('No flights in this selection')
  await expect(page.getByRole('button', { name: 'Retry model', exact: true })).toBeVisible()
})

// Browser-only risks: real GPU context, native pointer capture and disposed DOM listeners.
test('real airport canvases pick, retire and recover without an idle render loop', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => {
    const records: {
      canvas: HTMLCanvasElement
      key: string
      listener: EventListenerOrEventListenerObject
      active: boolean
    }[] = []
    const frameDraws: number[] = []
    const probe = {
      frames: 0,
      records,
      projectionScale: 0,
      frameDraws,
    }
    const uniformNames = new WeakMap<WebGLUniformLocation, string>()
    Reflect.set(window, 'airportProbe', probe)
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const drawArrays = prototype.drawArrays,
        drawElements = prototype.drawElements
      const countDraw = () => {
        const frame = probe.frameDraws.length - 1
        if (frame < 0) return
        probe.frameDraws[frame]!++
      }
      prototype.drawArrays = function (mode, first, count) {
        countDraw()
        return drawArrays.call(this, mode, first, count)
      }
      prototype.drawElements = function (mode, count, type, offset) {
        countDraw()
        return drawElements.call(this, mode, count, type, offset)
      }
      const getUniform = prototype.getUniformLocation
      const uniform = prototype.uniformMatrix4fv
      prototype.getUniformLocation = function (
        this: WebGLRenderingContext,
        program: WebGLProgram,
        name: string,
      ) {
        const location = getUniform.call(this, program, name)
        if (location) uniformNames.set(location, name)
        return location
      }
      prototype.uniformMatrix4fv = function (
        this: WebGLRenderingContext,
        location: WebGLUniformLocation | null,
        transpose: boolean,
        data: Float32List,
      ) {
        if (location && uniformNames.get(location) === 'projectionMatrix')
          probe.projectionScale = Math.abs(data[5]!)
        return uniform.call(this, location, transpose, data)
      }
      const clear = prototype.clear
      prototype.clear = function (this: WebGLRenderingContext, mask: number) {
        probe.frames++
        probe.frameDraws.push(0)
        return clear.call(this, mask)
      }
    }
    const add = EventTarget.prototype.addEventListener
    const remove = EventTarget.prototype.removeEventListener
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (this instanceof HTMLCanvasElement && listener) {
        const key = `${type}:${typeof options === 'boolean' ? options : !!options?.capture}`
        if (
          !records.some(
            (record) =>
              record.canvas === this &&
              record.key === key &&
              record.listener === listener &&
              record.active,
          )
        )
          records.push({ canvas: this, key, listener, active: true })
      }
      return add.call(this, type, listener, options)
    }
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      const key = `${type}:${typeof options === 'boolean' ? options : !!options?.capture}`
      for (const record of records)
        if (record.canvas === this && record.key === key && record.listener === listener)
          record.active = false
      return remove.call(this, type, listener, options)
    }
  })
  await signIn(page, baseURL!)
  for (const iata of ['TBS', 'BER']) {
    await page.setViewportSize(
      iata === 'BER' ? { width: 320, height: 700 } : { width: 390, height: 844 },
    )
    await page.emulateMedia({ reducedMotion: iata === 'BER' ? 'reduce' : 'no-preference' })
    await page.goto(`/airports/${iata}`)
    const viewer = page.locator('.airport-viewer')
    await expect(viewer).toHaveAttribute('data-status', 'ready')
    const targets = await page
      .locator('.airport-header .ui-button, .airport-controls .ui-button')
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const r = node.getBoundingClientRect()
          return { width: r.width, height: r.height, left: r.left, right: r.right }
        }),
      )
    expect(
      targets.every(
        (r) =>
          r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= page.viewportSize()!.width,
      ),
    ).toBe(true)
    const canvas = page.locator('.airport-viewer canvas')
    const rect = await canvas.boundingBox()
    expect(rect).toBeTruthy()
    // Hover discovers an actual visible object, then a tap must select that exact object.
    let name: string | null = null
    let hitPoint = { x: 0, y: 0 }
    for (const [x, y] of [
      [0.5, 0.5],
      [0.45, 0.5],
      [0.55, 0.5],
      [0.4, 0.45],
      [0.6, 0.55],
      [0.35, 0.5],
      [0.65, 0.5],
    ]) {
      hitPoint = { x: rect!.x + rect!.width * x!, y: rect!.y + rect!.height * y! }
      await page.mouse.move(hitPoint.x, hitPoint.y)
      try {
        await expect(page.locator('.airport-hover')).toBeVisible({ timeout: 450 })
        name = await page.locator('.airport-hover').textContent()
        break
      } catch {
        /* Try another real screen location. */
      }
    }
    expect(name).toBeTruthy()
    await page.mouse.down()
    await page.mouse.up()
    await expect(
      page.getByRole('complementary', { name: 'Selected object', exact: true }),
    ).toContainText(name!)
    await canvas.click({ position: { x: 5, y: 5 } })
    await expect(page.getByRole('complementary')).toHaveCount(0)
    // A stationary second touch must suppress selection independently of the drag guard.
    const stationary = await page.context().newCDPSession(page)
    await stationary.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { id: 1, x: hitPoint.x + 30, y: hitPoint.y },
        { id: 2, ...hitPoint },
      ],
    })
    await stationary.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.getByRole('complementary')).toHaveCount(0)
    await stationary.detach()
    await page.getByRole('button', { name: 'Reset', exact: true }).click()
    // More than six CSS pixels changes the view and must never publish a selection.
    const framesBeforeDrag = await page.evaluate(() => {
      const probe = Reflect.get(window, 'airportProbe')
      probe.frameDraws = []
      return probe.frames as number
    })
    await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2)
    await page.mouse.down()
    await page.mouse.move(rect!.x + rect!.width / 2 + 100, rect!.y + rect!.height / 2 + 30, {
      steps: 24,
    })
    await page.mouse.up()
    await expect(page.getByRole('complementary')).toHaveCount(0)
    const measured = await page.evaluate(async (framesBeforeDrag) => {
      const probe = Reflect.get(window, 'airportProbe')
      await new Promise((resolve) => setTimeout(resolve, 100)) // Let the final coalesced frame finish.
      const before = probe.frames
      await new Promise((resolve) => setTimeout(resolve, 250)) // Observe an idle window, not a readiness delay.
      return {
        frames: before - framesBeforeDrag,
        drawCallsPerFrame: Math.max(...probe.frameDraws),
        idleFrames: probe.frames - before,
      }
    }, framesBeforeDrag)
    expect(measured.frames).toBeGreaterThan(2)
    expect(measured.idleFrames).toBe(0)
    expect(measured.drawCallsPerFrame).toBeLessThanOrEqual(32)
    // Hidden documents must not submit GPU work, even when a control changes pose.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    const hiddenFrames = await page.evaluate(() => Reflect.get(window, 'airportProbe').frames)
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    const afterHidden = await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150))
      return Reflect.get(window, 'airportProbe').frames
    })
    expect(afterHidden).toBe(hiddenFrames)
    await page.evaluate(() => {
      Reflect.deleteProperty(document, 'hidden')
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, 'airportProbe').frames))
      .toBeGreaterThan(hiddenFrames)
    // Two real touch pointers exercise capture/pinch and suppress tap selection.
    const scaleBeforePinch = await page.evaluate(
      () => Reflect.get(window, 'airportProbe').projectionScale,
    )
    expect(scaleBeforePinch).toBeGreaterThan(0)
    const cdp = await page.context().newCDPSession(page)
    const point = (id: number, x: number) => ({
      id,
      x: rect!.x + rect!.width * x,
      y: rect!.y + rect!.height / 2,
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point(1, 0.4), point(2, 0.6)],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [point(1, 0.3), point(2, 0.7)],
    })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, 'airportProbe').projectionScale))
      .toBeGreaterThan(scaleBeforePinch * 1.8)
    await expect(page.getByRole('complementary')).toHaveCount(0)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(1, 0.4)] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(1, 0.6)] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.getByRole('complementary')).toHaveCount(0)
    await cdp.detach()
    // Keyboard actions use the DOM list, with focus returning after comparison.
    await page.getByRole('button', { name: 'Objects', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Objects', exact: true })).toBeFocused()
    await page.locator('.airport-object-list button').first().focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Focus object', exact: true }).focus()
    await page.keyboard.press('Enter')
    for (let cycle = 0; cycle < 2; cycle++) {
      const comparison = page.getByRole('button', {
        name: `Compare with ${iata === 'TBS' ? 'BER' : 'TBS'}`,
        exact: true,
      })
      await comparison.focus()
      await page.keyboard.press('Enter')
      await expect(page.locator('.airport-comparison-panel')).toHaveCount(2)
      await expect(page.locator('.airport-viewer canvas')).toHaveCount(0)
      const retiredListeners = await page.evaluate(
        () =>
          Reflect.get(window, 'airportProbe').records.filter(
            (record: { canvas: HTMLCanvasElement; active: boolean }) =>
              !record.canvas.isConnected && record.active,
          ).length,
      )
      expect(retiredListeners).toBe(0)
      await page.keyboard.press('Escape')
      await expect(viewer).toHaveAttribute('data-status', 'ready')
      await expect(comparison).toBeFocused()
    }
    await canvas.evaluate((node) => {
      if (!(node instanceof HTMLCanvasElement)) throw new Error('Expected canvas')
      const context = node.getContext('webgl2') ?? node.getContext('webgl')
      if (!context) throw new Error('No actual WebGL context')
      context.getExtension('WEBGL_lose_context')!.loseContext()
    })
    await expect(viewer).toHaveAttribute('data-status', 'error')
    await expect(
      page.getByRole('complementary', { name: 'Selected object', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Retry model', exact: true }).click()
    await expect(viewer).toHaveAttribute('data-status', 'ready')
    await page.goto('/journal')
    await expect(page.locator('.airport-viewer canvas')).toHaveCount(0)
  }
})

test('owner switch retires a delayed airport history response before publication', async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(page, baseURL!)
  let release!: () => void
  let requested!: () => void
  const pending = new Promise<void>((resolve) => {
    requested = resolve
  })
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let handled = false
  let completed!: () => void
  const delivered = new Promise<void>((resolve) => {
    completed = resolve
  })
  let leaked = false
  await page.exposeFunction('airportLeak', () => {
    leaked = true
  })
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.body?.textContent?.includes('OLD-OWNER-PRIVATE'))
        Reflect.get(window, 'airportLeak')()
    }).observe(document, { subtree: true, childList: true })
  })
  await page.route('**/api/me/airports/TBS/history?*', async (route) => {
    if (handled) return route.continue()
    handled = true
    const response = await route.fetch()
    const data = await response.json()
    data.items = [
      {
        id: 99999999,
        date: '2024-01-01',
        origin: 'TBS',
        destination: 'IST',
        airline: 'TK',
        flightNumber: 'OLD-OWNER-PRIVATE',
        state: 'logged',
      },
    ]
    data.total = 1
    requested()
    await held
    try {
      await route.fulfill({ response, json: data })
    } catch {
      /* Identity retirement may have already aborted the transport. */
    } finally {
      completed()
    }
  })
  await page.goto('/airports/TBS')
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await pending
  const other = await context.newPage()
  await signIn(other, baseURL!, 'b@example.test')
  let continueNavigation!: () => void
  let navigationRequested!: () => void
  const navigating = new Promise<void>((resolve) => {
    navigationRequested = resolve
  })
  const holdNavigation = new Promise<void>((resolve) => {
    continueNavigation = resolve
  })
  await page.route('**/airports/TBS', async (route) => {
    navigationRequested()
    await holdNavigation
    await route.continue()
  })
  const reloaded = page.waitForEvent('domcontentloaded')
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'))
  })
  await navigating
  release()
  await delivered
  expect(leaked).toBe(false)
  await page.unroute('**/api/me/airports/TBS/history?*')
  continueNavigation()
  await reloaded
  await expect(page.locator('.airport-viewer')).toHaveAttribute('data-status', 'ready')
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await expect(page.getByRole('complementary')).toContainText('No flights in this selection')
  expect(leaked).toBe(false)
  expect(await page.evaluate(() => sessionStorage.getItem('kuuki:airport-returns:v1'))).toBeNull()
  await other.close()
})

test('background import dock leaves airport controls reachable on a phone', async ({
  page,
  baseURL,
}) => {
  test.skip(
    process.env.KUUKI_NEXT_DOCK_FIXTURE !== '1',
    'Runs separately with the import shell binding enabled',
  )
  await signIn(page, baseURL!)
  const batchId = '42aa5152-5294-4b7d-af11-731719da289c'
  await page.route('**/api/me/awaiting', async (route) => {
    const response = await route.fetch()
    const data = await response.json()
    data.drafts = [{ batchId, status: 'processing', sourceType: 'text', sourceLabel: null }]
    await route.fulfill({ response, json: data })
  })
  await page.route(`**/api/import/batches/${batchId}`, (route) =>
    route.fulfill({
      json: {
        batch: {
          id: batchId,
          sourceType: 'text',
          sourceLabel: null,
          status: 'processing',
          stage: 'recognizing',
          sequence: 1,
          errorCode: null,
          retryAfter: null,
          createdAt: '2026-10-29T00:00:00Z',
          updatedAt: '2026-10-29T00:00:00Z',
          expiresAt: '2099-01-01T00:00:00Z',
          expired: false,
        },
        drafts: [],
      },
    }),
  )
  await page.route(`**/api/import/batches/${batchId}/events*`, (route) =>
    route.fulfill({ contentType: 'text/event-stream', body: ': waiting\n\n' }),
  )
  await page.goto('/airports/TBS')
  const dock = page.locator('.import-dock')
  await expect(dock).toBeVisible()
  await expect(page.locator('.airport-viewer')).toHaveAttribute('data-status', 'ready')
  const overlaps = await page.locator('.airport-controls .ui-button').evaluateAll((nodes) => {
    const dock = document.querySelector('.import-dock')!.getBoundingClientRect()
    return nodes.filter((node) => {
      const r = node.getBoundingClientRect()
      return (
        r.left < dock.right && r.right > dock.left && r.top < dock.bottom && r.bottom > dock.top
      )
    }).length
  })
  expect(overlaps).toBe(0)
  await page.getByRole('button', { name: 'Objects', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Objects', exact: true })).toBeVisible()
})
