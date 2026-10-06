import { expect, test, type Page } from '@playwright/test'

const TAGLINES = ['Snap a boarding pass. We’ll figure it out.', 'Halfway to the Moon, apparently.']

/** The card's key elements, located by role and accessible name. */
function card(page: Page) {
  return {
    wordmark: page.getByRole('img', { name: 'Kuuki', exact: true }),
    heading: page.getByRole('heading', { level: 1, name: 'Welcome to Kuuki', exact: true }),
    subtitle: page.getByText('Sign in, or use a new email to start your journal.', { exact: true }),
    email: page.getByRole('textbox', { name: 'Email', exact: true }),
    password: page.getByLabel('Password', { exact: true }),
    cantSignIn: page.getByRole('link', { name: 'Can’t sign in?', exact: true }),
    continue: page.getByRole('button', { name: 'Continue', exact: true }),
    language: page.getByRole('combobox', { name: 'Language', exact: true }),
    theme: page.getByRole('combobox', { name: 'Theme', exact: true }),
    help: page.getByRole('button', { name: 'Help', exact: true }),
    tagline: page.getByText(new RegExp(`^(${TAGLINES.map(line => line.replace(/[.?]/g, '\\$&')).join('|')})$`)),
  }
}

async function expectCard(page: Page) {
  const c = card(page)
  for (const element of [c.wordmark, c.heading, c.subtitle, c.email, c.password, c.cantSignIn, c.continue, c.help, c.tagline]) await expect(element).toBeVisible()
  await expect(c.email).toHaveAttribute('autocomplete', 'username')
  await expect(c.password).toHaveAttribute('autocomplete', 'current-password')
  await expect(c.password).toHaveAttribute('type', 'password')
  // The landing page is gone: no hero, sample journal or FAQ, and no sign-in/sign-up mode switch.
  await expect(page.getByRole('region', { name: 'Sample journal · fictional data' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'What is Kuuki?' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Create an account|Already have an account/ })).toHaveCount(0)
  await expect(page.getByLabel('Confirm password')).toHaveCount(0)
  return c
}

async function expectHitArea(page: Page) {
  const c = card(page)
  // Corner controls are at least 44×44; the select fills its control.
  for (const control of [c.language, c.theme, c.help]) {
    const box = (await control.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }
  // "Can't sign in?" is 44px tall and never reaches into the password input below it.
  const link = (await c.cantSignIn.boundingBox())!, input = (await c.password.boundingBox())!
  expect(link.height).toBeGreaterThanOrEqual(44)
  expect(link.y + link.height).toBeLessThanOrEqual(input.y)
}

test('/ shows the card to signed-out visitors in light, brand panel beside the form', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const c = await expectCard(page)
  const wordmark = (await c.wordmark.boundingBox())!, heading = (await c.heading.boundingBox())!
  expect(wordmark.x + wordmark.width).toBeLessThan(heading.x)
  await expectHitArea(page)
  // The text wordmark replaces the tile logo and the guest header.
  await expect(page.getByRole('link', { name: 'Kuuki home' })).toHaveCount(0)
  await expect(page.getByRole('banner')).toHaveCount(0)
  await expect(c.cantSignIn).toHaveAttribute('href', '/forgot-password')
  await c.help.click()
  await expect(page.getByRole('dialog', { name: 'About Kuuki' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(c.help).toBeFocused()
})

test('/signin and /signup render the same card in dark, with a canonical link to /', async ({ page, baseURL }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const path of ['/signin', '/signup']) {
    await page.goto(path)
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expectCard(page)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${baseURL}/`)
  }
  await page.goto('/?mode=signup')
  await expect(page).toHaveURL(/\/\?mode=signup$/)
  await expectCard(page)
})

test('mobile puts the brand above a sheet with 48px inputs and 16px text, and the tagline stays still', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const c = await expectCard(page)
  const wordmark = (await c.wordmark.boundingBox())!, heading = (await c.heading.boundingBox())!
  expect(wordmark.y + wordmark.height).toBeLessThan(heading.y)
  for (const field of [c.email, c.password, c.continue]) {
    expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(48)
    expect(await field.evaluate(element => getComputedStyle(element).fontSize)).toBe('16px')
  }
  await expectHitArea(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await c.tagline.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0)
})

test('the reveal control shows and hides the password', async ({ page }) => {
  await page.goto('/')
  const c = card(page)
  await c.password.fill('personal-password')
  const reveal = page.getByRole('button', { name: 'Show password', exact: true })
  await expect(reveal).toHaveAttribute('aria-pressed', 'false')
  await reveal.click()
  await expect(c.password).toHaveAttribute('type', 'text')
  await expect(reveal).toHaveAttribute('aria-pressed', 'true')
  await reveal.click()
  await expect(c.password).toHaveAttribute('type', 'password')
})

test('the card follows the Russian locale', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'kuuki_locale', value: 'ru', url: baseURL! }])
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Добро пожаловать в Kuuki' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Почта', exact: true })).toBeVisible()
  await expect(page.getByLabel('Пароль', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Не получается войти?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Продолжить', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Язык' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Помощь' })).toBeVisible()
})

test('activation request form still sends a generic link request', async ({ page }) => {
  await page.goto('/activation-request')
  // UI boundary only: no mail service or real inbox is contacted.
  await page.route('**/api/auth/activation/request', route => route.fulfill({ json: { ok: true } }))
  await page.getByLabel('Email', { exact: true }).fill('unknown@example.test')
  await page.getByRole('button', { name: 'Send activation link' }).click()
  await expect(page.getByRole('status')).toContainText('If activation is needed for this address')
})

test('recovery keeps rate/network retries distinct and returns a successful reset to sign-in', async ({ page }) => {
  await page.route('**/api/auth/password-reset/request', route => route.fulfill({ json: { ok: true } }))
  await page.goto('/forgot-password')
  await page.getByLabel('Email', { exact: true }).fill('unknown@example.test')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('status')).toContainText('If recovery is available for this address')
  let attempt = 0
  await page.route('**/api/auth/password-reset/complete', async route => {
    attempt++
    if (attempt === 1) await route.fulfill({ status: 429, json: { error: 'Limited', code: 'RATE_LIMITED' } })
    else if (attempt === 2) await route.abort('failed')
    else await route.fulfill({ json: { ok: true } })
  })
  await page.goto(`/reset-password#token=${'A'.repeat(43)}`)
  await expect(page).toHaveURL(/\/reset-password$/)
  await page.getByLabel('New password', { exact: true }).fill('personal-password')
  await page.getByLabel('Confirm password', { exact: true }).fill('personal-password')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('Too many attempts.')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('Could not save your password.')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page).toHaveURL(/\/password-updated$/)
  await expect(page.getByRole('status')).toContainText('Sign in with your new password.')
  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/signin$/)
  await expectCard(page)
})

test('activation alias keeps isolation, erases the fragment and provides main-origin resend and success links', async ({ page, baseURL }) => {
  let attempt = 0
  await page.route('**/api/auth/activation/complete', route => {
    attempt++
    return route.fulfill(attempt === 1 ? { status: 429, json: { error: 'Limited', code: 'RATE_LIMITED' } } : { json: { ok: true } })
  })
  const response = await page.goto(`/activate.html#token=${'A'.repeat(43)}`)
  expect(response!.headers()['cache-control']).toBe('no-store')
  expect(response!.headers()['referrer-policy']).toBe('no-referrer')
  await expect(page).toHaveURL(/\/activate$/)
  await expect(page.getByRole('link', { name: 'Request a new activation link' })).toHaveAttribute('href', `${baseURL}/activation-request`)
  await page.getByLabel('Password', { exact: true }).fill('personal-password')
  await page.getByLabel('Confirm password', { exact: true }).fill('personal-password')
  await page.getByRole('button', { name: 'Activate account' }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('Too many attempts.')
  await page.getByRole('button', { name: 'Activate account' }).click()
  await expect(page.getByRole('status')).toContainText('Your account is active.')
  await page.getByLabel('Email for sign-in', { exact: false }).fill('person+test@example.test')
  await expect(page.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', `${baseURL}/signin?email=person%2Btest%40example.test`)
  await page.getByRole('link', { name: 'Back to sign in' }).click()
  await expect(card(page).email).toHaveValue('person+test@example.test')
})

test('Continue with known credentials lands in the journal, even when session bootstrap is unavailable', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': '203.0.113.77' })
  await page.route('**/api/auth/me', route => route.fulfill({ status: 503, json: { error: 'Unavailable', code: 'UNAVAILABLE' } }))
  await page.goto('/')
  const c = card(page)
  await c.email.fill('a@example.test')
  await c.password.fill('rehearsal-password-2026')
  await c.password.press('Enter')
  await expect(page).toHaveURL(/\/overview$/)
})
