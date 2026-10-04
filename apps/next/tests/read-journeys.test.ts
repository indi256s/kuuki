import { test, expect, type Page } from '@playwright/test'

async function signIn(page: Page, baseURL: string, email = 'a@example.test') {
  const response = await page.request.post('/api/auth/sign-in/email', {
    headers: { Origin: baseURL }, data: { email, password: 'rehearsal-password-2026' },
  })
  expect(response.status()).toBe(200)
}

test('Journal filters survive refresh and back without a duplicate mount list read', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  const listReads: string[] = []
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/flights' && request.method() === 'GET') listReads.push(request.url())
  })
  await page.goto('/journal')
  await expect(page.locator('.flight-row')).toHaveCount(1)
  expect(listReads).toHaveLength(0)
  await page.getByRole('searchbox').fill('NO-SUCH-FLIGHT')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.waitForURL(url => url.searchParams.get('q') === 'NO-SUCH-FLIGHT')
  await expect(page.getByRole('heading', { name: 'Nothing matches these filters.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('searchbox')).toHaveValue('NO-SUCH-FLIGHT')
  await page.goBack()
  await expect(page.locator('.flight-row')).toHaveCount(1)
  await page.locator('.flight-row').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('link', { name: 'Edit or delete flight' }).click()
  await page.waitForURL(/\/journal\/\d+\/edit$/)
  await expect(page.getByRole('button', { name: 'Save flight' })).toBeVisible()
})

test('the period stays with the map while ordinary read navigation stays lightweight', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  const heavy: string[] = []
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (path.startsWith('/maps/') && !path.endsWith('.svg') || path.includes('route-projection')) heavy.push(path)
  })
  await page.goto('/overview?period=2026')
  await expect(page.getByTestId('overview-data').locator('.hero-stat strong')).toHaveText('1')
  expect(heavy).toHaveLength(0)
  const mapLink = page.getByRole('link', { name: /Open Passport map/ })
  await expect(mapLink).toHaveAttribute('href', /period=2026/)
  await page.goto('/passport')
  await expect(page.getByTestId('passport-data')).toBeVisible()
  expect(heavy).toHaveLength(0)
  await page.getByRole('button', { name: /United States/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('JFK')
  await page.keyboard.press('Escape')
  await page.goto('/overview?period=2024')
  await expect(page.getByTestId('overview-data').locator('.hero-stat strong')).toHaveText('0')
})

test('auth validation and real sign-in reach the owned overview', async ({ page }) => {
  await page.goto('/signin')
  await page.getByLabel('Email', { exact: true }).fill('a@example.test')
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('incorrect')
  await page.getByLabel('Password', { exact: true }).fill('rehearsal-password-2026')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(url => url.pathname === '/overview')
  await expect(page.getByTestId('overview-data').locator('.hero-stat strong')).toHaveText('1')
  await page.goto('/?mode=signin')
  await page.waitForURL(url => url.pathname === '/overview')
})

test('withdrawing public visibility blocks new document, RSC and API statistics', async ({ page, context, browser, baseURL }) => {
  await signIn(page, baseURL!)
  const csrf = (await context.cookies(baseURL!)).find(cookie => cookie.name === 'kuuki_csrf')!.value
  const update = async (isPublic: boolean) => {
    const response = await page.request.patch('/api/profiles/me', {
      headers: { Origin: baseURL!, 'X-CSRF-Token': decodeURIComponent(csrf) },
      data: { is_public: isPublic },
    })
    expect(response.status()).toBe(200)
  }
  const visitor = await browser.newContext({ baseURL })
  try {
    await update(true)
    const visible = await visitor.request.get('/api/public/profiles/fixture-a')
    expect((await visible.json()).stats.total_flights).toBe(1)
    const visitorPage = await visitor.newPage()
    await visitorPage.goto('/fly/fixture-a')
    await expect(visitorPage.locator('main')).toContainText('Statistics')
    await update(false)
    const hidden = await visitor.request.get('/api/public/profiles/fixture-a')
    expect(await hidden.json()).toMatchObject({ profile: { bio: null, display_name: null, avatar_url: null, theme_color: null, created_at: null }, stats: null, badges: [], rankings: [] })
    const rsc = await visitor.request.get('/fly/fixture-a', { headers: { RSC: '1' } })
    expect(rsc.headers()['cache-control']).toContain('no-store')
    expect(await rsc.text()).not.toContain('a@example.test')
    await visitorPage.goto('/fly/fixture-a')
    await expect(visitorPage.locator('main')).toContainText('This profile is private.')
    await expect(visitorPage.locator('.profile-stats')).toHaveCount(0)
  } finally {
    await update(true)
    await visitor.close()
  }
})

test('RU read controls fit narrow and desktop viewports in both themes', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'kuuki_locale', value: 'ru', url: baseURL! }])
  await signIn(page, baseURL!)
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
    for (const route of ['/overview', '/journal', '/passport', '/settings', '/leaderboard']) {
      await page.goto(route)
      await expect(page.locator('main h1')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  }
  await page.locator('header').getByRole('combobox', { name: 'Тема' }).selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.goto('/journal')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
