import { expect, test } from '@playwright/test'
import { fixtureHeaders, signIn } from './helpers'

test('a real one-use reset revokes the old session and requires explicit sign-in with the new password', async ({ page, browser, baseURL }) => {
  const oldContext = await browser.newContext({ baseURL })
  try {
    await signIn(await oldContext.newPage(), baseURL!, 'recovery@example.test')
    expect(await (await oldContext.request.get('/api/auth/me')).json()).toMatchObject({ user: { email: 'recovery@example.test' } })
    await page.addInitScript(() => sessionStorage.setItem('kuuki_auth_email', 'recovery@example.test'))
    await page.goto(`/reset-password#token=${'R'.repeat(43)}`)
    await expect(page).toHaveURL(/\/reset-password$/)
    await page.getByLabel('New password', { exact: true }).fill('reset-password-2026')
    await page.getByRole('button', { name: 'Save password', exact: true }).click()
    await expect(page).toHaveURL(/\/\?notice=password-saved$/)
    await expect(page.getByRole('status')).toHaveText('Password saved. Sign in with it now.')
    await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue('recovery@example.test')
    expect(await (await page.request.get('/api/auth/me')).json()).toMatchObject({ user: null })
    expect(await (await oldContext.request.get('/api/auth/me')).json()).toMatchObject({ user: null })
    await page.goto(`/reset-password#token=${'R'.repeat(43)}`)
    await page.getByLabel('New password', { exact: true }).fill('unused-password-2026')
    await page.getByRole('button', { name: 'Save password', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'This link has expired', exact: true })).toBeFocused()
    await expect(page.getByRole('link', { name: 'Send a new link' })).toHaveAttribute('href', '/forgot-password')
    const signedIn = await page.request.post('/api/auth/sign-in/email', {
      headers: fixtureHeaders(baseURL!), data: { email: 'recovery@example.test', password: 'reset-password-2026' },
    })
    expect(signedIn.status()).toBe(200)
    expect(await (await page.request.get('/api/auth/me')).json()).toMatchObject({ user: { email: 'recovery@example.test' } })
  } finally { await oldContext.close() }
})

for (const [name, viewport, colorScheme] of [
  ['desktop', { width: 1440, height: 900 }, 'light'],
  ['mobile', { width: 390, height: 844 }, 'dark'],
] as const) {
  test(`${name} reset saves one password and returns to the card notice with a same-origin email hint`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await page.setViewportSize(viewport)
    await page.addInitScript(() => sessionStorage.setItem('kuuki_auth_email', 'known@example.test'))
    const requests: string[] = []
    page.on('request', request => { if (request.method() === 'POST') requests.push(new URL(request.url()).pathname) })
    await page.route('**/api/auth/password-reset/complete', route => route.fulfill({ json: { ok: true } }))
    await page.goto(`/reset-password#token=${'A'.repeat(43)}`)
    await expect(page).toHaveURL(/\/reset-password$/)
    await expect(page.getByRole('img', { name: 'Kuuki', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dark theme', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Choose a new password', exact: true })).toBeFocused()
    const password = page.getByLabel('New password', { exact: true })
    await expect(password).toHaveAttribute('autocomplete', 'new-password')
    await expect(page.locator('input[type=hidden][autocomplete=username]')).toHaveValue('known@example.test')
    await expect(page.getByLabel('Confirm password')).toHaveCount(0)
    await password.fill('new-password-2026')
    await page.getByRole('button', { name: 'Save password', exact: true }).click()
    await expect(page).toHaveURL(/\/\?notice=password-saved$/)
    await expect(page.getByRole('status')).toHaveText('Password saved. Sign in with it now.')
    await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue('known@example.test')
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
    expect(requests).toEqual(['/api/auth/password-reset/complete'])
  })
}

test('retryable and malformed completions keep the token and password until confirmed success', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/auth/password-reset/complete', route => {
    attempts++
    if (attempts === 1) return route.fulfill({ status: 429, json: { error: 'Limited', code: 'RATE_LIMITED' } })
    if (attempts === 2) return route.abort('failed')
    return route.fulfill({ json: attempts === 3 ? {} : { ok: true } })
  })
  await page.goto(`/reset-password#token=${'A'.repeat(43)}`)
  await page.getByLabel('New password', { exact: true }).fill('new-password-2026')
  for (const message of ['Too many attempts.', 'Could not save your password.', 'Could not save your password.']) {
    await page.getByRole('button', { name: 'Save password' }).click()
    await expect(page.getByRole('alert')).toContainText(message)
    await expect(page).toHaveURL(/\/reset-password$/)
    await expect(page.getByLabel('New password', { exact: true })).toHaveValue('new-password-2026')
  }
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page).toHaveURL(/\/\?notice=password-saved$/)
  await expect(page.getByRole('status')).toHaveText('Password saved. Sign in with it now.')
})

test('legacy password-updated and saved notices use the same card, including Russian copy', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'kuuki_locale', value: 'ru', url: baseURL! }])
  await page.goto('/password-updated?mode=signin')
  await expect(page).toHaveURL(/\/\?notice=password-saved$/)
  await expect(page.getByRole('status')).toHaveText('Пароль сохранён. Теперь войдите с ним.')
  for (const path of ['/signin', '/signup']) {
    await page.goto(`${path}?mode=signin&notice=password-saved`)
    await expect(page.getByRole('status')).toHaveText('Пароль сохранён. Теперь войдите с ним.')
  }
  await page.goto('/?notice=unknown')
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('changing reset language EN to RU to EN preserves the password and one-use token without reloading', async ({ page }) => {
  const token = 'A'.repeat(43)
  let completions = 0
  await page.route('**/api/auth/password-reset/complete', async route => {
    completions++
    expect(route.request().headers()['authorization']).toBe(`Bearer ${token}`)
    expect(route.request().postDataJSON()).toEqual({ password: 'new-password-2026' })
    await route.fulfill({ json: { ok: true } })
  })
  await page.goto(`/reset-password#token=${token}`)
  await page.getByLabel('New password', { exact: true }).fill('new-password-2026')
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ru')
  await expect(page.getByRole('heading', { name: 'Выберите новый пароль' })).toBeVisible()
  await expect(page.getByLabel('Новый пароль', { exact: true })).toHaveValue('new-password-2026')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await page.getByRole('combobox', { name: 'Язык' }).selectOption('en')
  await expect(page.getByLabel('New password', { exact: true })).toHaveValue('new-password-2026')
  await expect(page).toHaveURL(/\/reset-password$/)
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page).toHaveURL(/\/\?notice=password-saved$/)
  await expect(page.getByRole('status')).toHaveText('Password saved. Sign in with it now.')
  expect(completions).toBe(1)
})
