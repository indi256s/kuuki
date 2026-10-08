import { test, expect, type Page } from '@playwright/test'
import { claimUsername, fixtureHeaders } from './helpers'

async function signup(page: Page, origin: string, named = false) {
  const response = await page.request.post('/api/auth/sign-up/email', { headers: fixtureHeaders(origin), data: { email: `onboarding-${crypto.randomUUID()}@example.test`, password: 'onboarding-password-2026' } })
  expect(response.status()).toBe(201)
  if (named) await claimUsername(page, origin)
}

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
  for (const [label, code] of [['From', 'JFK'], ['To', 'BOS']]) {
    await page.getByRole('combobox', { name: label, exact: true }).click()
    const picker = page.getByRole('dialog', { name: label, exact: true })
    await picker.getByRole('combobox', { name: label, exact: true }).fill(code)
    await picker.getByRole('option', { name: new RegExp(`^${code} `) }).click()
  }
  await page.getByRole('button', { name: 'Save flight', exact: true }).click()
  await page.getByRole('button', { name: 'See your result', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your flight is booked' })).toBeFocused()
  await expect(page.locator('.onboarding-reveal .stamp')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Your saved flights are in your journal.')).toBeVisible()
  await expect(page.locator('.onboarding-reveal .stamp')).toHaveCount(0)
})
