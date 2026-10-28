import { test, expect } from '@playwright/test'
import { signIn } from './helpers'

test('a constrained connection leaves the globe optional and can load it on mobile and desktop', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        saveData: true,
        effectiveType: '4g',
        downlink: 1.6,
      }),
    })
  })
  await signIn(page, baseURL!)
  let workers = 0
  page.on('request', (request) => {
    if (request.url().includes('/maps/maplibre-') && request.url().endsWith('worker.mjs')) workers++
  })
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    const before = workers
    await page.goto('/overview')
    const load = page.getByRole('button', { name: 'Load map', exact: true })
    await expect(load).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(workers).toBe(before)
    await expect(
      page.getByRole('navigation', { name: width === 390 ? 'Tabs' : 'Primary' }),
    ).toBeVisible()
    await load.click()
    await expect(page.locator('.globe-surface')).toHaveAttribute('data-webgl-ready', 'true', {
      timeout: 20_000,
    })
    expect(workers).toBeGreaterThan(before)
  }
})

test('the overview globe fills the card and keeps its canvas visible in fullscreen', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(60_000)
  await signIn(page, baseURL!)
  let releaseAtlas!: () => void
  const atlasReady = new Promise<void>((resolve) => {
    releaseAtlas = resolve
  })
  await page.route('**/maps/countries-110m-2.0.2-r2.geojson', async (route) => {
    await atlasReady
    await route.continue()
  })
  await page.goto('/overview')
  await expect(page.getByRole('status').filter({ hasText: 'Loading globe…' })).toBeVisible()
  await expect(page.locator('.globe-viewport svg')).toHaveCount(0)
  releaseAtlas()
  for (const width of [1280, 600, 390]) {
    await page.setViewportSize({ width, height: 844 })
    const card = page.locator('.globe-card:not(.globe-card-fullscreen)')
    const surface = card.locator('.globe-surface')
    await expect(surface).toHaveAttribute('data-webgl-ready', 'true', { timeout: 20_000 })
    await expect
      .poll(async () => {
        const bounds = await card.boundingBox()
        const layer = await surface.locator('.globe-webgl-layer').boundingBox()
        const host = await surface.locator('.globe-map-canvas').boundingBox()
        const canvas = await surface.locator('.maplibregl-canvas').boundingBox()
        if (!bounds || !layer || !host || !canvas) return null
        return {
          visible: host.height > 0 && Math.abs(layer.height - host.height) < 1,
          insetX: Math.round(canvas.x - bounds.x),
          insetY: Math.round(canvas.y - bounds.y),
          widthGap: Math.round(bounds.width - canvas.width),
          heightGap: Math.round(bounds.height - canvas.height),
        }
      })
      .toEqual({ visible: true, insetX: 1, insetY: 1, widthGap: 2, heightGap: 2 })
  }
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click()
  const fullscreen = page.locator('.globe-card-fullscreen .globe-surface')
  await expect(fullscreen).toHaveAttribute('data-webgl-ready', 'true', { timeout: 20_000 })
  await expect
    .poll(async () => {
      const layer = await fullscreen.locator('.globe-webgl-layer').boundingBox()
      const host = await fullscreen.locator('.globe-map-canvas').boundingBox()
      return Boolean(layer && host && host.height > 0 && Math.abs(layer.height - host.height) < 1)
    })
    .toBe(true)
  await fullscreen.locator('.maplibregl-canvas').evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()
  })
  await expect(fullscreen.getByRole('status')).toContainText('Globe unavailable.', {
    timeout: 20_000,
  })
  await expect(fullscreen.locator('.maplibregl-canvas')).toHaveCount(0)
})

test('the Passport map view drops the retired route-map params and survives a theme change', async ({
  page,
  baseURL,
}) => {
  await signIn(page, baseURL!)
  // `layer` and `year` belonged to the old route map; the canonical URL keeps only the view.
  await page.goto('/passport?view=map&layer=routes&year=2026')
  await page.waitForURL((url) => url.pathname === '/passport' && url.search === '?view=map')
  const map = page.getByRole('radio', { name: 'Map', exact: true })
  await expect(map).toHaveAttribute('aria-checked', 'true')
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitemradio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  // A tray pick keeps the account menu open; close it before using the page.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
  await expect(map).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: 'Cards', exact: true }).click()
  await page.waitForURL((url) => url.search === '')
})

test('WebGL failure leaves the Passport map view and the Overview globe usable', async ({
  page,
  baseURL,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      options?: unknown,
    ) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', options as CanvasRenderingContext2DSettings)
    } as typeof original
  })
  expect(
    (
      await page.request.post('/api/auth/sign-in/email', {
        headers: { Origin: baseURL! },
        data: { email: 'a@example.test', password: 'rehearsal-password-2026' },
      })
    ).status(),
  ).toBe(200)
  await page.goto('/passport?view=map&layer=routes')
  await page.waitForURL((url) => url.pathname === '/passport' && url.search === '?view=map')
  // The view switch still works without WebGL; the atlas fallback itself is covered by its own lane.
  await page.getByRole('radio', { name: 'Cards', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Stamps' })).toBeVisible()
  await page.goto('/overview')
  await expect(page.getByRole('status').filter({ hasText: 'Globe unavailable.' })).toBeVisible()
  await expect(page.locator('.globe-viewport svg')).toHaveCount(0)
})
