import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { signIn as authenticate, claimUsername } from './helpers'

// Share real sessions within this file so the suite stays inside production auth limits.
let fixtureCookies: Awaited<ReturnType<BrowserContext['cookies']>> | undefined
let journalCookies: Awaited<ReturnType<BrowserContext['cookies']>> | undefined
async function signIn(page: Page, origin: string) {
  if (fixtureCookies) return page.context().addCookies(fixtureCookies)
  await authenticate(page, origin)
  fixtureCookies = await page.context().cookies()
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
  await page.locator('[data-flight-row]').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.waitForURL(url => url.searchParams.has('flight'))
  const id = new URL(page.url()).searchParams.get('flight')!
  await page.getByRole('button', { name: 'Edit flight', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save flight' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.waitForURL(url => !url.searchParams.has('flight'))
  await page.goto(`/journal/${id}/edit`)
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
  await expect(page.getByTestId('overview-flights')).toHaveText('1')
  expect(heavy).toHaveLength(0)
  const mapLink = page.getByRole('link', { name: /Open Passport map/ })
  await expect(mapLink).toHaveAttribute('href', /year=2026/)
  await page.goto('/passport')
  await expect(page.getByTestId('passport-data')).toBeVisible()
  expect(heavy).toHaveLength(0)
  await page.getByRole('button', { name: /United States/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('JFK')
  await page.keyboard.press('Escape')
  await page.goto('/overview?period=2024')
  await expect(page.getByTestId('overview-empty-year')).toBeVisible()
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
  await expect(page.getByTestId('overview-flights')).toHaveText('1')
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
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route} at ${width}px`).toBe(true)
    }
  }
  await page.getByRole('button', { name: 'Меню аккаунта' }).click()
  await page.getByRole('menuitemradio', { name: 'Тёмная' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.goto('/journal')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})


async function journalAccount(page: Page, origin: string) {
  if (journalCookies) await page.context().addCookies(journalCookies)
  else {
    const response = await page.request.post('/api/auth/sign-up/email', { headers: { Origin: origin }, data: { email: `journal-${crypto.randomUUID()}@example.test`, password: 'journal-password-2026' } })
    expect(response.status()).toBe(201)
    await claimUsername(page, origin)
    journalCookies = await page.context().cookies()
  }
  const csrf = decodeURIComponent((await page.context().cookies()).find(cookie => cookie.name === 'kuuki_csrf')!.value)
  const headers = { Origin: origin, 'X-CSRF-Token': csrf }
  const create = async (date: string, flightNumber: string, details: Record<string, string> = {}) => {
    const result = await page.request.post('/api/flights', { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { date, origin: 'JFK', destination: 'BOS', flight_number: flightNumber, timezone: 'UTC', ...details } })
    expect(result.status()).toBe(201)
    return (await result.json()).id as number
  }
  const awaiting = async (number: string, details: Record<string, string> = {}) => {
    const today = new Date().toISOString().slice(0, 10)
    const future = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    expect(yesterday < today).toBe(true)
    const id = await create(future, number, details)
    const patch = await page.request.patch(`/api/flights/${id}`, { headers, data: { date: yesterday, timezone: 'UTC' } })
    expect(patch.status()).toBe(200)
    expect((await patch.json()).lifecycle_state).toBe('awaiting')
    return id
  }
  return { create, awaiting, headers }
}

test('Journal stages mobile filters, preserves detail/reset state and maps legacy keys', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await page.goto('/flights?year=2026&airlineIata=AA&sortField=distance_km&sortOrder=asc&isUpcoming=false')
  await page.waitForURL(url => url.pathname === '/journal')
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ year: '2026', airline: 'AA', sort: 'distance_km', order: 'asc', status: 'completed' })
  // A non-canonical query lands on its canonical form (the redirect runs before the list reads).
  await page.goto('/journal?airlineIata=AA&status=bogus')
  await page.waitForURL(url => url.searchParams.get('airline') === 'AA')
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ airline: 'AA' })
  await page.goto('/journal?year=2026&airport=JFK&queue=awaiting&order=asc')
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('logged')
  await page.getByRole('button', { name: 'Close filters' }).click()
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('')
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('upcoming')
  expect(new URL(page.url()).searchParams.has('status')).toBe(false)
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await page.waitForURL(url => url.searchParams.get('status') === 'upcoming')
  await page.goBack()
  await expect(page.locator('.flight-row')).toHaveCount(1)
  await page.locator('[data-flight-row]').click()
  await page.waitForURL(url => url.searchParams.has('flight'))
  expect(new URL(page.url()).searchParams.get('airport')).toBe('JFK')
  await page.getByRole('button', { name: 'Close flight' }).click()
  await page.waitForURL(url => !url.searchParams.has('flight'))
  await page.getByRole('link', { name: 'Reset filters', exact: true }).click()
  await page.waitForURL(url => !url.searchParams.has('airport'))
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ queue: 'awaiting', order: 'asc' })
  await page.getByRole('button', { name: /^Add aircraft/ }).click()
  // The editor opens on Optional details with the aircraft field focused; on a phone, focusing the field opens its picker.
  await expect(page.getByRole('combobox', { name: 'Aircraft (optional)' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Save flight' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.waitForURL(url => !url.searchParams.has('flight'))
  await page.locator('[data-flight-row]').click()
  await page.getByRole('button', { name: 'Delete flight', exact: true }).click()
  await page.getByRole('dialog', { name: /^Delete .+ → .+\?$/ }).getByRole('button', { name: 'Delete flight', exact: true }).click()
  await page.waitForURL(url => !url.searchParams.has('flight'))
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('.flight-row')).toHaveCount(1)
  await expect(page.locator('[data-flight-row]')).toBeFocused()
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ queue: 'awaiting', order: 'asc' })
  await page.setViewportSize({ width: 1200, height: 800 })
  await page.getByRole('button', { name: 'Distance', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.waitForURL(url => url.searchParams.get('sort') === 'distance_km')
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('logged')
  await page.waitForURL(url => url.searchParams.get('status') === 'logged')
  // Changing a filter by keyboard keeps focus on the control, and an invalid value is flagged instead of silently dropped.
  const status = page.getByRole('combobox', { name: 'Status', exact: true })
  await status.focus()
  await status.selectOption('completed')
  await page.waitForURL(url => url.searchParams.get('status') === 'completed')
  await expect(status).toBeFocused()
  const airport = page.getByRole('textbox', { name: 'Airport', exact: true })
  await airport.fill('X1')
  await airport.press('Enter')
  await expect(airport).toHaveAttribute('aria-invalid', 'true')
  await expect(airport).toBeFocused()
  expect(new URL(page.url()).searchParams.has('airport')).toBe(false)
})

test('Journal selects the full filtered dataset and deletes after Undo, preserving other years', async ({ page, baseURL }) => {
  test.setTimeout(60000)
  const { headers, create } = await journalAccount(page, baseURL!)
  const bulk = await page.request.post('/api/flights/bulk', { headers, data: { items: Array.from({ length: 21 }, (_, index) => ({ key: crypto.randomUUID(), flight: { date: `2025-01-${String(index + 1).padStart(2, '0')}`, origin: 'JFK', destination: 'BOS', flight_number: `BULK${index}` } })) } })
  expect(bulk.status()).toBe(200)
  expect((await bulk.json()).results.every((result: { status: string }) => result.status === 'created')).toBe(true)
  const keptId = await create('2024-01-01', 'KEPT')
  await page.goto('/journal?year=2025&airport=BOS')
  await expect(page.locator('.flight-row')).toHaveCount(20)
  await expect(page.getByRole('heading', { name: '2025 · Logged' })).toBeVisible()
  await page.getByRole('button', { name: 'Select all matching flights' }).click()
  const actions = page.getByRole('region', { name: 'Selection actions' })
  await expect(actions).toContainText('21 flights')
  await actions.getByRole('button', { name: 'Delete selected flights' }).click()
  await page.getByRole('dialog', { name: 'Delete selected flights' }).getByRole('button', { name: 'Delete selected flights' }).click()
  await expect(page.locator('.flight-row')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('.flight-row')).toHaveCount(20)
  expect((await (await page.request.get('/api/flights?year=2025')).json()).total).toBe(21)
  // Scheduling a delete clears the selection, so Undo restores the flights but not the selection.
  await expect(actions).toHaveCount(0)
  await page.getByRole('button', { name: 'Select all matching flights' }).click()
  await actions.getByRole('button', { name: 'Delete selected flights' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete selected flights' }).click()
  await expect(page.getByRole('heading', { name: 'Nothing matches these filters.' })).toBeVisible({ timeout: 15000 })
  expect((await (await page.request.get('/api/flights')).json()).total).toBe(1)
  await page.getByRole('link', { name: 'Reset filters' }).first().click()
  await expect(page.locator('.flight-row')).toHaveCount(1)
  await expect(page.locator('.flight-row')).toContainText('KEPT')
  // Leave this shared account without old country evidence for the confirmation journey.
  expect((await page.request.delete(`/api/flights/${keptId}`, { headers })).status()).toBe(200)
})

test('awaiting queue survives filters, retries failures, confirms in bulk and hides an empty badge', async ({ page, baseURL }) => {
  const { awaiting } = await journalAccount(page, baseURL!)
  for (const [index, number] of ['QUEUE1', 'QUEUE2', 'QUEUE3'].entries()) await awaiting(number, { origin: index === 1 ? 'BOS' : 'JFK', destination: index === 1 ? 'JFK' : 'BOS', departure_time: `${8 + index * 3}:00`.padStart(5, '0'), arrival_time: `${9 + index * 3}:00`.padStart(5, '0'), origin_tz: 'UTC', dest_tz: 'UTC' })
  await page.goto('/journal?q=NO-SUCH-FLIGHT&queue=awaiting')
  await expect(page.getByRole('heading', { name: 'Nothing matches these filters.' })).toBeVisible()
  await expect(page.locator('#awaiting-queue .awaiting-card')).toHaveCount(3)
  await expect(page.locator('.queue-summary')).toContainText('3')
  await expect(page.getByRole('button', { name: /Flight chain/ })).toHaveCount(1)
  await expect(page.getByText('Left the airport', { exact: true })).toHaveCount(2)
  await page.getByLabel('Left the airport', { exact: true }).first().uncheck()
  let original: unknown
  let writes = 0
  await page.route('**/api/flights/confirm', async route => {
    writes++
    if (writes === 1) { original = route.request().postDataJSON(); expect((original as { items: { arrivalTransit?: boolean }[] }).items.some(item => item.arrivalTransit === true)).toBe(true); return route.fulfill({ status: 503, json: { error: 'Temporary failure' } }) }
    expect(route.request().postDataJSON()).toEqual(original)
    return route.continue()
  })
  await page.getByRole('button', { name: 'Confirm all shown' }).click()
  await expect(page.getByRole('button', { name: 'Retry confirmation' })).toBeVisible()
  await expect(page.locator('#awaiting-queue .awaiting-card')).toHaveCount(3)
  await page.getByRole('button', { name: 'Retry confirmation' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'New stamps: United States.' })).toBeFocused()
  await expect(page.locator('#awaiting-queue .awaiting-card')).toHaveCount(0)
  await expect(page.locator('.queue-summary')).toHaveCount(0)
  expect(writes).toBe(2)
  expect((await (await page.request.get('/api/me/awaiting')).json()).actionableCount).toBe(0)
})

test('did-not-fly Undo, deletion failure and retry keep the actual flight and disable offline actions', async ({ page, context, baseURL }) => {
  test.setTimeout(60000)
  const { awaiting } = await journalAccount(page, baseURL!)
  const id = await awaiting('CANCEL1')
  await page.goto('/journal')
  await page.getByRole('button', { name: 'Did not fly', exact: true }).click()
  await expect(page.locator('#awaiting-queue .awaiting-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('#awaiting-queue .awaiting-card')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Confirm arrival' })).toBeFocused()
  await context.setOffline(true)
  await expect(page.getByRole('button', { name: 'Confirm arrival' })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByText('Offline. Connect to change flights.').first()).toBeVisible()
  await context.setOffline(false)
  await page.route(`**/api/flights/${id}`, route => route.request().method() === 'DELETE' ? route.fulfill({ status: 503, json: { error: 'Delete failed' } }) : route.continue())
  await page.getByRole('button', { name: 'Did not fly', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Delete failed. Your flights are restored.' })).toBeVisible({ timeout: 15000 })
  await expect(page.locator('#awaiting-queue .awaiting-card')).toHaveCount(1)
  expect((await page.request.get(`/api/flights/${id}`)).status()).toBe(200)
  await page.unroute(`**/api/flights/${id}`)
  await page.getByRole('button', { name: 'Retry deletion' }).click()
  await expect(page.locator('.queue-summary')).toHaveCount(0, { timeout: 15000 })
  expect((await page.request.get(`/api/flights/${id}`)).status()).toBe(404)
})
