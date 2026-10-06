import { expect, test } from '@playwright/test'

test('entry forms expose rules, reveal, password matching and activation/recovery links', async ({ page }) => {
  await page.goto('/signup')
  await expect(page.getByRole('link', { name: 'Kuuki home' })).toHaveCount(1)
  await expect(page.getByRole('combobox', { name: 'Language' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Theme' })).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'new-password')
  await expect(page.getByText('Use 8 to 1024 characters.')).toBeVisible()
  await page.getByRole('button', { name: 'Show: Password' }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByLabel('Email', { exact: true }).fill('person@example.test')
  await page.getByLabel('Password', { exact: true }).fill('personal-password')
  await page.getByLabel('Confirm password', { exact: true }).fill('different-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Passwords do not match.')).toBeVisible()
  await page.getByRole('link', { name: 'Already have an account? Sign in' }).click()
  await expect(page).toHaveURL(/\/signin$/)
  // The outgoing sign-up form stays in the page, hidden, until the fade-through settles; a role query skips it.
  await expect(page.getByRole('textbox', { name: 'Password', exact: true })).toHaveAttribute('autocomplete', 'current-password')
  await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password')
  await page.getByRole('link', { name: /Continue to activation/ }).click()
  await expect(page).toHaveURL(/\/activation-request$/)
  // A sign-in ↔ sign-up fade still settling keeps its hidden form for a moment; nothing may linger after it.
  await expect(page.locator('input[type="email"]')).toHaveCount(1)
  // UI boundary only: no mail service or real inbox is contacted.
  await page.route('**/api/auth/activation/request', route => route.fulfill({ json: { ok: true } }))
  await page.getByLabel('Email', { exact: true }).fill('unknown@example.test')
  await page.getByRole('button', { name: 'Send activation link' }).click()
  await expect(page.getByRole('status')).toContainText('If activation is needed for this address')
})

test('recovery keeps rate/network retries distinct and returns a successful reset to sign-in', async ({ page }) => {
  await page.route('**/api/auth/password-reset/request', route => route.fulfill({ json: { ok: true } }))
  await page.goto('/forgot-password')
  await page.getByLabel('Email', { exact: true }).fill('unknown@example.test')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('status')).toContainText('If recovery is available for this address')
  let attempt = 0
  await page.route('**/api/auth/password-reset/complete', async route => {
    attempt++
    if (attempt === 1) await route.fulfill({ status: 429, json: { error: 'Limited', code: 'RATE_LIMITED' } })
    else if (attempt === 2) await route.abort('failed')
    else await route.fulfill({ json: { ok: true } })
  })
  await page.goto(`/reset-password#token=${'A'.repeat(43)}`)
  await expect(page).toHaveURL(/\/reset-password$/)
  await page.getByLabel('New password', { exact: true }).fill('personal-password')
  await page.getByLabel('Confirm password', { exact: true }).fill('personal-password')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('Too many attempts.')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('Could not save your password.')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page).toHaveURL(/\/password-updated$/)
  await expect(page.getByRole('status')).toContainText('Sign in with your new password.')
  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/signin$/)
})

test('activation page keeps isolation, erases the fragment and sends a saved password to the main-origin notice', async ({ page, baseURL }) => {
  // An expired or reused link: the page opens on Link expired with main-origin ways back.
  await page.goto('/activate')
  await expect(page.getByRole('heading', { level: 1, name: 'This link has expired' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Send a new link' })).toHaveAttribute('href', `${baseURL}/activation-request`)
  await expect(page.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', `${baseURL}/signin`)
  let attempt = 0
  await page.route('**/api/auth/activation/complete', route => {
    attempt++
    return route.fulfill(attempt === 1 ? { status: 429, json: { error: 'Limited', code: 'RATE_LIMITED' } } : { json: { ok: true } })
  })
  const response = await page.goto(`/activate.html#token=${'A'.repeat(43)}`)
  expect(response!.headers()['cache-control']).toBe('no-store')
  expect(response!.headers()['referrer-policy']).toBe('no-referrer')
  expect(response!.headers()['content-security-policy']).toContain("default-src 'none'")
  await expect(page).toHaveURL(/\/activate$/)
  // No app scripts: the page's own script is the only one.
  await expect(page.locator('script')).toHaveCount(1)
  await expect(page.getByRole('img', { name: 'Kuuki' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome back to Kuuki' })).toBeVisible()
  await expect(page.locator('input[autocomplete="username"]')).toBeHidden()
  await page.getByLabel('New password', { exact: true }).fill('personal-password')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('Too many attempts.')
  await page.getByRole('button', { name: 'Save password' }).click()
  // No email, token or password travels in the URL.
  await expect(page).toHaveURL(`${baseURL}/?notice=password-saved`)
})

test('sign-in remains usable when client session bootstrap is unavailable', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': '203.0.113.77' })
  await page.route('**/api/auth/me', route => route.fulfill({ status: 503, json: { error: 'Unavailable', code: 'UNAVAILABLE' } }))
  await page.goto('/signin')
  await page.getByLabel('Email', { exact: true }).fill('a@example.test')
  await page.getByLabel('Password', { exact: true }).fill('rehearsal-password-2026')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/overview$/)
})
