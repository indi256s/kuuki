import { expect, type Page } from '@playwright/test'

/** Isolate setup requests from other tests without changing production limits. */
export function fixtureHeaders(origin: string) {
  return { Origin: origin, 'CF-Connecting-IP': `2001:db8:${crypto.randomUUID().replace(/-/g, '').slice(0, 24).match(/.{4}/g)!.join(':')}` }
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

/** Fresh sign-ups have no username, and member pages send them to onboarding; claim one for flows past that gate. */
export async function claimUsername(page: Page, baseURL: string) {
  const cookies = await page.context().cookies()
  const csrf = decodeURIComponent(cookies.find(cookie => cookie.name === 'kuuki_csrf')?.value ?? '')
  const username = `t${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
  const response = await page.request.patch('/api/profiles/me', { headers: { Origin: baseURL, 'X-CSRF-Token': csrf }, data: { username } })
  expect(response.status()).toBe(200)
}

type RouteTransitionLog = { markers: string[]; boundaries: number; heroCopies: number }

/**
 * Records approved route transitions from the first byte: each `html[data-route-transition]` name, the most page
 * boundaries on screen at once (2 while an outgoing page is kept), and the most hero copies.
 */
export async function recordRouteTransitions(page: Page) {
  await page.addInitScript(() => {
    const log = { markers: [] as string[], boundaries: 0, heroCopies: 0 }
    Object.assign(window, { __routeTransitions: log })
    new MutationObserver(records => {
      for (const record of records) if (record.attributeName === 'data-route-transition' && document.documentElement.dataset.routeTransition) log.markers.push(document.documentElement.dataset.routeTransition)
      log.boundaries = Math.max(log.boundaries, document.querySelectorAll('[data-ssgoi-transition]').length)
      log.heroCopies = Math.max(log.heroCopies, document.querySelectorAll('[data-ssgoi-crossfade]').length)
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-route-transition'] })
  })
}

export const routeTransitions = (page: Page) =>
  page.evaluate(() => (window as unknown as { __routeTransitions: RouteTransitionLog }).__routeTransitions)

export const resetRouteTransitions = (page: Page) =>
  page.evaluate(() => Object.assign((window as unknown as { __routeTransitions: RouteTransitionLog }).__routeTransitions, { markers: [], boundaries: document.querySelectorAll('[data-ssgoi-transition]').length, heroCopies: 0 }))
