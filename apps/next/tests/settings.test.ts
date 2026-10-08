import { test, expect, type Page } from '@playwright/test'
import { signIn, fixtureHeaders } from './helpers'

test.use({ viewport: { width: 1280, height: 800 } })

async function settingsLink(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
}
async function edit(page: Page, value = 'Unsaved browser edit') {
  await page.getByLabel('Display name').fill(value)
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible()
}

test('Settings Back restores the existing entry on stay, then leaves exactly once; Forward remains usable', async ({ page, baseURL }) => {
  await signIn(page, baseURL!); await page.goto('/journal'); await settingsLink(page); await edit(page)
  await page.evaluate(() => history.back())
  await page.getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByLabel('Display name')).toHaveValue('Unsaved browser edit')
  await page.evaluate(() => history.back())
  await page.getByRole('button', { name: 'Leave without saving', exact: true }).click()
  await expect(page).toHaveURL(/\/journal$/)
  await page.evaluate(() => history.forward())
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
})

test('Settings guards Forward without truncating the forward history entry', async ({ page, baseURL }) => {
  await signIn(page, baseURL!); await page.goto('/settings')
  await page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'Journal', exact: true }).click()
  await expect(page).toHaveURL(/\/journal$/)
  await page.evaluate(() => history.back())
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible(); await edit(page)
  await page.evaluate(() => history.forward())
  await page.getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByLabel('Display name')).toHaveValue('Unsaved browser edit')
  await page.evaluate(() => history.forward())
  await page.getByRole('button', { name: 'Leave without saving', exact: true }).click()
  await expect(page).toHaveURL(/\/journal$/)
})

test('deletion uses Enter, preserves distinct errors, blocks close during the request, and clears the account to a success screen', async ({ page, baseURL }) => {
  const password = 'temporary-password-2026'
  const signup = await page.request.post('/api/auth/sign-up/email', { headers: fixtureHeaders(baseURL!), data: { email: `delete-settings-${crypto.randomUUID()}@example.test`, password } })
  expect(signup.status()).toBe(201)
  const { claimUsername } = await import('./helpers'); await claimUsername(page, baseURL!)
  await page.goto('/settings'); await page.getByRole('button', { name: 'Delete account', exact: true }).click()
  const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Continue', exact: true }).click(); await dialog.getByRole('button', { name: 'Skip', exact: true }).click()
  await dialog.getByLabel('Current password').fill('wrong-password'); await dialog.getByLabel('Current password').press('Enter')
  await expect(dialog.getByRole('alert')).toContainText('Incorrect password')
  await page.route('**/api/auth/account', route => route.fulfill({ status: 429, json: { code: 'RATE_LIMIT', error: 'Limited', retryAfter: 60 } }))
  await dialog.getByLabel('Current password').press('Enter'); await expect(dialog.getByRole('alert')).toContainText('Too many attempts')
  await page.unroute('**/api/auth/account')
  await page.route('**/api/auth/account', route => route.abort('failed'))
  await dialog.getByLabel('Current password').press('Enter'); await expect(dialog.getByRole('alert')).toContainText('Deletion is not confirmed')
  await page.unroute('**/api/auth/account')
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/auth/account', async route => { await held; await route.continue() })
  await dialog.getByLabel('Current password').fill(password); await dialog.getByLabel('Current password').press('Enter')
  await expect(dialog.getByRole('status')).toContainText('Deleting your account')
  await page.keyboard.press('Escape'); await expect(dialog).toBeVisible()
  expect(await dialog.getByRole('button', { name: 'Cancel', exact: true }).getAttribute('aria-disabled')).toBe('true')
  release(); await page.waitForURL('**/account-deleted')
  await expect(page.getByRole('heading', { name: 'Account deleted', exact: true })).toBeVisible()
  expect(await (await page.request.get('/api/auth/me')).json()).toMatchObject({ user: null })
  await page.getByRole('link', { name: 'Return to home' }).click(); await expect(page).toHaveURL(baseURL! + '/')
})
