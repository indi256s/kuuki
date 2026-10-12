import { expect, type Page } from '@playwright/test'

/** Isolate setup requests from other tests without changing production limits. */
export function fixtureHeaders(origin: string) {
  return {
    Origin: origin,
    'CF-Connecting-IP': `2001:db8:${crypto.randomUUID().replace(/-/g, '').slice(0, 24).match(/.{4}/g)!.join(':')}`,
  }
}

/** Sign in as a seeded fixture account; the default is the smoke fixture owner. */
export async function signIn(page: Page, baseURL: string, email = 'a@example.test') {
  const response = await page.request.post('/api/auth/sign-in/email', {
    // Isolate setup logins in local workerd; UI requests still use the real limit.
    headers: fixtureHeaders(baseURL),
    data: { email, password: 'rehearsal-password-2026' },
  })
  expect(response.status()).toBe(200)
}

/**
 * Fresh sign-ups haven't onboarded, and member pages send them back to the card; give them an address and finish
 * onboarding for flows past that gate.
 */
export async function claimUsername(page: Page, baseURL: string) {
  const cookies = await page.context().cookies()
  const csrf = decodeURIComponent(
    cookies.find((cookie) => cookie.name === 'kuuki_csrf')?.value ?? '',
  )
  const username = `t${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
  const response = await page.request.patch('/api/profiles/me', {
    headers: { Origin: baseURL, 'X-CSRF-Token': csrf },
    data: { username },
  })
  expect(response.status()).toBe(200)
  const onboarded = await page.request.post('/api/profiles/me/onboarded', {
    headers: { Origin: baseURL, 'X-CSRF-Token': csrf },
  })
  expect(onboarded.status()).toBe(200)
}

/** Fill the manual capture fields through the route picker and explicit calendar date. */
export async function fillManualFlight(page: Page) {
  await page.getByRole('radio', { name: 'Other calendar', exact: true }).check()
  await page.getByLabel('Other date', { exact: true }).fill('2025-06-01')
  await page.getByRole('button', { name: 'From: city or airport', exact: true }).click()
  for (const [label, code] of [
    ['From airport', 'JFK'],
    ['To airport', 'BOS'],
  ]) {
    await page.getByRole('combobox', { name: label, exact: true }).fill(code)
    await page.getByRole('option', { name: new RegExp(` ${code}$`) }).click()
  }
}
