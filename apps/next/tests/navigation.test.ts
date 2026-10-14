import { test, expect } from '@playwright/test'
import { signIn, fixtureHeaders, routeSettled } from './helpers'

test('generated avatars look around and blink unless reduced motion is requested', async ({
  page,
  baseURL,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await signIn(page, baseURL!)
  await page.goto('/overview')
  const face = page.getByRole('button', { name: 'Account menu' }).locator('[data-facehash-face]')
  await expect(face).toBeVisible()
  const blinkingEyes = () =>
    face.evaluate(
      (element) =>
        element
          .getAnimations({ subtree: true })
          .filter(
            (animation) =>
              animation instanceof CSSAnimation &&
              animation.animationName === 'facehash-blink' &&
              animation.playState === 'running',
          ).length,
    )
  await expect.poll(blinkingEyes).toBe(2)
  const eyes = face.locator('svg')
  const eyePosition = () =>
    eyes.evaluate(
      (element) =>
        element.getBoundingClientRect().x - element.parentElement!.getBoundingClientRect().x,
    )
  const initialPosition = await eyePosition()
  await expect
    .poll(async () => Math.abs((await eyePosition()) - initialPosition))
    .toBeGreaterThan(0.5)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(blinkingEyes).toBe(0)
  await expect(face).toHaveCSS('transform', 'none')
  await expect(eyes).toHaveCSS('transform', 'none')
})

test('read-route navigation settles on authorized content', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await page.goto('/overview')
  await expect(page.locator('.ov-globe')).toBeVisible()
  for (const [route, heading] of [
    ['journal', 'Journal'],
    ['ground-travel', 'Ground travel'],
    ['passport', 'Passport'],
    ['overview', 'Overview'],
  ]) {
    await page
      .locator(`nav:is([aria-label="Primary"], [aria-label="Tabs"]) a[href="/${route}"]:visible`)
      .click()
    await page.waitForURL((url) => url.pathname === `/${route}`)
    await routeSettled(page)
    await expect(page.locator('h1')).toHaveText(heading)
    await expect(
      route === 'overview' ? page.locator('.ov-globe') : page.getByTestId(`${route}-data`),
    ).toBeVisible()
    await expect(
      page.locator(
        `nav:is([aria-label="Primary"], [aria-label="Tabs"]) a[href="/${route}"]:visible`,
      ),
    ).toHaveAttribute('aria-current', 'page')
  }
})

test('desktop tab navigation keeps the header and incoming page geometry stable', async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, baseURL!)
  await page.goto('/overview')
  await expect(page.locator('.ov-globe')).toBeVisible()
  await page.evaluate(() => document.fonts.ready.then(() => undefined))

  await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('.site-header-inner')!
    const nav = document.querySelector<HTMLElement>('.desktop-nav')!
    const main = document.getElementById('main')!
    const samples: Array<{ headerX: number; headerWidth: number; navX: number }> = []
    const journal: Array<{ x: number; width: number }> = []
    let recording = true
    const sample = () => {
      const rect = header.getBoundingClientRect()
      samples.push({
        headerX: rect.x,
        headerWidth: rect.width,
        navX: nav.getBoundingClientRect().x,
      })
      if (
        location.pathname === '/journal' &&
        document.querySelector('[data-testid="journal-data"]')
      ) {
        const incoming = main.getBoundingClientRect()
        journal.push({ x: incoming.x, width: incoming.width })
      }
      if (recording) requestAnimationFrame(sample)
    }
    sample()
    Object.assign(window, {
      stopNavigationGeometry: () => {
        recording = false
        return { samples, journal }
      },
    })
  })
  await page.locator('.desktop-nav a[href="/journal"]').click()
  await page.waitForURL('**/journal')
  await expect(page.getByTestId('journal-data')).toBeVisible()
  await routeSettled(page)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  const geometry = await page.evaluate(() =>
    (
      window as Window & {
        stopNavigationGeometry?: () => {
          samples: Array<{ headerX: number; headerWidth: number; navX: number }>
          journal: Array<{ x: number; width: number }>
        }
      }
    ).stopNavigationGeometry!(),
  )
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values)
  expect(geometry.samples.length).toBeGreaterThan(2)
  expect(geometry.journal.length).toBeGreaterThan(1)
  expect(spread(geometry.samples.map((frame) => frame.headerX))).toBeLessThanOrEqual(1)
  expect(spread(geometry.samples.map((frame) => frame.headerWidth))).toBeLessThanOrEqual(1)
  expect(spread(geometry.samples.map((frame) => frame.navX))).toBeLessThanOrEqual(1)
  expect(spread(geometry.journal.map((frame) => frame.x))).toBeLessThanOrEqual(1)
  expect(spread(geometry.journal.map((frame) => frame.width))).toBeLessThanOrEqual(1)
  expect(geometry.journal.at(-1)?.width).toBe(1200)
})

test('fresh documents, RSC and API reads isolate account data without response cookies', async ({
  page,
  baseURL,
}) => {
  await signIn(page, baseURL!)
  const a = await page.request.get('/api/me/overview/data')
  expect(a.status()).toBe(200)
  const aData = await a.json()
  expect(
    aData.rows
      .filter((row: { state: string }) => row.state !== 'upcoming')
      .reduce((sum: number, row: { weight: number }) => sum + row.weight, 0),
  ).toBe(1)
  await page.goto('/overview')
  await expect(page.locator('.ov-globe')).toBeVisible()
  await expect(page.getByLabel('Flights', { exact: true })).toHaveText('1')
  const document = await page.request.get('/overview')
  expect(document.status()).toBe(200)
  expect(document.headers()['cache-control']).toContain('no-store')
  expect(document.headers()['set-cookie']).toBeUndefined()
  const rsc = await page.request.get('/overview', { headers: { RSC: '1' } })
  expect(rsc.status()).toBe(200)
  expect(rsc.headers()['content-type']).toContain('text/x-component')
  expect(rsc.headers()['cache-control']).toContain('no-store')
  expect(rsc.headers()['set-cookie']).toBeUndefined()
  await signIn(page, baseURL!, 'b@example.test')
  const b = await page.request.get('/api/me/overview/data')
  expect(b.status()).toBe(200)
  const bData = await b.json()
  expect(bData.rows).toEqual([])
  expect(bData.etag).not.toBe(aData.etag)
  await page.goto('/overview')
  await expect(page.locator('.ov-globe')).toBeVisible()
  await expect(page.locator('.ov3-first-run')).toBeVisible()
  await expect(page.getByLabel('Flights', { exact: true })).toHaveCount(0) // first run has no fabricated figure
})

test.describe('entry behavior', () => {
  test('a named member who hasn’t onboarded resumes the card at the flights step', async ({
    page,
    baseURL,
  }) => {
    const email = `nousername-${Date.now()}@example.test`
    const created = await page.request.post('/api/auth/sign-up/email', {
      headers: fixtureHeaders(baseURL!),
      data: { name: 'New member', email, password: 'rehearsal-password-2026' },
    })
    expect(created.status()).toBe(201)
    await signIn(page, baseURL!, email)
    for (const path of [
      '/',
      '/signin',
      '/signup',
      '/overview',
      '/journal',
      '/ground-travel',
      '/passport',
      '/import',
      '/settings',
    ]) {
      await page.goto(path)
      await page.waitForURL((url) => url.pathname === '/welcome/flights' && url.search === '')
    }
    for (const path of ['/onboarding?step=reveal', '/welcome/ready', '/welcome/review']) {
      await page.goto(path)
      await page.waitForURL((url) => url.pathname === '/welcome/flights' && url.search === '')
    }
    await expect(page.locator('main h1')).toBeVisible()
  })
})

test('a guest hitting a member page gets a 307 to sign-in, not a streamed 200', async ({
  request,
}) => {
  for (const path of ['/overview', '/journal', '/ground-travel', '/passport']) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(307)
    expect(new URL(response.headers().location, 'http://x').pathname).toBe('/signin')
  }
})
