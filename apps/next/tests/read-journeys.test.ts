import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { signIn as authenticate, claimUsername, fixtureHeaders } from './helpers'

test.use({ viewport: { width: 1100, height: 844 } })

// Share real sessions within this file so the suite stays inside production auth limits.
let fixtureCookies: Awaited<ReturnType<BrowserContext['cookies']>> | undefined
let journalCookies: Awaited<ReturnType<BrowserContext['cookies']>> | undefined
async function signIn(page: Page, origin: string) {
  if (fixtureCookies) return page.context().addCookies(fixtureCookies)
  await authenticate(page, origin)
  fixtureCookies = await page.context().cookies()
}

test('Journal filters restore on reload, replace history, and open a flight without a mount list read', async ({
  page,
  baseURL,
}) => {
  await signIn(page, baseURL!)
  const listReads: string[] = []
  page.on('request', (request) => {
    if (
      ['/api/flights', '/api/flights/journal', '/api/flights/ids'].includes(
        new URL(request.url()).pathname,
      ) &&
      request.method() === 'GET'
    )
      listReads.push(request.url())
  })
  await page.goto('/overview')
  await page
    .locator('nav:is([aria-label="Primary"], [aria-label="Tabs"]) a[href="/journal"]:visible')
    .click()
  await expect(page.locator('[data-kind="flight"]')).toHaveCount(1)
  expect(listReads).toHaveLength(0)
  await page.getByRole('searchbox').fill('NO-SUCH-FLIGHT')
  await page.waitForURL((url) => url.searchParams.get('q') === 'NO-SUCH-FLIGHT')
  await expect(
    page.getByRole('heading', { name: 'Nothing matches these filters', exact: true }),
  ).toBeVisible()
  await page.getByRole('searchbox').fill('STILL-NO-SUCH-FLIGHT')
  await page.waitForURL((url) => url.searchParams.get('q') === 'STILL-NO-SUCH-FLIGHT')
  await page.reload()
  await expect(page.getByRole('searchbox')).toHaveValue('STILL-NO-SUCH-FLIGHT')
  await page.goBack()
  await expect(page).toHaveURL(/\/overview$/)
  await page.goto('/journal')
  await page.locator('[data-flight-row]').click()
  const sheet = page
    .getByRole('dialog')
    .or(page.getByRole('complementary', { name: 'Flight details' }))
  await expect(sheet).toBeVisible()
  await page.waitForURL((url) => url.searchParams.has('flight'))
  const id = new URL(page.url()).searchParams.get('flight')!
  await expect(sheet.getByRole('button', { name: 'Edit flight', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.waitForURL((url) => !url.searchParams.has('flight'))
  await expect(sheet).toHaveCount(0)
  await page.goto(`/journal?flight=${id}`)
  await expect(sheet).toBeVisible()
  await page.goto(`/journal/${id}/edit`)
  await expect(page.getByRole('button', { name: 'Save flight' })).toBeVisible()
})

test('auth validation and real sign-in reach the owned overview', async ({ page }) => {
  await page.goto('/signin')
  await page.getByLabel('Email', { exact: true }).fill('a@example.test')
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('incorrect')
  await page.getByLabel('Password', { exact: true }).fill('rehearsal-password-2026')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/overview')
  await expect(page.getByLabel('Flights', { exact: true })).toHaveText('1')
  await page.goto('/?mode=signin')
  await page.waitForURL((url) => url.pathname === '/overview')
})

test('withdrawing public visibility blocks new document, RSC and API statistics', async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await signIn(page, baseURL!)
  const csrf = (await context.cookies(baseURL!)).find(
    (cookie) => cookie.name === 'kuuki_csrf',
  )!.value
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
    await expect(visitorPage.locator('main')).toContainText('On flights')
    await update(false)
    const hidden = await visitor.request.get('/api/public/profiles/fixture-a')
    expect(await hidden.json()).toMatchObject({
      profile: {
        bio: null,
        display_name: null,
        avatar_url: null,
        theme_color: null,
        created_at: null,
      },
      stats: null,
      badges: [],
      rankings: [],
    })
    const rsc = await visitor.request.get('/fly/fixture-a', { headers: { RSC: '1' } })
    expect(rsc.headers()['cache-control']).toContain('no-store')
    expect(await rsc.text()).not.toContain('a@example.test')
    await visitorPage.goto('/fly/fixture-a')
    await expect(visitorPage.locator('main')).toContainText('This passport is private.')
    await expect(visitorPage.getByRole('heading', { name: 'On flights', exact: true })).toHaveCount(
      0,
    )
  } finally {
    await update(true)
    await visitor.close()
  }
})

async function journalAccount(page: Page, origin: string) {
  if (journalCookies) await page.context().addCookies(journalCookies)
  else {
    const response = await page.request.post('/api/auth/sign-up/email', {
      headers: fixtureHeaders(origin),
      data: {
        email: `journal-${crypto.randomUUID()}@example.test`,
        password: 'journal-password-2026',
      },
    })
    expect(response.status()).toBe(201)
    await claimUsername(page, origin)
    journalCookies = await page.context().cookies()
  }
  const csrf = decodeURIComponent(
    (await page.context().cookies()).find((cookie) => cookie.name === 'kuuki_csrf')!.value,
  )
  const headers = { Origin: origin, 'X-CSRF-Token': csrf }
  const create = async (
    date: string,
    flightNumber: string,
    details: Record<string, string> = {},
  ) => {
    const result = await page.request.post('/api/flights', {
      headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
      data: {
        date,
        origin: 'JFK',
        destination: 'BOS',
        flight_number: flightNumber,
        timezone: 'UTC',
        ...details,
      },
    })
    expect(result.status()).toBe(201)
    return (await result.json()).id as number
  }
  const awaiting = async (number: string, details: Record<string, string> = {}) => {
    const today = new Date().toISOString().slice(0, 10)
    const future = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    expect(yesterday < today).toBe(true)
    const id = await create(future, number, details)
    const patch = await page.request.patch(`/api/flights/${id}`, {
      headers,
      data: { date: yesterday, timezone: 'UTC' },
    })
    expect(patch.status()).toBe(200)
    expect((await patch.json()).lifecycle_state).toBe('awaiting')
    return id
  }
  return { create, awaiting, headers }
}

test('Journal selects the full filtered dataset and preserves deletion across reload, keeping other years', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(60000)
  const { headers, create } = await journalAccount(page, baseURL!)
  const bulk = await page.request.post('/api/flights/bulk', {
    headers,
    data: {
      items: Array.from({ length: 21 }, (_, index) => ({
        key: crypto.randomUUID(),
        flight: {
          date: `2025-01-${String(index + 1).padStart(2, '0')}`,
          origin: 'JFK',
          destination: 'BOS',
          flight_number: `BULK${index}`,
        },
      })),
    },
  })
  expect(bulk.status()).toBe(200)
  expect(
    (await bulk.json()).results.every((result: { status: string }) => result.status === 'created'),
  ).toBe(true)
  const keptId = await create('2024-01-01', 'KEPT')
  await page.goto('/journal?year=2025&airport=BOS')
  await expect(page.locator('[data-kind="flight"]')).toHaveCount(21)
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0)
  await page
    .getByRole('checkbox', { name: /^Select: JFK to BOS/ })
    .first()
    .check()
  await page.getByRole('button', { name: 'Select all 21 matching', exact: true }).click()
  const actions = page.getByRole('region', { name: 'Selection', exact: true })
  await expect(actions).toContainText('21 selected')
  await actions.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('dialog', { name: /Delete/ })).toHaveCount(0)
  await expect(page.locator('[data-kind="flight"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('[data-kind="flight"]')).toHaveCount(21)
  expect((await (await page.request.get('/api/flights?year=2025')).json()).total).toBe(21)
  // Scheduling a delete clears the selection, so Undo restores the flights but not the selection.
  await expect(actions).toHaveCount(0)
  await page
    .getByRole('checkbox', { name: /^Select: JFK to BOS/ })
    .first()
    .check()
  await page.getByRole('button', { name: 'Select all 21 matching', exact: true }).click()
  await actions.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('dialog', { name: /Delete/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('[data-kind="flight"]')).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Nothing matches these filters', exact: true }),
  ).toBeVisible({ timeout: 15000 })
  await expect
    .poll(async () => (await (await page.request.get('/api/flights')).json()).total, {
      timeout: 15000,
    })
    .toBe(1)
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(page.locator('[data-kind="flight"]')).toHaveCount(1)
  await expect(page.locator('[data-kind="flight"]')).toContainText('KEPT')
  // Leave this shared account without old country evidence for the confirmation journey.
  expect((await page.request.delete(`/api/flights/${keptId}`, { headers })).status()).toBe(200)
})

test('review ignores filters, retries the same receipt, and bulk confirmation hides the empty pill', async ({
  page,
  baseURL,
}) => {
  const { awaiting } = await journalAccount(page, baseURL!)
  const ids: number[] = []
  for (const [index, number] of ['QUEUE1', 'QUEUE2', 'QUEUE3'].entries())
    ids.push(
      await awaiting(number, {
        origin: index === 1 ? 'BOS' : 'JFK',
        destination: index === 1 ? 'JFK' : 'BOS',
        departure_time: `${8 + index * 3}:00`.padStart(5, '0'),
        arrival_time: `${9 + index * 3}:00`.padStart(5, '0'),
        origin_tz: 'UTC',
        dest_tz: 'UTC',
      }),
    )
  await page.goto('/journal?q=NO-SUCH-FLIGHT&queue=awaiting')
  // The modal review sheet hides the background ledger from the accessibility tree.
  await expect(
    page.getByRole('heading', {
      name: 'Nothing matches these filters',
      exact: true,
      includeHidden: true,
    }),
  ).toBeVisible()
  const sheet = page
    .getByRole('dialog')
    .or(page.getByRole('complementary', { name: 'Flight details' }))
  await expect(sheet).toContainText('Review 1 of 3')
  await expect(sheet).toContainText('Did you take this flight?')
  await sheet.getByLabel('Left the airport', { exact: true }).uncheck()
  let original: unknown
  let writes = 0
  await page.route('**/api/flights/confirm', async (route) => {
    writes++
    if (writes === 1) {
      original = route.request().postDataJSON()
      expect((original as { items: { arrivalTransit?: boolean }[] }).items[0].arrivalTransit).toBe(
        true,
      )
      return route.fulfill({ status: 503, json: { error: 'Temporary failure' } })
    }
    if (writes === 2) expect(route.request().postDataJSON()).toEqual(original)
    return route.continue()
  })
  await sheet.getByRole('button', { name: 'I flew', exact: true }).click()
  await expect(sheet.getByRole('status').filter({ hasText: 'Confirmed JFK → BOS.' })).toBeVisible()
  expect(writes).toBe(2)
  await expect(page).toHaveURL(new RegExp(`flight=${ids[1]}`))
  await expect(sheet).toContainText('Review 1 of 2')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  for (const id of ids.slice(1))
    await page
      .locator('[data-kind="flight"]')
      .filter({ has: page.locator(`[data-flight-row="${id}"]`) })
      .getByRole('checkbox')
      .check()
  const selection = page.getByRole('region', { name: 'Selection', exact: true })
  await expect(selection).toContainText('2 selected')
  await selection.getByRole('button', { name: 'I flew (2)', exact: true }).click()
  await expect(selection.getByRole('status')).toContainText('Confirmed 2 flights.')
  await expect(page.getByRole('button', { name: /to confirm$/ })).toHaveCount(0)
  expect((await (await page.request.get('/api/me/awaiting')).json()).actionableCount).toBe(0)
})

test('leaving the Journal during Undo cancels the delete, and the shell says so', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(60000)
  const { create, headers } = await journalAccount(page, baseURL!)
  const id = await create('2023-03-03', 'LEAVE1')
  const deletes: string[] = []
  page.on('request', (request) => {
    if (
      request.url().includes('/api/flights') &&
      (request.method() === 'DELETE' || request.url().includes('bulk-delete'))
    )
      deletes.push(request.url())
  })
  await page.goto('/journal?year=2023')
  await expect(page.locator('[data-kind="flight"]')).toHaveCount(1)
  await page.getByRole('checkbox', { name: /^Select: JFK to BOS/ }).check()
  await page
    .getByRole('region', { name: 'Selection', exact: true })
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  // The Undo notice lives in the member shell's toast region, not in the Journal.
  const host = page.locator('.ui-toast-region')
  await expect(host.getByRole('button', { name: 'Undo', exact: true })).toBeFocused()
  await page
    .locator('nav:is([aria-label="Primary"], [aria-label="Tabs"]) a[href="/overview"]:visible')
    .click()
  await page.waitForURL((url) => url.pathname === '/overview')
  const message = host
    .getByRole('status')
    .filter({ hasText: 'Delete cancelled because you left the Journal. Nothing was removed.' })
  await expect(message).toBeVisible()
  await expect(message).toHaveAttribute('aria-live', 'polite')
  await expect(host.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0)
  // Past the six-second window nothing was sent and the flight still exists.
  await page.waitForTimeout(7000)
  expect(deletes).toEqual([])
  expect((await page.request.get(`/api/flights/${id}`)).status()).toBe(200)
  expect((await page.request.delete(`/api/flights/${id}`, { headers })).status()).toBe(200)
})
