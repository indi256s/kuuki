import { test, expect, type Page } from '@playwright/test'
import { claimUsername } from './helpers'

// Each journey owns a fresh account, so claims and visits it writes never leak into the shared fixture.
async function account(page: Page, origin: string) {
  const signup = await page.request.post('/api/auth/sign-up/email', { headers: { Origin: origin }, data: { email: `passport-${crypto.randomUUID()}@example.test`, password: 'passport-password-2026' } })
  expect(signup.status()).toBe(201)
  await claimUsername(page, origin)
  const csrf = decodeURIComponent((await page.context().cookies()).find(cookie => cookie.name === 'kuuki_csrf')!.value)
  const headers = { Origin: origin, 'X-CSRF-Token': csrf }
  const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
  const create = async (date: string, origin: string, destination: string) => {
    const result = await page.request.post('/api/flights', { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { date, origin, destination, flight_number: `KU${Math.floor(Math.random() * 9000) + 100}`, timezone: 'UTC' } })
    expect(result.status()).toBe(201)
    return (await result.json()).id as number
  }
  /** Created ahead and moved into the past: the flight waits for its arrival confirmation. */
  const awaiting = async (origin: string, destination: string) => {
    const id = await create(day(2), origin, destination)
    const patch = await page.request.patch(`/api/flights/${id}`, { headers, data: { date: day(-1), timezone: 'UTC' } })
    expect((await patch.json()).lifecycle_state).toBe('awaiting')
    return id
  }
  const published = async (pressed: number, pending: number) => expect.poll(async () => {
    const data = await (await page.request.get('/api/passport/countries')).json() as { pressedCountryCount: number; pendingCountryCount: number }
    return [data.pressedCountryCount, data.pendingCountryCount]
  }).toEqual([pressed, pending])
  const write = (method: 'PUT' | 'POST', path: string, data?: unknown) => page.request.fetch(path, { method, headers, data })
  return { create, awaiting, published, day, write }
}

test('stamps open by keyboard and deep link, sort in the URL, and a pending slot reaches its arrival card', async ({ page, baseURL }) => {
  test.setTimeout(60_000)
  const { awaiting, published, write } = await account(page, baseURL!)
  // The fixture references only JFK and BOS, so the awaiting-only country is the United States.
  const pending = await awaiting('JFK', 'BOS')
  expect((await write('PUT', '/api/passport/claims/GR')).status()).toBe(201)
  expect((await write('POST', '/api/passport/ground-visits', { countryCode: 'CH', visitYear: 2018, entryMethod: 'land' })).status()).toBe(201)
  await published(2, 1)

  await page.goto('/passport')
  const data = page.getByTestId('passport-data')
  await expect(data.locator('.passport-figures strong').first()).toHaveText('3')
  await expect(data.getByText('of 246')).toBeVisible()
  await expect(data.getByRole('link', { name: '1 waiting for confirmation' })).toBeVisible()
  // Under Recent, the unpressed slot leads the page.
  await expect(data.locator('.passport-cell').first()).toHaveAttribute('data-status', 'pending')

  const stamp = data.getByRole('button', { name: /^Greece, claimed without flights/ })
  await stamp.focus()
  await page.keyboard.press('Enter')
  await page.waitForURL(url => url.searchParams.get('country') === 'GR')
  await expect(page.getByRole('dialog', { name: 'Greece' })).toContainText('Claimed without flights')
  await page.keyboard.press('Escape')
  await page.waitForURL(url => !url.searchParams.has('country'))
  await expect(stamp).toBeFocused()

  await data.getByRole('radio', { name: 'A–Z' }).click()
  await page.waitForURL(url => url.searchParams.get('sort') === 'name')
  await expect(page.locator('main h1')).not.toBeFocused()

  await page.goto('/passport?country=ch')
  await page.waitForURL(url => url.search === '?country=CH')
  await expect(page.getByRole('dialog', { name: 'Switzerland' })).toContainText('2018 · by land')
  await page.keyboard.press('Escape')

  await data.getByRole('link', { name: 'United States: waiting for confirmation. Open the arrival card' }).click()
  await page.waitForURL(url => url.pathname === '/journal' && url.hash === `#arrival-${pending}`)
  await expect(page.locator(`#awaiting-queue [data-confirm-flight="${pending}"]`)).toBeFocused()
})

test('a country is added from search, claimed, visited by sea, and removed with its exact consequence', async ({ page, baseURL }) => {
  test.setTimeout(60_000)
  await account(page, baseURL!)
  await page.goto('/passport')
  const data = page.getByTestId('passport-data')
  await expect(data.getByRole('heading', { name: '246 countries are waiting for you' })).toBeVisible()
  await expect(data.locator('.passport-ghost')).toHaveCount(6)

  await data.getByRole('button', { name: 'Add country', exact: true }).click()
  const add = page.getByRole('dialog', { name: 'Add country' })
  await add.getByRole('searchbox', { name: 'Find a country' }).fill('Iceland')
  await add.getByRole('list', { name: 'Countries' }).getByRole('button', { name: /^Iceland/ }).click()
  await page.waitForURL(url => url.searchParams.get('country') === 'IS')
  const sheet = page.getByRole('dialog', { name: 'Iceland' })
  await expect(sheet).toContainText('Not in your passport yet')

  await sheet.getByRole('button', { name: 'Claim without a visit' }).click()
  await expect(sheet.getByRole('status').filter({ hasText: 'Country claimed.' })).toBeVisible()
  // The modal sheet hides the page from the accessibility tree, so the new stamp is found by its markup.
  await expect(data.locator('.stamp[data-kind="claim"] .stamp-code', { hasText: 'IS' })).toBeAttached()

  await sheet.getByRole('radio', { name: 'By sea' }).click()
  await sheet.getByRole('textbox', { name: /^Year/ }).fill('2019')
  await sheet.getByRole('button', { name: 'Add visit', exact: true }).click()
  await expect(sheet.getByText('2019 · by sea')).toBeVisible()

  await sheet.getByRole('button', { name: 'Actions for visit 2019 · by sea' }).click()
  await page.getByRole('menuitem', { name: 'Delete visit' }).click()
  const deleteVisit = page.getByRole('dialog', { name: 'Delete the 2019 visit?' })
  await expect(deleteVisit).toContainText("Only this visit is deleted. The rest of this country's record stays.")
  await deleteVisit.getByRole('button', { name: 'Delete visit' }).click()
  await expect(sheet.getByText('2019 · by sea')).toHaveCount(0)

  const consequence = 'This deletes your claim. Flights in your journal are not deleted. The stamp disappears from your passport.'
  await expect(sheet.getByText(consequence)).toBeVisible()
  await sheet.getByRole('button', { name: 'Remove country' }).click()
  const confirm = page.getByRole('dialog', { name: 'Remove Iceland from your passport?' })
  await expect(confirm).toContainText(consequence)
  await confirm.getByRole('button', { name: 'Remove country' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(data.getByRole('status').filter({ hasText: 'Iceland was removed from your passport.' })).toBeVisible()
  await expect(data.getByRole('heading', { name: '246 countries are waiting for you' })).toBeVisible()
  await expect(page.locator('main h1')).toBeFocused()
})

test('map layers live in the URL and the country list opens the same sheet', async ({ page, baseURL }) => {
  const { create, published, day } = await account(page, baseURL!)
  await create(day(-10), 'JFK', 'BOS')
  await published(1, 0)
  await page.goto('/passport?view=map')
  const layers = page.getByRole('radiogroup', { name: 'Map layer' })
  await expect(layers.getByRole('radio', { name: 'Countries' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('list', { name: 'Route list', exact: true })).toHaveCount(0)
  await layers.getByRole('radio', { name: 'Routes' }).click()
  await page.waitForURL(url => url.searchParams.get('layer') === 'routes')
  await expect(page.getByRole('list', { name: 'Route list', exact: true }).getByRole('button', { name: /JFK → BOS/ })).toBeVisible()
  await layers.getByRole('radio', { name: 'Frequency' }).click()
  await page.waitForURL(url => url.searchParams.get('layer') === 'frequency')
  await page.getByRole('list', { name: 'Visited countries', exact: true }).getByRole('button', { name: /United States/ }).click()
  await page.waitForURL(url => url.searchParams.get('country') === 'US')
  await expect(page.getByRole('dialog', { name: 'United States' })).toContainText('JFK')
})
