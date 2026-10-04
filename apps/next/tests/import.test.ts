import { test, expect, type Page } from '@playwright/test'
import { signIn } from './helpers'

const extracted = (date: string, origin: string, destination: string, explicit = true) => ({
  date, origin, destination, airline_iata: 'AA', confidence: .71,
  field_confidence: { date: .63, date_year_explicit: explicit, origin: .91 },
})

async function startImport(page: Page, flights: object[]) {
  await page.route('**/api/import/parse', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ flights, raw_text: 'DOCUMENT MUST NOT BE STORED' }) }))
  await page.goto('/import')
  await page.getByLabel('Or paste text').fill('synthetic itinerary')
  await page.getByRole('button', { name: 'Find flights' }).click()
  await expect(page.getByRole('heading', { name: 'Review flights' })).toBeVisible()
}

test('review persists structured rows, keeps duplicates unselected, and requires year confirmation', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await page.route('**/api/flights/duplicate-candidates', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ matches: [{ candidateIndex: 0, flightId: 1 }] }) }))
  await startImport(page, [extracted('2025-03-01', 'JFK', 'LAX'), extracted('2025-04-01', 'LAX', 'JFK', false)])
  await expect(page.getByText('Possible duplicate')).toBeVisible()
  await expect(page.locator('.import-row').first().getByRole('checkbox')).not.toBeChecked()
  await expect(page.locator('.import-row').nth(1).getByRole('checkbox')).not.toBeChecked()
  const stored = await page.evaluate(() => Object.entries(localStorage).find(([key]) => key.startsWith('kuuki-import-draft:v1:'))?.[1] ?? '')
  expect(stored).not.toContain('DOCUMENT MUST NOT BE STORED')
  expect(stored).not.toContain('synthetic itinerary')
  const draftId = JSON.parse(stored).id as string
  await page.reload()
  await page.goto(`/import?draft=${draftId}`)
  await expect(page.locator('.import-row')).toHaveCount(2)
  await page.locator('.import-row').nth(1).locator('summary').click()
  await page.getByLabel('I checked the year').check()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.locator('.import-row').nth(1).getByRole('checkbox', { name: /LAX → JFK/ }).check()
  await expect(page.getByRole('button', { name: /Save selected/ })).toBeEnabled()
})

test('partial bulk save retries original failed receipt and reports counts', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await page.route('**/api/flights/duplicate-candidates', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"matches":[]}' }))
  await startImport(page, [extracted('2025-03-01', 'JFK', 'LAX'), extracted('2025-04-01', 'LAX', 'JFK')])
  let firstKey = ''
  let calls = 0
  await page.route('**/api/flights/bulk', async route => {
    calls++
    const body = route.request().postDataJSON() as { items: { key: string; flight: object }[] }
    if (calls === 1) {
      expect(body.items).toHaveLength(2)
      firstKey = body.items[1].key
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ derived_state: 'ready', revision: 2,
        results: [{ status: 'created' }, { status: 'error', http_status: 503, code: 'UNAVAILABLE', error: 'Temporary failure' }] }) })
    } else {
      expect(body.items).toHaveLength(1)
      expect(body.items[0].key).toBe(firstKey)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ derived_state: 'ready', revision: 3,
        results: [{ status: 'replayed' }] }) })
    }
  })
  await page.getByRole('button', { name: /Save selected/ }).click()
  await expect(page.getByText('Saved: 1. Unconfirmed or failed: 1.')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /2 flights/ }).click()
  await expect(page.locator('.import-row').first().getByRole('checkbox')).toBeDisabled()
  await expect(page.locator('.import-row').first()).toContainText('Saved')
  await page.getByRole('button', { name: 'Later' }).click()
  await expect(page.getByRole('button', { name: 'Retry original requests' })).toBeVisible()
  await page.getByRole('button', { name: 'Retry original requests' }).click()
  await expect(page.getByText('Saved: 1. Unconfirmed or failed: 0.')).toBeVisible()
  expect(calls).toBe(2)
})

test('a rejected row needs an explicit new save after editing', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await page.route('**/api/flights/duplicate-candidates', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"matches":[]}' }))
  await startImport(page, [extracted('2025-03-01', 'JFK', 'LAX')])
  const keys: string[] = []
  let calls = 0
  await page.route('**/api/flights/bulk', async route => {
    calls++
    const body = route.request().postDataJSON() as { items: { key: string; flight: { flight_number?: string; destination: string } }[] }
    keys.push(body.items[0].key)
    if (calls === 1) await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ derived_state: 'ready', revision: 1,
      results: [{ status: 'error', http_status: 400, code: 'UNKNOWN_AIRPORT', error: 'Correct this row' }] }) })
    else {
      expect(body.items[0].flight.flight_number).toBe('42')
      expect(body.items[0].flight.destination).toBe('BOS')
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ derived_state: 'ready', revision: 2,
        results: [{ status: 'created' }] }) })
    }
  })
  await page.getByRole('button', { name: /Save selected/ }).click()
  await expect(page.getByText('Saved: 0. Unconfirmed or failed: 1.')).toBeVisible()
  await page.getByRole('button', { name: 'Edit failed rows' }).click()
  await page.locator('.import-row summary').click()
  await page.getByLabel('To (IATA)').fill('BOS')
  await page.getByLabel('Flight number').fill('42')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByRole('button', { name: /Save selected/ }).click()
  await expect(page.getByText('Saved: 0. Unconfirmed or failed: 1.')).toBeVisible()
  expect(calls).toBe(1) // Existing receipt refuses a changed body before any network request.
  await page.getByRole('button', { name: 'Edit failed rows' }).click()
  await page.locator('.import-row summary').click()
  await page.getByRole('button', { name: 'I checked Journal — start a new save for this row' }).click()
  await expect(page.locator('.import-row').getByRole('checkbox')).not.toBeChecked()
  await page.locator('.import-row').getByRole('checkbox').check()
  await page.getByRole('button', { name: /Save selected/ }).click()
  await expect(page.getByText('Saved: 1. Unconfirmed or failed: 0.')).toBeVisible()
  expect(calls).toBe(2)
  expect(keys[1]).not.toBe(keys[0])
})
