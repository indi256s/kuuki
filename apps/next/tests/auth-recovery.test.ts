import { expect, test, type Page } from '@playwright/test'

function requestCard(page: Page) {
  return {
    heading: page.getByRole('heading', { name: 'Get back into Kuuki', exact: true }),
    email: page.getByRole('textbox', { name: 'Email', exact: true }),
    send: page.getByRole('button', { name: 'Send link', exact: true }),
    inbox: page.getByRole('heading', { name: 'Check your inbox', exact: true }),
    error: page.getByRole('main').getByRole('alert'),
  }
}

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
  await expect(c.heading).toBeFocused()
  expect(attempt).toBe(0)
  await c.email.fill('valid@example.test')
  await expect(c.email).toBeFocused()
  // Resolve the accent independently of the button's hover transition.
  const accentFill = await c.send.evaluate(element => {
    const swatch = document.createElement('span')
    swatch.style.backgroundColor = 'var(--accent)'
    element.appendChild(swatch)
    const color = getComputedStyle(swatch).backgroundColor
    swatch.remove()
    return color
  })
  await c.email.press('Enter')
  const sending = page.getByRole('button', { name: 'Sending…', exact: true })
  await expect(sending).toBeDisabled()
  await expect(sending.locator('svg')).toBeVisible()
  await expect(c.heading).toBeFocused()
  await expect(sending).toHaveCSS('opacity', '1')
  await expect(sending).toHaveCSS('background-color', accentFill)
  await sending.click({ force: true })
  await c.email.press('Enter')
  release()
  for (const message of ['Enter a valid email.', 'Too many links requested. Try again in an hour.', 'Email links are paused right now. Try again later.', 'We could not send the link. Please try again.']) {
    const error = c.error
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
    await expect(c.error).toHaveText('We could not send the link. Please try again.')
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
