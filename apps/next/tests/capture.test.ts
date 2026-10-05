import { test, expect, type Page } from '@playwright/test'
import { claimUsername } from './helpers'

async function freshAccount(page: Page, origin: string) {
  const email = `capture-${crypto.randomUUID()}@example.test`
  const response = await page.request.post('/api/auth/sign-up/email', {
    headers: { Origin: origin }, data: { email, password: 'capture-password-2026' },
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
  await page.getByRole('button', { name: '＋ Optional details', exact: true }).click()
  await page.getByLabel('Flight number (optional)').fill('AA123')
  await page.getByRole('button', { name: 'Save flight' }).click()
  await expect(page.getByRole('heading', { name: 'Flight saved' })).toBeVisible()
  const edited = await page.request.get(`/api/flights/${flights[0].id}`)
  expect((await edited.json() as { flight_number: string }).flight_number).toBe('AA123')
  await page.goto(`/journal/${flights[0].id}/edit`)
  await page.getByRole('button', { name: 'Delete flight', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Delete flight', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Delete flight', exact: true }).click()
  await page.getByRole('dialog', { name: 'Delete flight?' }).getByRole('button', { name: 'Delete flight', exact: true }).click()
  await page.waitForURL('**/journal')
  expect((await (await page.request.get('/api/flights/all')).json() as unknown[])).toHaveLength(0)
})

test('passport management saves and removes claims and ground notes, then assigns aircraft', async ({ page, baseURL }) => {
  await freshAccount(page, baseURL!)
  await page.goto('/passport/manage?countryCode=US')
  await expect(page.getByLabel('Country')).toHaveValue('US')
  await page.getByRole('button', { name: 'Claim country' }).click()
  await expect(page.getByText('Claimed in passport')).toBeVisible()
  await page.getByLabel('Year (optional)').fill('1800')
  await page.getByLabel('Entry method').selectOption('land')
  await page.getByLabel('Note').fill('Train to Boston')
  await page.getByRole('button', { name: 'Add visit' }).click()
  await expect(page.getByText(/1800 · land · Train to Boston/)).toBeVisible()
  const visits = await page.request.get('/api/passport/ground-visits')
  expect((await visits.json() as { note: string }[])[0].note).toBe('Train to Boston')
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Train to Boston')).toHaveCount(0)
  await page.getByRole('button', { name: 'Remove claim and ground visits' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Not claimed')).toBeVisible()

  await page.goto('/add')
  await fillFlight(page)
  await page.getByRole('button', { name: 'Save flight' }).click()
  await expect(page.getByRole('heading', { name: 'Flight saved' })).toBeVisible()
  await page.goto('/passport/manage')
  await page.getByRole('button', { name: 'Load flights' }).click()
  await expect(page.getByRole('checkbox').first()).toBeVisible()
  await page.getByRole('checkbox').first().check()
  await page.getByLabel('Aircraft type').selectOption('A320')
  await page.getByRole('button', { name: 'Apply to selected' }).click()
  await expect(page.getByText('No flights to update.')).toBeVisible()
  const flights = await page.request.get('/api/flights/all')
  expect((await flights.json() as { aircraft_icao: string }[])[0].aircraft_icao).toBe('A320')
})
