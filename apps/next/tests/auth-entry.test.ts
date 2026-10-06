import { expect, test, type Locator, type Page } from '@playwright/test'

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

/**
 * Hit-tests a control's whole box (inside its rounded corners) with `elementFromPoint` on a 4px grid, so nothing painted above it (an input, a
 * sibling) steals part of the area its bounding box promises.
 */
async function expectOwnsHitArea(control: Locator) {
  const misses = await control.evaluate(element => {
    const box = element.getBoundingClientRect(), missed: string[] = []
    const xs: number[] = [], ys: number[] = []
    // 1px in from each edge, so subpixel rounding at the border doesn't count as a miss.
    for (let x = box.left + 1; x < box.right - 1; x += 4) xs.push(x)
    for (let y = box.top + 1; y < box.bottom - 1; y += 4) ys.push(y)
    xs.push(box.right - 1); ys.push(box.bottom - 1)
    // Rounded corners are not part of the target: skip points outside the border-radius curve.
    const r = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
    const inShape = (x: number, y: number) => Math.hypot(x - clamp(x, box.left + r, box.right - r), y - clamp(y, box.top + r, box.bottom - r)) <= Math.max(r - 1, 0)
    for (const x of xs) for (const y of ys) {
      if (!inShape(x, y)) continue
      const hit = document.elementFromPoint(x, y)
      if (!hit || !element.contains(hit)) missed.push(`${Math.round(x - box.left)},${Math.round(y - box.top)}→${hit?.tagName.toLowerCase() ?? 'none'}`)
    }
    return missed
  })
  expect(misses).toEqual([])
}

async function expectHitArea(page: Page) {
  const c = card(page)
  const reveal = page.getByRole('button', { name: 'Show password', exact: true })
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
  // Every point of each target's box lands on that target, not on the email input above the link or the field under the reveal.
  for (const control of [c.cantSignIn, reveal, c.language, c.theme, c.help]) await expectOwnsHitArea(control)
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

test('Continue does not scale while pressed under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const c = card(page)
  await c.continue.hover()
  await page.mouse.down()
  try {
    expect(await c.continue.evaluate(element => element.matches(':active'))).toBe(true)
    expect(await c.continue.evaluate(element => getComputedStyle(element).transform)).toBe('none')
  } finally { await page.mouse.up() }
})

test('the reveal keeps its card styling after a visit to password recovery', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const reveal = page.getByRole('button', { name: 'Show password', exact: true })
  const look = () => reveal.evaluate(element => {
    const style = getComputedStyle(element), box = element.getBoundingClientRect()
    return { width: box.width, height: box.height, background: style.backgroundColor, margin: style.marginInlineEnd, color: style.color }
  })
  const before = await look()
  expect(before).toMatchObject({ width: 40, height: 40, margin: '0px' })
  // Client-side navigation keeps the recovery page's stylesheet loaded.
  await card(page).cantSignIn.click()
  await expect(page).toHaveURL(/\/forgot-password$/)
  await page.getByRole('link', { name: 'Back to sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/signin$/)
  await expect(reveal).toBeVisible()
  expect(await look()).toEqual(before)
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

test('activation page keeps isolation, erases the fragment and sends a saved password to the main-origin notice', async ({ page, baseURL }) => {
  // An expired or reused link: the page opens on Link expired with main-origin ways back.
  await page.goto('/activate')
  await expect(page.getByRole('heading', { level: 1, name: 'This link has expired' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Send a new link' })).toHaveAttribute('href', `${baseURL}/activation-request`)
  await expect(page.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', `${baseURL}/signin`)
  let attempt = 0
  await page.route('**/api/auth/activation/complete', route => {
    attempt++
    return route.fulfill(attempt === 1 ? { status: 429, json: { error: 'Limited', code: 'RATE_LIMITED' } } : { json: { ok: true } })
  })
  const response = await page.goto(`/activate.html#token=${'A'.repeat(43)}`)
  expect(response!.headers()['cache-control']).toBe('no-store')
  expect(response!.headers()['referrer-policy']).toBe('no-referrer')
  expect(response!.headers()['content-security-policy']).toContain("default-src 'none'")
  await expect(page).toHaveURL(/\/activate$/)
  // No app scripts: the page's own script is the only one.
  await expect(page.locator('script')).toHaveCount(1)
  await expect(page.getByRole('img', { name: 'Kuuki' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome back to Kuuki' })).toBeVisible()
  await expect(page.locator('input[autocomplete="username"]')).toBeHidden()
  await page.getByLabel('New password', { exact: true }).fill('personal-password')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('Too many attempts.')
  await page.getByRole('button', { name: 'Save password' }).click()
  // No email, token or password travels in the URL.
  await expect(page).toHaveURL(`${baseURL}/?mode=signin&notice=password-saved`)
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
