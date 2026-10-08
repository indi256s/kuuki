import { test, expect } from '@playwright/test'
import { signIn, fixtureHeaders } from './helpers'

test('read-route navigation settles on authorized content', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await page.goto('/overview')
  await expect(page.locator('.ov-globe')).toBeVisible()
  for (const [route, heading] of [['journal', 'Journal'], ['passport', 'Passport'], ['overview', 'Overview']]) {
    await page.locator(`nav:is([aria-label="Primary"], [aria-label="Tabs"]) a[href="/${route}"]:visible`).click()
    await page.waitForURL(url => url.pathname === `/${route}`)
    await expect(page.locator('h1')).toHaveText(route === 'overview' ? /^Hi(?:,| ·|$)/ : heading)
    await expect(route === 'overview' ? page.locator('.ov-globe') : page.getByTestId(`${route}-data`)).toBeVisible()
    await expect(page.locator(`nav:is([aria-label="Primary"], [aria-label="Tabs"]) a[href="/${route}"]:visible`)).toHaveAttribute('aria-current', 'page')
  }
})

test('fresh documents, RSC and API reads isolate account data without response cookies', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  const a = await page.request.get('/api/me/overview/data')
  expect(a.status()).toBe(200)
  const aData = await a.json()
  expect(aData.rows.filter((row: { state: string }) => row.state !== 'upcoming').reduce((sum: number, row: { weight: number }) => sum + row.weight, 0)).toBe(1)
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
  test('a member without a username is sent to onboarding first', async ({ page, baseURL }) => {
    const email = `nousername-${Date.now()}@example.test`
    const created = await page.request.post('/api/auth/sign-up/email', {
      headers: fixtureHeaders(baseURL!), data: { name: 'New member', email, password: 'rehearsal-password-2026' },
    })
    expect(created.status()).toBe(201)
    await signIn(page, baseURL!, email)
    for (const path of ['/', '/signin', '/signup', '/overview', '/journal', '/passport', '/import', '/settings']) {
      await page.goto(path)
      await page.waitForURL(url => url.pathname === '/onboarding' && url.search === '?step=name')
    }
    await page.goto('/onboarding?step=reveal')
    await page.waitForURL(url => url.pathname === '/onboarding' && url.search === '?step=name')
    await expect(page.locator('main h1')).toBeVisible()
  })
})

test('a guest hitting a member page gets a 307 to sign-in, not a streamed 200', async ({ request }) => {
  for (const path of ['/overview', '/journal', '/passport']) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(307)
    expect(new URL(response.headers().location, 'http://x').pathname).toBe('/signin')
  }
})
