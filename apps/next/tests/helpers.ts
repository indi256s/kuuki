import { expect, type Page } from '@playwright/test'

let fixtureClient = 0

/** Sign in as a seeded fixture account; the default is the smoke fixture owner. */
export async function signIn(page: Page, baseURL: string, email = 'a@example.test') {
  const response = await page.request.post('/api/auth/sign-in/email', {
    // Isolate setup logins in local workerd; UI requests still use the real limit.
    headers: { Origin: baseURL, 'CF-Connecting-IP': `192.0.2.${++fixtureClient}` },
    data: { email, password: 'rehearsal-password-2026' },
  })
  expect(response.status()).toBe(200)
}
