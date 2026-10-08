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
