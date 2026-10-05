import { test, expect, type Page } from '@playwright/test'

async function freshAccount(page: Page, origin: string) {
  const email = `rollback-${crypto.randomUUID()}@example.test`
  const response = await page.request.post('/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: { email, password: 'rollback-password-2026' },
  })
  expect(response.status()).toBe(201)
  const csrf = (await page.context().cookies(origin)).find(cookie => cookie.name === 'kuuki_csrf')?.value
  const profile = await page.request.patch('/api/profiles/me', {
    headers: { Origin: origin, 'X-CSRF-Token': csrf! },
    data: { username: `rollback-${crypto.randomUUID().slice(0, 8)}` },
  })
  expect(profile.status()).toBe(200)
}

test('a Next flight remains editable and deletable in the legacy app on the same worker and database', async ({ page, context, baseURL }) => {
  await freshAccount(page, baseURL!)

  await page.goto('/add')
  await page.getByLabel('Date').fill('2025-06-01')
  for (const [label, code] of [['From', 'JFK'], ['To', 'BOS']]) {
    await page.getByRole('combobox', { name: label }).click()
    const search = page.getByRole('dialog', { name: label, exact: true })
    await search.getByRole('combobox', { name: label }).fill(code)
    await search.getByRole('option', { name: new RegExp(`^${code} `) }).click()
  }
  const createRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/flights' && request.method() === 'POST')
  await page.getByRole('button', { name: 'Save flight' }).click()
  const original = await createRequest
  const operationKey = original.headers()['idempotency-key']
  expect(operationKey).toBeTruthy()
  await expect(page.getByRole('heading', { name: 'Flight saved' })).toBeVisible()

  const list = await page.request.get('/api/flights/all')
  expect(list.status()).toBe(200)
  const flights = await list.json() as { id: number; origin: string; destination: string }[]
  expect(flights).toHaveLength(1)
  const flightId = flights[0].id
  expect(flights[0]).toMatchObject({ origin: 'JFK', destination: 'BOS' })

  // Replaying the same acknowledged operation must return the existing row.
  const csrf = (await context.cookies(baseURL!)).find(cookie => cookie.name === 'kuuki_csrf')?.value
  expect(csrf).toBeTruthy()
  const replay = await page.request.post('/api/flights', {
    headers: {
      Origin: baseURL!,
      'X-CSRF-Token': decodeURIComponent(csrf!),
      'Idempotency-Key': operationKey,
    },
    data: original.postDataJSON(),
  })
  expect(replay.status()).toBe(200)
  expect((await replay.json() as { id: number }).id).toBe(flightId)
  expect((await (await page.request.get('/api/flights/all')).json() as unknown[])).toHaveLength(1)

  const legacyEdit = `/legacy/flights?action=edit&flightId=${flightId}&returnTo=%2Fjournal`
  await page.goto(legacyEdit)
  await expect(page.getByRole('dialog', { name: 'Edit Flight' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Edit Flight' })).toContainText('1 Jun 2025')
  await page.getByRole('dialog').getByRole('button', { name: 'Flight Number' }).click()
  await page.getByRole('dialog').getByPlaceholder('123', { exact: true }).fill('RB42')
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForURL(url => url.pathname === '/journal')

  const edited = await page.request.get(`/api/flights/${flightId}`)
  expect(edited.status()).toBe(200)
  expect(await edited.json()).toMatchObject({ id: flightId, origin: 'JFK', destination: 'BOS', flight_number: 'RB42' })
  await expect(page.locator('.flight-row')).toHaveCount(1)

  await page.goto(legacyEdit)
  await expect(page.getByRole('dialog', { name: 'Edit Flight' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete Flight' }).click()
  await expect(page.getByRole('dialog', { name: 'Delete Flight?' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Delete Flight?' }).getByRole('button', { name: 'Delete', exact: true }).click()
  await page.waitForURL(url => url.pathname === '/journal')
  await expect(page.locator('.flight-row')).toHaveCount(0)
  expect((await (await page.request.get('/api/flights/all')).json() as unknown[])).toHaveLength(0)
  expect((await page.request.get(`/api/flights/${flightId}`)).status()).toBe(404)
})
