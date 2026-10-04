import { expect, type Page } from '@playwright/test'

/** Sign in as a seeded fixture account; the default is the smoke fixture owner. */
export async function signIn(page: Page, baseURL: string, email = 'a@example.test') {
  const response = await page.request.post('/api/auth/sign-in/email', {
    headers: { Origin: baseURL }, data: { email, password: 'rehearsal-password-2026' },
  })
  expect(response.status()).toBe(200)
}
