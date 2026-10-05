import { test, expect, type Page } from '@playwright/test'
import { claimUsername } from './helpers'

async function signup(page: Page, origin: string, named = false) {
  const response = await page.request.post('/api/auth/sign-up/email', { headers: { Origin: origin }, data: { email: `onboarding-${crypto.randomUUID()}@example.test`, password: 'onboarding-password-2026' } })
  expect(response.status()).toBe(201)
  if (named) await claimUsername(page, origin)
}

test('guest proof uses real samples and signup/signin routes', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup')
  await expect(page.getByRole('region', { name: 'Sample journal · fictional data' })).toBeVisible()
  await expect(page.getByRole('article', { name: 'TBS to NRT' })).toBeVisible()
  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/signup$/)
})

test('Name persists before Capture and skip reaches the real first-run Overview', async ({ page, baseURL }) => {
  await signup(page, baseURL!)
  await page.goto('/onboarding?step=name')
  const username = `t${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`
  await page.getByLabel('Username', { exact: true }).fill(username.toUpperCase())
  await expect(page.getByText('Username available.')).toBeVisible()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(/step=capture/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Add your first flight' })).toBeVisible()
  await page.getByRole('link', { name: 'Do this later' }).click()
  await expect(page).toHaveURL(/\/overview$/)
})

test('manual future save reveals a booked Ticket, then reload stays honest without replay', async ({ page, baseURL }) => {
  await signup(page, baseURL!, true)
  await page.goto('/onboarding?step=capture')
  await page.getByRole('button', { name: 'Enter manually' }).click()
  const future = new Date(); future.setUTCFullYear(future.getUTCFullYear() + 1)
  await page.getByLabel('Date', { exact: true }).fill(future.toISOString().slice(0, 10))
  for (const [label, code] of [['From', 'TBS'], ['To', 'IST']]) {
    await page.getByRole('combobox', { name: label, exact: true }).click()
    const picker = page.getByRole('dialog', { name: label, exact: true })
    await picker.getByRole('combobox', { name: label, exact: true }).fill(code)
    await picker.getByRole('option', { name: new RegExp(`^${code} `) }).click()
  }
  await page.getByRole('button', { name: 'Save flight', exact: true }).click()
  await page.getByRole('button', { name: 'See your result', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your flight is booked' })).toBeVisible()
  await expect(page.locator('.onboarding-reveal .stamp')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Your saved flights are in your journal.')).toBeVisible()
  await expect(page.locator('.onboarding-reveal .stamp')).toHaveCount(0)
})

test('durable import resumes inside onboarding after refresh without another submission', async ({ page, baseURL }) => {
  await signup(page, baseURL!, true)
  const id = '11111111-1111-4111-8111-111111111111'
  let submits = 0
  const snapshot = { batch: { id, sourceType: 'text', sourceLabel: null, status: 'review', stage: 'review_ready', sequence: 1, errorCode: null, retryAfter: null, createdAt: '2026-10-05T00:00:00Z', updatedAt: '2026-10-05T00:00:00Z', expiresAt: '2027-10-05T00:00:00Z', expired: false }, drafts: [{ id: 'draft1', ordinal: 0, status: 'review', version: 1, fields: { date: '2026-03-01', origin: 'TBS', destination: 'IST', airline_iata: 'TK' }, confidence: 1, fieldConfidence: null, yearExplicit: true, yearConfirmed: true, selected: true, edited: false, duplicateAcknowledged: false, convertedFlightId: null, duplicateFlightId: null, issue: null }] }
  await page.route('**/api/import/**', async route => {
    if (new URL(route.request().url()).pathname === '/api/import/jobs') submits++
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshot) })
  })
  await page.goto(`/onboarding?step=capture&batch=${id}&source=text`)
  await expect(page.getByRole('heading', { name: 'Review flights', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Review flights', exact: true })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/onboarding\\?.*batch=${id}`))
  expect(submits).toBe(0)
})

for (const mode of ['text', 'file'] as const) test(`${mode} capture stores a durable onboarding URL before refresh`, async ({ page, baseURL }) => {
  await signup(page, baseURL!, true)
  const id = '22222222-2222-4222-8222-222222222222'
  let submits = 0
  const snapshot = { batch: { id, sourceType: mode === 'text' ? 'text' : 'pdf', sourceLabel: null, status: 'review', stage: 'review_ready', sequence: 1, errorCode: null, retryAfter: null, createdAt: '2026-10-05T00:00:00Z', updatedAt: '2026-10-05T00:00:00Z', expiresAt: '2027-10-05T00:00:00Z', expired: false }, drafts: [] }
  await page.route('**/api/import/**', async route => {
    if (new URL(route.request().url()).pathname === '/api/import/jobs') {
      submits++
      expect(route.request().postDataJSON().type).toBe(mode === 'text' ? 'text' : 'pdf')
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshot) })
  })
  await page.goto('/onboarding?step=capture')
  await page.getByRole('button', { name: mode === 'text' ? 'Paste text from an email' : 'Upload boarding passes or PDFs' }).click()
  if (mode === 'text') await page.getByLabel('Booking or itinerary text').fill('2026-03-01 TBS IST TK')
  else await page.locator('input[type=file]').setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') })
  await page.getByRole('button', { name: 'Find flights', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/onboarding\\?.*batch=${id}`))
  await page.reload()
  await expect(page).toHaveURL(new RegExp(`/onboarding\\?.*batch=${id}`))
  expect(submits).toBe(1)
})
