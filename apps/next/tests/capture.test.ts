import { test, expect, type Page } from '@playwright/test'
import { claimUsername, fixtureHeaders } from './helpers'

async function freshAccount(page: Page, origin: string) {
  const email = `capture-${crypto.randomUUID()}@example.test`
  const response = await page.request.post('/api/auth/sign-up/email', {
    headers: fixtureHeaders(origin), data: { email, password: 'capture-password-2026' },
  })
  expect(response.status()).toBe(201)
  await claimUsername(page, origin)
}

async function fillFlight(page: Page) {
  await page.getByLabel('Date').fill('2025-06-01')
  for (const [label, code] of [['From', 'JFK'], ['To', 'BOS']]) {
    await page.getByRole('combobox', { name: label }).click()
    const search = page.getByRole('dialog', { name: label, exact: true })
    await search.getByRole('combobox', { name: label }).fill(code)
    await search.getByRole('option', { name: new RegExp(`^${code} `) }).click()
  }
}

test('calendar stays anchored to the date field with tappable days at 320px', async ({ page, baseURL }) => {
  await freshAccount(page, baseURL!)
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/add')
  await page.getByRole('button', { name: 'Calendar' }).click()
  const geometry = await page.locator('.flight-calendar').evaluate(calendar => {
    const popover = calendar.querySelector<HTMLElement>('.flight-calendar-popover')!
    const days = [...popover.querySelectorAll<HTMLButtonElement>('.flight-calendar-grid button')]
    const box = popover.getBoundingClientRect()
    const calendarBox = calendar.getBoundingClientRect()
    return {
      top: box.top,
      calendarBottom: calendarBox.bottom,
      left: box.left,
      right: box.right,
      minDayWidth: Math.min(...days.map(day => day.getBoundingClientRect().width)),
      minDayHeight: Math.min(...days.map(day => day.getBoundingClientRect().height)),
    }
  })
  expect(Math.abs(geometry.top - geometry.calendarBottom)).toBeLessThanOrEqual(1)
  expect(geometry.left).toBeGreaterThanOrEqual(0)
  expect(geometry.right).toBeLessThanOrEqual(320)
  expect(geometry.minDayWidth).toBeGreaterThanOrEqual(44)
  expect(geometry.minDayHeight).toBeGreaterThanOrEqual(44)
})

test('manual capture retries the original uncertain save, then edits and deletes the flight', async ({ page, baseURL }) => {
  await freshAccount(page, baseURL!)
  await page.goto('/add')
  await fillFlight(page)
  let firstKey = ''
  let writes = 0
  await page.route('**/api/flights', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    writes++
    const key = route.request().headers()['idempotency-key']
    if (writes === 1) {
      firstKey = key
      const accepted = await route.fetch()
      expect(accepted.status()).toBe(201)
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Response lost"}' })
    } else {
      expect(key).toBe(firstKey)
      await route.continue()
    }
  })
  await page.getByRole('button', { name: 'Save flight' }).click()
  await expect(page.getByRole('button', { name: 'Retry original save' })).toBeVisible()
  await page.getByRole('button', { name: 'Retry original save' }).click()
  await expect(page.getByRole('heading', { name: 'Flight saved' })).toBeVisible()
  expect(writes).toBe(2)

  const listing = await page.request.get('/api/flights/all')
  expect(listing.status()).toBe(200)
  const flights = await listing.json() as { id: number }[]
  expect(flights).toHaveLength(1)
  await page.goto(`/journal/${flights[0].id}/edit`)
  await page.getByRole('button', { name: 'Optional details', exact: true }).click()
  await page.getByLabel('Flight number (optional)').fill('AA123')
  await page.getByRole('button', { name: 'Save flight' }).click()
  await expect(page.getByRole('heading', { name: 'Flight saved' })).toBeVisible()
  const edited = await page.request.get(`/api/flights/${flights[0].id}`)
  expect((await edited.json() as { flight_number: string }).flight_number).toBe('AA123')
  await page.goto(`/journal/${flights[0].id}/edit`)
  await page.getByRole('button', { name: 'Delete flight', exact: true }).click()
  await expect(page.getByRole('dialog', { name: /^Delete .+ → .+\?$/ }).getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Delete flight', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Delete flight', exact: true }).click()
  await page.getByRole('dialog', { name: /^Delete .+ → .+\?$/ }).getByRole('button', { name: 'Delete flight', exact: true }).click()
  await page.waitForURL('**/journal')
  expect((await (await page.request.get('/api/flights/all')).json() as unknown[])).toHaveLength(0)
})

test('a legacy countryCode link lands on that country in Passport, and anything else stays on the aircraft page', async ({ page, baseURL }) => {
  await freshAccount(page, baseURL!)
  // Country claims, visits and removal are covered in passport.test.ts through the Passport sheets.
  await page.goto('/passport/manage?countryCode=US')
  await page.waitForURL(url => url.pathname === '/passport' && url.search === '?country=US')
  await expect(page.getByRole('dialog', { name: 'United States' })).toBeVisible()
  for (const bad of ['?countryCode=ZZ', '?countryCode=us', '']) {
    await page.goto(`/passport/manage${bad}`)
    await expect(page.getByRole('heading', { name: 'Aircraft in journal', level: 1 })).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/passport/manage')
  }
})

test('bulk aircraft assignment still works from the Aircraft in journal page', async ({ page, baseURL }) => {
  await freshAccount(page, baseURL!)
  await page.goto('/add')
  await fillFlight(page)
  await page.getByRole('button', { name: 'Save flight' }).click()
  await expect(page.getByRole('heading', { name: 'Flight saved' })).toBeVisible()
  await page.goto('/passport/manage')
  await page.getByRole('button', { name: 'Load flights' }).click()
  await expect(page.getByRole('checkbox').first()).toBeVisible()
  await page.getByRole('checkbox').first().check()
  await page.getByRole('combobox', { name: 'Aircraft type', exact: true }).click()
  const aircraft = page.getByRole('dialog', { name: 'Aircraft type', exact: true })
  await aircraft.getByRole('combobox', { name: 'Aircraft type', exact: true }).fill('A320')
  await aircraft.getByRole('option', { name: /^A320 / }).click()
  await page.getByRole('button', { name: 'Apply to selected' }).click()
  await expect(page.getByText('No flights to update.')).toBeVisible()
  const flights = await page.request.get('/api/flights/all')
  expect((await flights.json() as { aircraft_icao: string }[])[0].aircraft_icao).toBe('A320')
})
