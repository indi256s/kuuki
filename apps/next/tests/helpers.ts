import { expect, type Page } from '@playwright/test'

/** Sign in as a seeded fixture account; the default is the smoke fixture owner. */
export async function signIn(page: Page, baseURL: string, email = 'a@example.test') {
  const response = await page.request.post('/api/auth/sign-in/email', {
    headers: { Origin: baseURL }, data: { email, password: 'rehearsal-password-2026' },
  })
  expect(response.status()).toBe(200)
}

/** Fresh sign-ups have no username, and member pages send them to onboarding; claim one for flows past that gate. */
export async function claimUsername(page: Page, baseURL: string) {
  const cookies = await page.context().cookies()
  const csrf = decodeURIComponent(cookies.find(cookie => cookie.name === 'kuuki_csrf')?.value ?? '')
  const username = `t${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
  const response = await page.request.patch('/api/profiles/me', { headers: { Origin: baseURL, 'X-CSRF-Token': csrf }, data: { username } })
  expect(response.status()).toBe(200)
}
