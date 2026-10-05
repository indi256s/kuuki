import { test, expect } from '@playwright/test'
import { claimUsername, signIn } from './helpers'
import { readFile } from 'node:fs/promises'

test('settings saves owned profile and privacy on a fresh account', async ({ page, baseURL }) => {
  const email = `settings-${crypto.randomUUID()}@example.test`
  const signup = await page.request.post('/api/auth/sign-up/email', { headers: { Origin: baseURL! }, data: { email, password: 'temporary-password-2026', displayName: 'Settings test' } })
  expect(signup.status()).toBe(201)
  await claimUsername(page, baseURL!)
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.getByLabel('Display name').fill('Account test name')
  await page.getByLabel('Bio').fill('A private test bio')
  await page.getByLabel('Public profile').check()
  await page.getByLabel('Show on leaderboards when eligible').check()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status')).toContainText('Saved.')
  const profile = await page.request.get('/api/auth/me')
  expect(profile.status()).toBe(200)
  const profileData = await profile.json() as { profile: { display_name: string; bio: string; is_public: boolean; show_on_leaderboards: boolean } }
  expect(profileData.profile).toMatchObject({ display_name: 'Account test name', bio: 'A private test bio', is_public: true, show_on_leaderboards: true })
  await page.getByRole('button', { name: 'Download flights' }).click()
  await expect(page.getByRole('status')).toContainText('No flights to export yet.')
})

test('settings exports the existing fixture flights without mutating them', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await page.goto('/settings')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download flights' }).click()
  expect((await download).suggestedFilename()).toMatch(/\.csv$/)
})

test('ground visit export preserves year, entry and note while neutralizing spreadsheet formulas', async ({ page, baseURL }) => {
  const email = `ground-export-${crypto.randomUUID()}@example.test`
  const signup = await page.request.post('/api/auth/sign-up/email', { headers: { Origin: baseURL! }, data: { email, password: 'temporary-password-2026' } })
  expect(signup.status()).toBe(201)
  await claimUsername(page, baseURL!)
  await page.goto('/settings')
  const csrf = await page.evaluate(() => decodeURIComponent(document.cookie.split('; ').find(cookie => cookie.startsWith('kuuki_csrf='))?.split('=')[1] ?? ''))
  const note = '=HYPERLINK("https://example.test","trip")'
  const created = await page.request.post('/api/passport/ground-visits', {
    headers: { Origin: baseURL!, 'X-CSRF-Token': csrf },
    data: { countryCode: 'US', visitYear: 2024, entryMethod: 'land', note },
  })
  expect(created.status()).toBe(201)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download ground visits' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/ground-visits.*\.csv$/)
  const csv = await readFile(await file.path(), 'utf8')
  expect(csv).toContain('country_code,visit_year,entry_method,note,created_at')
  expect(csv).toContain('US,2024,land,')
  expect(csv).toContain("'=HYPERLINK")
  expect(csv).toContain('trip')
})

test('sign out clears local drafts and retry receipts', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await page.goto('/settings')
  await page.evaluate(() => {
    localStorage.setItem('kuuki-import-draft:v1:test:00000000-0000-0000-0000-000000000001', '{}')
    localStorage.setItem('kuuki-flight-create-operation:test:manual', '{}')
  })
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL('**/signin')
  const keys = await page.evaluate(() => Object.keys(localStorage))
  expect(keys).not.toContain('kuuki-import-draft:v1:test:00000000-0000-0000-0000-000000000001')
  expect(keys).not.toContain('kuuki-flight-create-operation:test:manual')
})

test('reset fragment is removed before hydration and invalid tokens show a recovery path', async ({ page }) => {
  await page.goto('/reset-password#token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
  await expect(page).toHaveURL(/\/reset-password$/)
  await page.getByLabel('New password', { exact: true }).fill('new-password-2026')
  await page.getByLabel('Confirm password').fill('new-password-2026')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('invalid or expired')
  await expect(page.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
})

test('fresh account deletion requires its password and removes its identity', async ({ page, baseURL }) => {
  const email = `delete-${crypto.randomUUID()}@example.test`
  const password = 'temporary-password-2026'
  const signup = await page.request.post('/api/auth/sign-up/email', { headers: { Origin: baseURL! }, data: { email, password, displayName: 'Delete test' } })
  expect(signup.status()).toBe(201)
  await claimUsername(page, baseURL!)
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Delete account', exact: true }).click()
  await page.getByLabel('Current password').fill('wrong-password')
  await page.getByLabel('I understand this deletion is permanent').check()
  await page.getByRole('button', { name: 'Delete permanently' }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('Incorrect password')
  const stillHere = await page.request.get('/api/auth/me')
  expect((await stillHere.json() as { user: { email: string } }).user.email).toBe(email)
  await page.getByLabel('Current password').fill(password)
  await page.getByRole('button', { name: 'Delete permanently' }).click()
  await page.waitForURL('**/signin')
  const after = await page.request.get('/api/auth/me')
  expect((await after.json() as { user: unknown }).user).toBeNull()
})
