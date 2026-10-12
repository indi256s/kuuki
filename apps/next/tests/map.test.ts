import { test, expect } from '@playwright/test'
import { signIn } from './helpers'

test('the overview globe keeps its canvas visible in the card and fullscreen', async ({
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
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 })
    const surface = page.locator('.globe-card:not(.globe-card-fullscreen) .globe-surface')
    await expect(surface).toHaveAttribute('data-webgl-ready', 'true', { timeout: 20_000 })
    await expect
      .poll(async () => {
        const layer = await surface.locator('.globe-webgl-layer').boundingBox()
        const host = await surface.locator('.globe-map-canvas').boundingBox()
        return Boolean(layer && host && host.height > 0 && Math.abs(layer.height - host.height) < 1)
      })
      .toBe(true)
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

test('the opened map uses local assets, selectable routes and survives a theme change', async ({
  page,
  baseURL,
}) => {
  expect(
    (
      await page.request.post('/api/auth/sign-in/email', {
        headers: { Origin: baseURL! },
        data: { email: 'a@example.test', password: 'rehearsal-password-2026' },
      })
    ).status(),
  ).toBe(200)
  const assets: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/maps/')) assets.push(request.url())
  })
  await page.goto('/passport?view=map&layer=routes&year=2026')
  const routes = page.getByRole('list', { name: 'Route list', exact: true })
  await expect(routes.getByRole('button', { name: /BOS ↔ JFK/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fit routes' })).toBeVisible({ timeout: 20_000 })
  await routes.getByRole('button').first().click()
  await expect(routes.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true')
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitemradio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  // A tray pick keeps the account menu open; close it before using the page.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
  await expect(routes.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Fit routes' }).click()
  expect(assets.some((url) => url.endsWith('maplibre-gl-worker.mjs'))).toBe(true)
  expect(assets.some((url) => url.endsWith('countries-110m-2.0.2-r2.geojson'))).toBe(true)
  expect(assets.every((url) => new URL(url).origin === baseURL)).toBe(true)
  await page.getByRole('button', { name: 'Close map', exact: true }).click()
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(0)
  await page.getByRole('button', { name: 'Open map', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Fit routes' })).toBeVisible({ timeout: 20_000 })
})

test('WebGL failure keeps a keyboard usable route and country list', async ({ page, baseURL }) => {
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
  await expect(page.getByRole('status').filter({ hasText: 'Map unavailable.' })).toBeVisible()
  const route = page
    .getByRole('list', { name: 'Route list', exact: true })
    .getByRole('button')
    .first()
  await route.focus()
  await page.keyboard.press('Enter')
  await expect(route).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('list', { name: 'Visited countries', exact: true })).toContainText(
    'United States',
  )
  await page.goto('/overview')
  await expect(page.getByRole('status').filter({ hasText: 'Globe unavailable.' })).toBeVisible()
  await expect(page.locator('.globe-viewport svg')).toHaveCount(0)
})
