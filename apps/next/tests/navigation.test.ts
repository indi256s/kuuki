import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { signIn, fixtureHeaders } from './helpers'

// The @next/playwright instant() shell-timing gate is deferred until the
// Cloudflare adapter can serve the required Cache Components configuration.
// These checks cover final navigation and privacy under standard streaming.

test('direct Overview navigation renders authorized summary', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await page.goto('/overview')
  await expect(page.locator('h1')).toHaveText('Overview')
  await expect(page.getByTestId('overview-data')).toBeVisible()
  await expect(page.getByTestId('overview-flights')).toHaveText('1')
})

test('read-route navigation settles on authorized content', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await page.goto('/overview')
  await expect(page.getByTestId('overview-data')).toBeVisible()
  for (const [route, heading] of [['journal', 'Journal'], ['passport', 'Passport'], ['overview', 'Overview']]) {
    await page.locator(`nav:is([aria-label="Primary"], [aria-label="Tabs"]) a[href="/${route}"]:visible`).click()
    await page.waitForURL(url => url.pathname === `/${route}`)
    await expect(page.locator('h1')).toHaveText(heading)
    await expect(page.getByTestId(`${route}-data`)).toBeVisible()
    await expect(page.locator(`nav:is([aria-label="Primary"], [aria-label="Tabs"]) a[href="/${route}"]:visible`)).toHaveAttribute('aria-current', 'page')
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
  await expect(page.getByTestId('overview-flights')).toHaveText('1')
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
  await expect(page.getByTestId('overview-empty')).toBeVisible()
  await expect(page.getByTestId('overview-flights')).toHaveCount(0) // the sample preview never carries the real figure
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

// One real sign-in for the added scenarios: sign-in is rate limited per IP across the whole suite.
let memberCookies: Awaited<ReturnType<BrowserContext['cookies']>> = []
test.beforeAll(async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await signIn(page, baseURL!)
  memberCookies = await context.cookies()
  await context.close()
})
async function asMember(page: Page) { await page.context().addCookies(memberCookies) }

test.describe('legacy and normalized URLs', () => {
  test('/journey replaces to Overview', async ({ page }) => {
    await asMember(page)
    await page.goto('/journey')
    await page.waitForURL(url => url.pathname === '/overview')
    await expect(page.locator('h1')).toHaveText('Overview')
  })

  test('/flights maps legacy params onto the journal', async ({ page }) => {
    await asMember(page)
    await page.goto('/flights?search=x')
    await page.waitForURL(url => url.pathname === '/journal')
    expect(new URL(page.url()).search).toBe('?q=x')
    await expect(page.locator('h1')).toHaveText('Journal')
  })

  test('/dashboard keeps the year and drops obsolete filters', async ({ page }) => {
    await asMember(page)
    await page.goto('/dashboard?year=2024&airline=BA&route=A-B')
    await page.waitForURL(url => url.pathname === '/overview')
    expect(new URL(page.url()).search).toBe('?year=2024')
  })

  test('legacy period and invalid year normalize once', async ({ page }) => {
    await asMember(page)
    await page.goto('/overview?period=2024')
    await page.waitForURL(url => url.search === '?year=2024')
    await page.goto('/overview?year=nope')
    await page.waitForURL(url => url.pathname === '/overview' && url.search === '')
  })

  test('invalid passport query normalizes without a loop', async ({ page }) => {
    await asMember(page)
    const documents: string[] = []
    page.on('request', request => { if (request.isNavigationRequest()) documents.push(new URL(request.url()).pathname + new URL(request.url()).search) })
    await page.goto('/passport?view=bogus&country=jp')
    await page.waitForURL(url => url.pathname === '/passport' && url.search === '?country=JP')
    await expect(page.locator('h1')).toHaveText('Passport')
    await page.waitForTimeout(500)
    expect(documents.filter(entry => entry.startsWith('/passport')).length).toBeLessThanOrEqual(2)
    expect(new URL(page.url()).search).toBe('?country=JP')
  })

  test('onboarding falls back from unearned steps', async ({ page }) => {
    await asMember(page)
    await page.goto('/onboarding?step=bogus')
    await page.waitForURL(url => url.pathname === '/onboarding' && url.search !== '' && !url.search.includes('bogus'))
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

test.describe('entry behavior', () => {
  test('guest landing has no member navigation and offers sign in and sign up', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('nav[aria-label="Primary"]')).toHaveCount(0)
    await expect(page.locator('header a[href="/add"]')).toHaveCount(0)
    await expect(page.locator('a[href="/signin"]').first()).toBeVisible()
    await expect(page.locator('a[href="/signup"]').first()).toBeVisible()
  })

  test('guest leaderboard shows the guest header, not member navigation', async ({ page }) => {
    await page.goto('/leaderboard')
    await expect(page.locator('h1')).toHaveText('Leaderboard')
    await expect(page.locator('nav[aria-label="Primary"]')).toHaveCount(0)
    await expect(page.locator('header a[href="/signin"]')).toBeVisible()
    await expect(page.locator('header a[href="/signup"]')).toBeVisible()
  })

  test('signed-in members skip the landing and auth forms', async ({ page }) => {
    await asMember(page)
    for (const path of ['/', '/signin', '/signup', '/?mode=signin']) {
      await page.goto(path)
      await page.waitForURL(url => url.pathname === '/overview')
    }
  })

  test('legacy /landing and /?mode links keep working for guests', async ({ page }) => {
    await page.goto('/landing')
    await page.waitForURL(url => url.pathname === '/')
    await page.goto('/?mode=signup')
    await page.waitForURL(url => url.pathname === '/signup')
  })

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

test.describe('titles, focus and not-found', () => {
  test('unknown routes show a localized not-found page', async ({ page, context, baseURL }) => {
    const response = await page.goto('/no-such-page')
    expect(response?.status()).toBe(404)
    await expect(page.locator('main h1')).toHaveText('Page not found')
    await expect(page).toHaveTitle('Page not found · Kuuki')
    await context.addCookies([{ name: 'kuuki_locale', value: 'ru', url: baseURL! }])
    await page.goto('/no-such-page')
    await expect(page.locator('main h1')).toHaveText('Страница не найдена')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  })

  test('client navigation updates the title and focuses the heading', async ({ page }) => {
    await asMember(page)
    await page.goto('/overview')
    await expect(page).toHaveTitle('Overview · Kuuki')
    await page.locator('nav:is([aria-label="Primary"], [aria-label="Tabs"]) a[href="/journal"]:visible').click()
    await page.waitForURL(url => url.pathname === '/journal')
    await expect(page.locator('main h1')).toHaveText('Journal')
    await expect(page.locator('main h1')).toBeFocused()
    await expect(page).toHaveTitle('Journal · Kuuki')
    await page.locator('nav:is([aria-label="Primary"], [aria-label="Tabs"]) a[href="/passport"]:visible').click()
    await page.waitForURL(url => url.pathname === '/passport')
    await expect(page.locator('main h1')).toBeFocused()
    await expect(page).toHaveTitle('Passport · Kuuki')
  })

  test('landmarks stay intact: skip link, banner and one main', async ({ page }) => {
    await asMember(page)
    await page.goto('/journal')
    await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#main')
    await expect(page.locator('main#main')).toHaveCount(1)
    await expect(page.locator('main#main header')).toHaveCount(0)
  })
})

test('a guest hitting a member page gets a 307 to sign-in, not a streamed 200', async ({ request }) => {
  for (const path of ['/overview', '/journal', '/passport']) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(307)
    expect(new URL(response.headers().location, 'http://x').pathname).toBe('/signin')
  }
})
