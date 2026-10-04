import { test, expect, type Page } from '@playwright/test'

// The @next/playwright instant() shell-timing gate is deferred until the
// Cloudflare adapter can serve the required Cache Components configuration.
// These checks cover final navigation and privacy under standard streaming.

async function signIn(page: Page, baseURL: string, email = 'a@example.test') {
  const response = await page.request.post('/api/auth/sign-in/email', {
    headers: { Origin: baseURL }, data: { email, password: 'rehearsal-password-2026' },
  })
  expect(response.status()).toBe(200)
}

test('direct Overview navigation renders authorized summary', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await page.goto('/overview')
  await expect(page.locator('h1')).toHaveText('Overview')
  await expect(page.getByTestId('overview-data')).toBeVisible()
  await expect(page.getByTestId('overview-data').locator('.hero-stat strong')).toHaveText('1')
})

test('read-route navigation settles on authorized content', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await page.goto('/overview')
  await expect(page.getByTestId('overview-data')).toBeVisible()
  for (const [route, heading] of [['journal', 'Journal'], ['passport', 'Passport'], ['overview', 'Overview']]) {
    await page.locator(`header nav a[href="/${route}"]:visible`).click()
    await page.waitForURL(url => url.pathname === `/${route}`)
    await expect(page.locator('h1')).toHaveText(heading)
    await expect(page.getByTestId(`${route}-data`)).toBeVisible()
    await expect(page.locator(`header nav a[href="/${route}"]:visible`)).toHaveAttribute('aria-current', 'page')
  }
})

test('fresh documents, RSC and API reads isolate account data without response cookies', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  const a = await page.request.get('/api/me/overview')
  expect(a.status()).toBe(200)
  const aData = await a.json()
  expect(aData.totals.flights).toBe(1)
  await page.goto('/overview')
  await expect(page.getByTestId('overview-data')).toBeVisible()
  await expect(page.getByTestId('overview-data').locator('.hero-stat strong')).toHaveText('1')
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
  const b = await page.request.get('/api/me/overview')
  expect(b.status()).toBe(200)
  expect((await b.json()).totals.flights).toBe(0)
  await page.goto('/overview')
  await expect(page.getByTestId('overview-data')).toBeVisible()
  await expect(page.getByTestId('overview-data').locator('.hero-stat strong')).toHaveText('0')
})

test('API misses and legacy asset misses never return app HTML', async ({ request }) => {
  for (const path of ['/api', '/api/no-such-route']) {
    const response = await request.get(path)
    expect(response.status()).toBe(404)
    expect(response.headers()['content-type']).toContain('application/json')
  }
  const method = await request.get('/api/flights/aircraft-batch')
  expect(method.status()).toBe(405)
  expect(method.headers()['allow']).toBe('POST')
  const asset = await request.get('/legacy/assets/missing.js')
  expect(asset.status()).toBe(404)
  expect(asset.headers()['content-type']).not.toContain('text/html')
})

test('guest read routes settle at sign-in', async ({ page }) => {
  await page.goto('/journal')
  await page.waitForURL(url => url.pathname === '/signin')
})
