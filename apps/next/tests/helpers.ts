import { expect, type Page } from '@playwright/test'

export function fixtureHeaders(origin: string) {
  return {
    Origin: origin,
    'CF-Connecting-IP': `2001:db8:${crypto.randomUUID().replace(/-/g, '').slice(0, 24).match(/.{4}/g)!.join(':')}`,
  }
}

export async function routeSettled(page: Page) {
  await expect(page.locator('html')).not.toHaveAttribute('data-route-transition')
}

export async function signIn(page: Page, baseURL: string, email = 'a@example.test') {
  const response = await page.request.post('/api/auth/sign-in/email', {
    headers: fixtureHeaders(baseURL),
    data: { email, password: 'rehearsal-password-2026' },
  })
  expect(response.status()).toBe(200)
}

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
