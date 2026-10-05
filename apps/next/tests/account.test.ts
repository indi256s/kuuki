import { test, expect } from '@playwright/test'
import { claimUsername, signIn } from './helpers'
import { readFile } from 'node:fs/promises'

test('settings saves owned profile and privacy on a fresh account', async ({ page, baseURL }) => {
  const email = `settings-${crypto.randomUUID()}@example.test`
  const signup = await page.request.post('/api/auth/sign-up/email', { headers: { Origin: baseURL! }, data: { email, password: 'temporary-password-2026', displayName: 'Settings test' } })
  expect(signup.status()).toBe(201)
  await claimUsername(page, baseURL!)
  const cookies = await page.context().cookies()
  const csrf = decodeURIComponent(cookies.find(cookie => cookie.name === 'kuuki_csrf')?.value ?? '')
  for (let index = 0; index < 5; index++) {
    const created = await page.request.post('/api/flights', { headers: { Origin: baseURL!, 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() }, data: { date: '2025-01-01', origin: 'JFK', destination: 'BOS' } })
    expect(created.status()).toBe(201)
  }
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.getByLabel('Display name').fill('Account test name')
  await page.getByLabel('Bio').fill('A private test bio')
  await page.getByRole('switch', { name: 'Public profile' }).click()
  await page.getByRole('switch', { name: 'Show on leaderboards when eligible' }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status')).toContainText('Saved.')
  const profile = await page.request.get('/api/auth/me')
  expect(profile.status()).toBe(200)
  const profileData = await profile.json() as { profile: { display_name: string; bio: string; is_public: boolean; show_on_leaderboards: boolean } }
  expect(profileData.profile).toMatchObject({ display_name: 'Account test name', bio: 'A private test bio', is_public: true, show_on_leaderboards: true })
  await expect(page.getByText('Records: 5')).toBeVisible()
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
  await page.reload()
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
  const me = await page.request.get('/api/auth/me')
  const owner = (await me.json() as { user: { id: string } }).user.id
  const keys = await page.evaluate(ownerId => {
    const otherOwner = 'another-owner'
    const owned = [`kuuki-import-draft:v1:${ownerId}:00000000-0000-0000-0000-000000000001`, `kuuki-flight-create-operation:${ownerId}:manual`]
    const other = [`kuuki-import-draft:v1:${otherOwner}:00000000-0000-0000-0000-000000000002`, `kuuki-flight-create-operation:${otherOwner}:manual`]
    for (const key of [...owned, ...other]) localStorage.setItem(key, '{}')
    return { owned, other }
  }, owner)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL('**/signin')
  const remaining = await page.evaluate(() => Object.keys(localStorage))
  for (const key of keys.owned) expect(remaining).not.toContain(key)
  for (const key of keys.other) expect(remaining).toContain(key)
})

test('sign out remains available when the owner lookup fails', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await page.goto('/settings')
  const key = 'kuuki-import-draft:v1:another-owner:00000000-0000-0000-0000-000000000002'
  await page.evaluate(key => localStorage.setItem(key, '{}'), key)
  await page.route('**/api/auth/me', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Temporary failure"}' }))
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.waitForURL('**/signin')
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('{}')
  await page.unroute('**/api/auth/me')
  const response = await page.request.get('/api/auth/me')
  expect(await response.json()).toMatchObject({ user: null })
})

test('an old tab preserves the new account draft and retry receipt on focus', async ({ page: oldTab, context, baseURL }) => {
  await signIn(oldTab, baseURL!)
  const oldOwner = (await (await context.request.get('/api/auth/me')).json() as { user: { id: string } }).user.id
  await oldTab.goto('/overview')
  await expect(oldTab.getByTestId('overview-data')).toBeVisible()
  await oldTab.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }))
  const bootstrap = oldTab.waitForResponse(response => response.url().endsWith('/api/auth/me'))
  await oldTab.evaluate(() => window.dispatchEvent(new Event('focus')))
  await (await bootstrap).finished()
  await oldTab.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)))
  await oldTab.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }))

  const newTab = await context.newPage()
  await newTab.goto('/settings')
  await newTab.getByRole('button', { name: 'Sign out', exact: true }).click()
  await newTab.waitForURL('**/signin')
  await newTab.getByLabel('Email', { exact: true }).fill('b@example.test')
  await newTab.getByLabel('Password', { exact: true }).fill('rehearsal-password-2026')
  await newTab.getByRole('button', { name: 'Sign in', exact: true }).click()
  await newTab.waitForURL('**/overview')

  // Manual capture is the remaining writer of an owner-scoped create receipt; the import UI keeps its drafts in D1.
  await newTab.route('**/api/flights', route => route.request().method() === 'POST'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Temporary failure"}' })
    : route.continue())
  await newTab.goto('/add')
  await newTab.getByLabel('Date').fill('2025-06-01')
  for (const [label, code] of [['From', 'JFK'], ['To', 'BOS']]) {
    await newTab.getByRole('combobox', { name: label }).click()
    const search = newTab.getByRole('dialog', { name: label, exact: true })
    await search.getByRole('combobox', { name: label }).fill(code)
    await search.getByRole('option', { name: new RegExp(`^${code} `) }).click()
  }
  await newTab.getByRole('button', { name: 'Save flight' }).click()
  await expect(newTab.getByRole('button', { name: 'Retry original save' })).toBeVisible()

  const owner = (await (await context.request.get('/api/auth/me')).json() as { user: { id: string } }).user.id
  expect(owner).not.toBe(oldOwner)
  // Legacy local import drafts are still listed per owner, so seed one for each account.
  const oldDraftKey = `kuuki-import-draft:v1:${oldOwner}:legacy`
  await newTab.evaluate(keys => {
    localStorage.setItem(`kuuki-import-draft:v1:${keys.owner}:legacy`, JSON.stringify({ schema: 1, ownerId: keys.owner }))
    localStorage.setItem(keys.oldDraftKey, JSON.stringify({ schema: 1, ownerId: keys.oldOwner }))
  }, { owner, oldOwner, oldDraftKey })
  const stored = await newTab.evaluate(ownerId => {
    const draftKey = Object.keys(localStorage).find(key => key.startsWith(`kuuki-import-draft:v1:${ownerId}:`))
    const receiptKey = Object.keys(localStorage).find(key => key.startsWith(`kuuki-flight-create-operation:${ownerId}:`))
    return { draftKey, receiptKey, draft: draftKey && localStorage.getItem(draftKey), receipt: receiptKey && localStorage.getItem(receiptKey) }
  }, owner)
  expect(stored.draftKey).toBeTruthy()
  expect(stored.receiptKey).toBeTruthy()
  expect(JSON.parse(stored.draft!)).toMatchObject({ schema: 1, ownerId: owner })
  expect(JSON.parse(stored.receipt!)).toMatchObject({ key: expect.any(String), payload: expect.any(String), createdAt: expect.any(Number) })

  const oldTabReload = oldTab.waitForNavigation({ waitUntil: 'domcontentloaded' })
  await oldTab.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    window.dispatchEvent(new Event('focus'))
  })
  await oldTabReload
  const remaining = await newTab.evaluate(keys => ({ draft: localStorage.getItem(keys.draftKey!), receipt: localStorage.getItem(keys.receiptKey!) }), stored)
  expect(remaining).toEqual({ draft: stored.draft, receipt: stored.receipt })
  // The old tab clears only its own departing owner.
  expect(await newTab.evaluate(key => localStorage.getItem(key), oldDraftKey)).toBeNull()
})

test('reset fragment is removed before hydration and invalid tokens show a recovery path', async ({ page }) => {
  await page.goto('/reset-password#token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
  await expect(page).toHaveURL(/\/reset-password$/)
  await page.getByLabel('New password', { exact: true }).fill('new-password-2026')
  await page.getByLabel('Confirm password', { exact: true }).fill('new-password-2026')
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
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click()
  await dialog.getByRole('button', { name: 'Skip', exact: true }).click()
  await dialog.getByLabel('Current password').fill('wrong-password')
  await page.getByRole('button', { name: 'Delete permanently' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Incorrect password')
  const stillHere = await page.request.get('/api/auth/me')
  expect((await stillHere.json() as { user: { email: string } }).user.email).toBe(email)
  await page.getByLabel('Current password').fill(password)
  await page.getByRole('button', { name: 'Delete permanently' }).click()
  await page.waitForURL('**/account-deleted')
  const after = await page.request.get('/api/auth/me')
  expect((await after.json() as { user: unknown }).user).toBeNull()
})
