import { expect, test, type Page } from '@playwright/test'

function requestCard(page: Page) {
  return {
    heading: page.getByRole('heading', { name: 'Get back into Kuuki', exact: true }),
    email: page.getByRole('textbox', { name: 'Email', exact: true }),
    send: page.getByRole('button', { name: 'Send link', exact: true }),
    inbox: page.getByRole('heading', { name: 'Check your inbox', exact: true }),
  }
}

test('Can’t sign in opens in place without an empty-email error, and preserves typed credentials on return', async ({ page }) => {
  await page.goto('/')
  const c = requestCard(page)
  await page.getByRole('link', { name: 'Can’t sign in?', exact: true }).click()
  await expect(c.heading).toBeFocused()
  await expect(c.email).toHaveValue('')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('Snap a boarding pass. We’ll figure it out.', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Halfway to the Moon, apparently.', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to sign in', exact: true }).click()
  await c.email.fill('typed@example.test')
  await page.getByLabel('Password', { exact: true }).fill('keep-this-password')
  await page.getByRole('link', { name: 'Can’t sign in?', exact: true }).click()
  await expect(c.email).toHaveValue('typed@example.test')
  await expect(c.heading).toBeFocused()
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('button', { name: 'Back to sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome to Kuuki', exact: true })).toBeFocused()
  await expect(c.email).toHaveValue('typed@example.test')
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('keep-this-password')
})

test('request validation, sending focus and distinct server failures preserve the email', async ({ page }) => {
  let attempt = 0, release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/auth/link/request', async route => {
    if (++attempt === 1) { await held; await route.fulfill({ status: 400, json: { code: 'INVALID_EMAIL' } }) }
    else if (attempt === 2) await route.fulfill({ status: 429, json: { code: 'RATE_LIMITED' } })
    else if (attempt === 3) await route.fulfill({ status: 503, json: { code: 'ACTIVATION_UNAVAILABLE' } })
    else if (attempt === 4) await route.abort('failed')
    else await route.fulfill({ json: { ok: true } })
  })
  await page.goto('/forgot-password')
  const c = requestCard(page)
  await c.email.fill('malformed')
  await c.send.click()
  await expect(c.email).toHaveAttribute('aria-invalid', 'true')
  await expect(c.email).toHaveAccessibleDescription('Enter a valid email.')
  expect(attempt).toBe(0)
  await c.email.fill('valid@example.test')
  await expect(c.email).toBeFocused()
  const idleFill = await c.send.evaluate(element => getComputedStyle(element).backgroundColor)
  await c.email.press('Enter')
  const sending = page.getByRole('button', { name: 'Sending…', exact: true })
  await expect(sending).toBeDisabled()
  await expect(sending.locator('svg')).toBeVisible()
  await expect(c.heading).toBeFocused()
  expect(await sending.evaluate(element => [getComputedStyle(element).opacity, getComputedStyle(element).backgroundColor])).toEqual(['1', idleFill])
  await sending.click({ force: true })
  await c.email.press('Enter')
  release()
  for (const message of ['Enter a valid email.', 'Too many links requested. Try again in an hour.', 'Email links are paused right now. Try again later.', 'We could not send the link. Please try again.']) {
    const error = page.getByRole('alert')
    await expect(error).toHaveText(message)
    await expect(error.locator('svg')).toBeVisible()
    await expect(c.heading).toBeFocused()
    await expect(c.email).toHaveValue('valid@example.test')
    await c.send.click()
  }
  await expect(c.inbox).toBeFocused()
  expect(attempt).toBe(5)
})

test('only a valid generic acknowledgement reaches the inbox and saves the typed email hint', async ({ page }) => {
  const replies = ['{}', '', '<html>Unavailable</html>', 'null', '{"ok":false}', '{"ok":"true"}']
  let attempt = 0
  await page.route('**/api/auth/link/request', route => route.fulfill({ status: 200, body: replies[attempt++] ?? '{"ok":true}', contentType: 'application/json' }))
  await page.goto('/forgot-password')
  const c = requestCard(page)
  await c.email.fill('keep@example.test')
  for (const reply of replies) await test.step(reply || 'empty body', async () => {
    await c.send.click()
    await expect(page.getByRole('alert')).toHaveText('We could not send the link. Please try again.')
    await expect(c.heading).toBeFocused()
    await expect(c.email).toHaveValue('keep@example.test')
    await expect(c.inbox).toHaveCount(0)
    expect(await page.evaluate(() => sessionStorage.getItem('kuuki_auth_email'))).toBeNull()
  })
  await c.send.click()
  await expect(c.inbox).toBeFocused()
  await expect(page.getByRole('status').filter({ hasText: 'If keep@example.test has a Kuuki account' })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('kuuki_auth_email'))).toBe('keep@example.test')
})

test('resend waits 60 seconds, announces availability once and restarts the cooldown after resending', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-06T12:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-06T12:00:01Z'))
  let requests = 0
  await page.route('**/api/auth/link/request', route => { requests++; return route.fulfill({ json: { ok: true } }) })
  await page.goto('/forgot-password')
  const c = requestCard(page)
  await c.email.fill('again@example.test')
  await c.send.click()
  await expect(c.inbox).toBeFocused()
  const resend = page.getByRole('button', { name: /^Send again/ })
  await expect(resend).toBeDisabled()
  await expect(resend).toHaveText('Send again in 1:00')
  await resend.click({ force: true })
  expect(requests).toBe(1)
  // Observe only live-region changes: countdown button text must never become a repeated announcement.
  const announcements = page.evaluate(() => new Promise<string[]>(resolve => {
    const messages: string[] = []
    const observer = new MutationObserver(records => {
      for (const record of records) {
        const element = record.target instanceof Element ? record.target : record.target.parentElement
        const message = element?.closest('[role="status"]')?.textContent?.trim()
        if (message) messages.push(message)
      }
    })
    observer.observe(document.body, { childList: true, characterData: true, subtree: true })
    setTimeout(() => { observer.disconnect(); resolve(messages) }, 65_000)
  }))
  await page.getByRole('button', { name: 'Use a different email', exact: true }).focus()
  await page.clock.runFor(59_000)
  await expect(resend).toHaveText('Send again in 0:01')
  await expect(resend).toBeDisabled()
  await page.clock.runFor(1_000)
  await expect(resend).toBeEnabled()
  await expect(resend).toHaveText('Send again')
  await expect(page.getByRole('button', { name: 'Use a different email', exact: true })).toBeFocused()
  await page.clock.runFor(5_000)
  expect(await announcements).toEqual(['Send again is now available.'])
  await resend.click()
  await expect(c.inbox).toBeFocused()
  await expect(resend).toBeDisabled()
  await expect(resend).toHaveText('Send again in 1:00')
  expect(requests).toBe(2)
  await page.getByRole('button', { name: 'Use a different email', exact: true }).click()
  await expect(c.heading).toBeFocused()
  await expect(c.email).toHaveValue('again@example.test')
})

test('request success survives blocked storage and follows the Russian locale', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'kuuki_locale', value: 'ru', url: baseURL! }])
  await page.route('**/api/auth/link/request', route => route.fulfill({ json: { ok: true } }))
  await page.goto('/activation-request')
  await expect(page.getByRole('heading', { name: 'Вернитесь в Kuuki', exact: true })).toBeFocused()
  await page.evaluate(() => { Object.defineProperty(window, 'sessionStorage', { configurable: true, get: () => { throw new DOMException('Blocked', 'SecurityError') } }) })
  await page.getByRole('textbox', { name: 'Почта', exact: true }).fill('ru@example.test')
  await page.getByRole('button', { name: 'Отправить ссылку', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Проверьте почту', exact: true })).toBeFocused()
  await expect(page.getByRole('status').filter({ hasText: 'Если для ru@example.test есть аккаунт Kuuki' })).toContainText('30 минут.')
  await expect(page.getByRole('button', { name: /^Отправить ещё раз через/ })).toBeDisabled()
})
