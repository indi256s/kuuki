import { expect, test, type Locator, type Page } from '@playwright/test'
import { fixtureHeaders } from './helpers'

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
    theme: page.getByRole('button', { name: 'Dark theme', exact: true }),
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

test('the reveal keeps its card styling after returning from in-place password recovery', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const reveal = page.getByRole('button', { name: 'Show password', exact: true })
  const look = () => reveal.evaluate(element => {
    const style = getComputedStyle(element), box = element.getBoundingClientRect()
    return { width: box.width, height: box.height, background: style.backgroundColor, margin: style.marginInlineEnd, color: style.color }
  })
  const before = await look()
  expect(before).toMatchObject({ width: 40, height: 40, margin: '0px' })
  await card(page).cantSignIn.click()
  await expect(page.getByRole('heading', { name: 'Get back into Kuuki', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Back to sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(card(page).heading).toBeFocused()
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

test('recovery bookmarks open the same request card and send the same generic link request', async ({ page }) => {
  await page.route('**/api/auth/link/request', route => route.fulfill({ json: { ok: true } }))
  for (const path of ['/forgot-password', '/activation-request']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: 'Get back into Kuuki', exact: true })).toBeFocused()
    await expect(card(page).wordmark).toBeVisible()
    await expect(page.getByRole('banner')).toHaveCount(0)
    await expect(card(page).tagline).toHaveCount(0)
    await expect(page.locator('main').getByRole('alert')).toHaveCount(0)
    await page.getByLabel('Email', { exact: true }).fill('unknown@example.test')
    const request = page.waitForRequest(request => request.url().endsWith('/api/auth/link/request'))
    await page.getByRole('button', { name: 'Send link', exact: true }).click()
    expect((await request).postDataJSON()).toEqual({ email: 'unknown@example.test' })
    await expect(page.getByRole('heading', { name: 'Check your inbox', exact: true })).toBeFocused()
    await expect(page.getByRole('status').filter({ hasText: 'If unknown@example.test has a Kuuki account' })).toContainText('It works once, for 30 minutes.')
    expect(await page.evaluate(() => sessionStorage.getItem('kuuki_auth_email'))).toBe('unknown@example.test')
    await expect(page).toHaveURL(new RegExp(`${path}$`))
  }
})

test('activation page keeps isolation, erases the fragment and sends a saved password to the main-origin notice', async ({ page, baseURL }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
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
  const help = page.getByRole('button', { name: 'Help', exact: true })
  await help.focus()
  await help.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'About Kuuki' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'About Kuuki' })).toBeFocused()
  await expect(dialog).toContainText('Kuuki is a private flight journal.')
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(help).toBeFocused()
  const planes = page.locator('.planes:visible .plane')
  expect(await planes.count()).toBe(page.viewportSize()!.width <= 700 ? 14 : 30)
  expect(await planes.evaluateAll(elements => elements.every(element => {
    const style = getComputedStyle(element)
    return style.animationName === 'none' && style.transform === 'none'
  }))).toBe(true)
  await page.getByLabel('New password', { exact: true }).fill('personal-password')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('Too many attempts.')
  await page.getByRole('button', { name: 'Save password' }).click()
  // No email, token or password travels in the URL.
  await expect(page).toHaveURL(`${baseURL}/?mode=signin&notice=password-saved`)
})

/** Continue spends `signin:<ip>` and every `create` answer also spends `signup:<ip>`, so each journey gets its own IP. */
async function ownIp(page: Page, baseURL: string) {
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': fixtureHeaders(baseURL)['CF-Connecting-IP'] })
}

const newEmail = () => `new-${crypto.randomUUID()}@example.test`

/** The create step (board 1.2), located by role and accessible name. */
function createStep(page: Page) {
  return {
    heading: page.getByRole('heading', { level: 1, name: 'Start your journal', exact: true }),
    subtitle: page.getByText('Your flights stay private until you share them.', { exact: true }),
    status: page.getByRole('status'),
    change: page.getByRole('button', { name: 'Change', exact: true }),
    password: page.getByLabel('Create a password', { exact: true }),
    hint: page.getByText('At least 8 characters', { exact: true }),
    create: page.getByRole('button', { name: 'Create account', exact: true }),
  }
}

async function expectDarkChangeInk(change: Locator) {
  const paint = await change.evaluate(element => {
    const style = getComputedStyle(element)
    let ancestor = element.parentElement
    while (ancestor && getComputedStyle(ancestor).backgroundColor === 'rgba(0, 0, 0, 0)') ancestor = ancestor.parentElement
    return { color: style.color, background: style.backgroundColor, paintedBackground: ancestor ? getComputedStyle(ancestor).backgroundColor : null }
  })
  expect(paint.background).toBe('rgba(0, 0, 0, 0)')
  expect(paint.paintedBackground).toBe('rgb(64, 61, 58)')
  expect(paint.color).toBe('rgb(241, 239, 235)')
}

async function continueAs(page: Page, email: string, password: string) {
  const c = card(page)
  await c.email.fill(email)
  await c.password.fill(password)
  await c.continue.click()
}

async function reachCreateStep(page: Page, email: string, password = 'personal-password-2026') {
  await continueAs(page, email, password)
  const s = createStep(page)
  await expect(s.create).toBeFocused()
  return s
}

test('Continue with known credentials lands in the journal, even when session bootstrap is unavailable', async ({ page, baseURL }) => {
  await ownIp(page, baseURL!)
  await page.route('**/api/auth/me', route => route.fulfill({ status: 503, json: { error: 'Unavailable', code: 'UNAVAILABLE' } }))
  await page.goto('/')
  const c = card(page)
  await c.email.fill('a@example.test')
  await c.password.fill('rehearsal-password-2026')
  const request = page.waitForRequest(request => request.url().endsWith('/api/auth/continue') && request.method() === 'POST')
  await c.password.press('Enter')
  expect((await request).postDataJSON()).toEqual({ email: 'a@example.test', password: 'rehearsal-password-2026' })
  await expect(page).toHaveURL(/\/overview$/)
})

test('Checking… shows a spinner at full opacity and ignores a second press', async ({ page }) => {
  let calls = 0, release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/auth/continue', async route => { calls++; await held; await route.fulfill({ status: 401, json: { error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' } }) })
  await page.goto('/')
  const c = card(page)
  const idle = await c.continue.evaluate(element => getComputedStyle(element).backgroundColor)
  await continueAs(page, 'a@example.test', 'held-password')
  const checking = page.getByRole('button', { name: 'Checking…', exact: true })
  await expect(checking).toBeVisible()
  await expect(checking).toHaveAttribute('aria-busy', 'true')
  await expect(checking.locator('svg')).toBeVisible()
  await expect(c.heading).toBeFocused()
  expect(await checking.evaluate(element => [getComputedStyle(element).opacity, getComputedStyle(element).backgroundColor])).toEqual(['1', idle])
  await checking.click({ force: true })
  await c.password.press('Enter')
  release()
  await expect(page.getByText('Email or password is incorrect.', { exact: true })).toBeVisible()
  await expect(c.heading).toBeFocused()
  expect(calls).toBe(1)
})

test('a wrong password keeps the email, shows the error with an icon and offers a link to get back in', async ({ page, baseURL }) => {
  await ownIp(page, baseURL!)
  await page.goto('/')
  const c = card(page)
  // A migrated account with no usable password (RESET_REQUIRED) gets the same state as a wrong password.
  for (const email of ['a@example.test', 'ranked@example.test']) {
    await continueAs(page, email, 'wrong-password')
    const error = page.locator('main').getByRole('alert').filter({ hasText: 'Email or password is incorrect.' })
    await expect(error).toBeVisible()
    await expect(error.locator('svg')).toBeVisible()
    await expect(c.email).toHaveValue(email)
    await expect(c.password).toHaveAttribute('aria-invalid', 'true')
    await expect(c.heading).toBeFocused()
    await expect(page.getByRole('button', { name: 'Email me a link to get back in', exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Email me a link to get back in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Get back into Kuuki', exact: true })).toBeFocused()
  await expect(c.email).toHaveValue('ranked@example.test')
  await expect(page).toHaveURL(/\/$/)
})

test('too many attempts and a lost connection each show their own message with an icon', async ({ page }) => {
  let attempt = 0
  await page.route('**/api/auth/continue', route => ++attempt === 1
    ? route.fulfill({ status: 429, json: { error: 'Too many requests', code: 'RATE_LIMITED' } })
    : route.abort('failed'))
  await page.goto('/')
  const c = card(page)
  await continueAs(page, 'a@example.test', 'any-password')
  const limited = page.locator('main').getByRole('alert').filter({ hasText: 'Too many attempts. Please wait and try again.' })
  await expect(limited).toBeVisible()
  await expect(limited.locator('svg')).toBeVisible()
  await expect(c.heading).toBeFocused()
  await expect(page.getByRole('button', { name: 'Email me a link to get back in' })).toHaveCount(0)
  await c.continue.click()
  const failed = page.locator('main').getByRole('alert').filter({ hasText: 'We could not complete this request. Please try again.' })
  await expect(failed).toBeVisible()
  await expect(failed.locator('svg')).toBeVisible()
  await expect(c.heading).toBeFocused()
  await expect(c.email).toHaveValue('a@example.test')
})

for (const endpoint of ['continue', 'signup']) {
  test(`${endpoint} rejects malformed success replies without losing credentials`, async ({ page }) => {
    if (endpoint === 'signup') await page.route('**/api/auth/continue', route => route.fulfill({ json: { next: 'create' } }))
    const replies = [
      ['empty object', '{}'], ['empty body', ''], ['HTML', '<html>Unavailable</html>'], ['null', 'null'],
      ['missing user ID', '{"user":{}}'], ['empty user ID', '{"user":{"id":""}}'],
      ['unknown next', '{"next":"unexpected","user":{"id":"u1"}}'],
    ]
    let attempt = 0
    await page.route(`**/api/auth/${endpoint}`, route => route.fulfill({
      status: endpoint === 'signup' ? 201 : 200, contentType: 'application/json', body: replies[attempt++][1],
    }))
    await page.goto('/')
    const c = card(page), email = 'keep@example.test', password = 'personal-password-2026'
    const s = endpoint === 'signup' ? await reachCreateStep(page, email, password) : undefined
    if (!s) { await c.email.fill(email); await c.password.fill(password) }
    for (const [name] of replies) await test.step(name, async () => {
      await (s?.create ?? c.continue).click()
      await expect(page.locator('main').getByRole('alert')).toHaveText('We could not complete this request. Please try again.')
      await expect(s?.heading ?? c.heading).toBeFocused()
      await expect(c.email).toHaveValue(email)
      await expect(s?.password ?? c.password).toHaveValue(password)
      await expect(page).toHaveURL(/\/$/)
    })
    expect(attempt).toBe(replies.length)
  })
}

test('Creating focuses the heading, and server failures return focus there with the password kept', async ({ page }) => {
  await page.route('**/api/auth/continue', route => route.fulfill({ json: { next: 'create' } }))
  let release!: () => void, held: Promise<void>, attempt = 0
  await page.route('**/api/auth/signup', async route => {
    await held
    if (++attempt === 1) await route.fulfill({ status: 429, json: { code: 'RATE_LIMITED' } })
    else if (attempt === 2) await route.abort('failed')
    else await route.fulfill({ status: 400, json: { code: 'WEAK_PASSWORD' } })
  })
  await page.goto('/')
  const s = await reachCreateStep(page, 'retry@example.test')
  for (const message of ['Too many attempts. Please wait and try again.', 'We could not complete this request. Please try again.', 'Use at least 8 characters.']) {
    held = new Promise<void>(resolve => { release = resolve })
    await s.create.click()
    await expect(page.getByRole('button', { name: 'Creating…', exact: true })).toBeVisible()
    await expect(s.heading).toBeFocused()
    release()
    await expect(page.locator('main').getByRole('alert')).toHaveText(message)
    await expect(s.heading).toBeFocused()
    await expect(s.password).toHaveValue('personal-password-2026')
  }
})

test('an unknown email turns the card into the create step in place, and Create account reaches onboarding', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'kuuki_theme', value: 'dark', url: baseURL! }, { name: 'kuuki_accent', value: 'shu', url: baseURL! }])
  await ownIp(page, baseURL!)
  await page.goto('/')
  const email = newEmail()
  const s = await reachCreateStep(page, email)
  await expect(page).toHaveURL(/\/$/)
  await expect(s.heading).toBeVisible()
  await expect(s.subtitle).toBeVisible()
  await expect(s.status).toHaveText(`No Kuuki journal uses ${email} yet.`)
  await expect(s.change).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'shu')
  await expectDarkChangeInk(s.change)
  await expect(s.password).toHaveValue('personal-password-2026')
  await expect(s.password).toHaveAttribute('autocomplete', 'new-password')
  await expect(s.hint).toBeVisible()
  await expect(card(page).email).toHaveValue(email)
  await expect(card(page).email).toHaveAttribute('autocomplete', 'username')
  await expect(card(page).cantSignIn).toHaveCount(0)
  await expect(card(page).tagline).toBeVisible()
  await expect(page.getByLabel('Confirm password')).toHaveCount(0)
  // Enter on the focused Create account creates the journal.
  await page.keyboard.press('Enter')
  await page.waitForURL(url => url.pathname === '/onboarding')
})

test('the create step slides in, but swaps in place without a slide under reduced motion', async ({ page }) => {
  await page.route('**/api/auth/continue', route => route.fulfill({ json: { next: 'create' } }))
  await page.goto('/')
  // Walks up from the heading: is any part of the swapped content animating its entrance?
  const animated = () => createStep(page).heading.evaluate(element => {
    for (let node: Element | null = element; node && node.tagName !== 'MAIN'; node = node.parentElement) if (getComputedStyle(node).animationName !== 'none') return true
    return false
  })
  await reachCreateStep(page, 'motion@example.test')
  expect(await animated()).toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await reachCreateStep(page, 'still@example.test')
  expect(await animated()).toBe(false)
  expect(await page.locator('main').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0)
})

test('Change returns to the form with the email selected, and editing the email leaves the create step', async ({ page, baseURL }) => {
  await ownIp(page, baseURL!)
  await page.goto('/')
  const c = card(page)
  const email = newEmail()
  let s = await reachCreateStep(page, email)
  await s.change.click()
  await expect(c.heading).toBeVisible()
  await expect(c.continue).toBeVisible()
  await expect(c.email).toBeFocused()
  expect(await c.email.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])).toEqual([0, email.length])
  await expect(c.password).toHaveValue('personal-password-2026')
  await expect(c.password).toHaveAttribute('autocomplete', 'current-password')
  await expect(page.getByRole('status')).toHaveCount(0)
  // The create step is only valid for the email it checked: typing in the email field returns to the form.
  s = await reachCreateStep(page, email)
  await card(page).email.click()
  await page.keyboard.press('End')
  await page.keyboard.type('x')
  await expect(c.heading).toBeVisible()
  await expect(s.create).toHaveCount(0)
  await expect(c.email).toBeFocused()
  await expect(c.email).toHaveValue(`${email}x`)
})

test('a short password on the create step shows an inline error and creates nothing', async ({ page, baseURL }) => {
  await ownIp(page, baseURL!)
  let signups = 0
  await page.route('**/api/auth/signup', route => { signups++; return route.continue() })
  await page.goto('/')
  const s = await reachCreateStep(page, newEmail(), 'short')
  await s.create.click()
  const error = page.locator('main').getByRole('alert').filter({ hasText: 'Use at least 8 characters.' })
  await expect(error).toBeVisible()
  await expect(error.locator('svg')).toBeVisible()
  await expect(s.password).toHaveAttribute('aria-invalid', 'true')
  await expect(s.password).toBeFocused()
  await expect(s.heading).toBeVisible()
  expect(signups).toBe(0)
})

test('an email taken a moment ago returns to the form, and an account created without a session asks to sign in', async ({ page }) => {
  await page.route('**/api/auth/continue', route => route.fulfill({ json: { next: 'create' } }))
  let attempt = 0
  await page.route('**/api/auth/signup', route => ++attempt === 1
    ? route.fulfill({ status: 409, json: { error: 'An account with this email already exists', code: 'EMAIL_TAKEN' } })
    : route.fulfill({ status: 503, json: { error: 'Your account was created. Please sign in to continue.', code: 'SIGN_IN_REQUIRED' } }))
  await page.goto('/')
  const c = card(page)
  let s = await reachCreateStep(page, 'race@example.test')
  await s.create.click()
  await expect(page.locator('main').getByRole('alert').filter({ hasText: 'This email just got a journal. Continue to sign in.' })).toBeVisible()
  await expect(c.heading).toBeFocused()
  await expect(c.email).toHaveValue('race@example.test')
  await expect(c.continue).toBeVisible()
  await c.continue.click()
  s = createStep(page)
  await expect(s.create).toBeFocused()
  await s.create.click()
  await expect(page.getByRole('status').filter({ hasText: 'Your account was created. Continue to sign in.' })).toBeVisible()
  await expect(c.heading).toBeFocused()
  await expect(c.continue).toBeVisible()
  await expect(c.password).toHaveValue('personal-password-2026')
})

test('the create step follows the Russian locale', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'kuuki_locale', value: 'ru', url: baseURL! }, { name: 'kuuki_theme', value: 'dark', url: baseURL! }, { name: 'kuuki_accent', value: 'shu', url: baseURL! }])
  await page.route('**/api/auth/continue', route => route.fulfill({ json: { next: 'create' } }))
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Почта', exact: true }).fill('ru@example.test')
  await page.getByLabel('Пароль', { exact: true }).fill('personal-password-2026')
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Создать аккаунт', exact: true })).toBeFocused()
  await expect(page.getByRole('heading', { level: 1, name: 'Начните свой журнал' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Журнала Kuuki для ru@example.test пока нет.')
  await expect(page.getByLabel('Придумайте пароль', { exact: true })).toHaveValue('personal-password-2026')
  await expect(page.getByText('Не менее 8 символов', { exact: true })).toBeVisible()
  const change = page.getByRole('button', { name: 'Изменить', exact: true })
  await expect(change).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'shu')
  await expectDarkChangeInk(change)
})

/** The brand panel's decorative planes, by size, counting only the ones the current layout shows. */
async function visiblePlanes(page: Page) {
  const planes = page.locator('[data-plane]:visible')
  return {
    all: await planes.count(),
    small: await page.locator('[data-plane="s"]:visible').count(),
    medium: await page.locator('[data-plane="m"]:visible').count(),
    large: await page.locator('[data-plane="l"]:visible').count(),
  }
}

/** Animations running on the plane glyphs (SVG elements), not on anything else in the page. */
function planeAnimations(page: Page) {
  return page.evaluate(() => {
    const planes = document.getAnimations().filter(animation => (animation as CSSAnimation).effect instanceof KeyframeEffect
      && (animation.effect as KeyframeEffect).target instanceof SVGElement)
    return { total: planes.length, running: planes.filter(animation => animation.playState === 'running').length }
  })
}

test('the desktop brand panel has 30 planes (12 small, 10 medium, 8 large) over the くうき watermark', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  expect(await visiblePlanes(page)).toEqual({ all: 30, small: 12, medium: 10, large: 8 })
  // The watermark is stacked one glyph per line, and the whole field is decoration.
  const glyphs = await Promise.all(['く', 'う', 'き'].map(async glyph => (await page.getByText(glyph, { exact: true }).boundingBox())!))
  expect(glyphs[0].y).toBeLessThan(glyphs[1].y)
  expect(glyphs[1].y).toBeLessThan(glyphs[2].y)
  expect(await page.locator('[data-plane]').first().evaluate(element => element.closest('[aria-hidden=true]') !== null)).toBe(true)
  // Check the computed transparent mask; decorative pointer hit-testing cannot prove painted clearance.
  await expect(page.locator('.auth-planes')).toHaveCSS('mask-image', /radial-gradient\(.*rgba\(0, 0, 0, 0\).*rgb\(0, 0, 0\)\)/)
})

test('the mobile brand band has 14 planes (5 small, 5 medium, 4 large) over a horizontal watermark', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  expect(await visiblePlanes(page)).toEqual({ all: 14, small: 5, medium: 5, large: 4 })
  const glyphs = await Promise.all(['く', 'う', 'き'].map(async glyph => (await page.getByText(glyph, { exact: true }).boundingBox())!))
  expect(glyphs[0].x).toBeLessThan(glyphs[1].x)
  expect(glyphs[1].x).toBeLessThan(glyphs[2].x)
  expect(glyphs[0].y).toBeCloseTo(glyphs[2].y, 0)
  await expect(page.locator('.auth-planes')).toHaveCSS('mask-image', /radial-gradient\(.*rgba\(0, 0, 0, 0\).*rgb\(0, 0, 0\)\)/)
})

for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]] as const) {
  test(`${name} planes are present but still under reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize(viewport)
    await page.goto('/')
    expect((await visiblePlanes(page)).all).toBe(name === 'desktop' ? 30 : 14)
    // Give an observer-driven start a chance to wrongly kick in.
    await page.waitForTimeout(500)
    expect(await planeAnimations(page)).toEqual({ total: 0, running: 0 })
  })
}

test('planes drift with transform only, and stop while the page is hidden', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect.poll(async () => (await planeAnimations(page)).running).toBe(30)
  const properties = await page.evaluate(() => [...new Set(document.getAnimations()
    .filter(animation => (animation as CSSAnimation).effect instanceof KeyframeEffect && (animation.effect as KeyframeEffect).target instanceof SVGElement)
    .flatMap(animation => (animation.effect as KeyframeEffect).getKeyframes().flatMap(keyframe => Object.keys(keyframe).filter(key => !['offset', 'easing', 'composite', 'computedOffset'].includes(key)))))])
  expect(properties).toEqual(['transform'])
  // Sample rendered transforms at fixed animation times, without waiting for wall-clock motion.
  const drift = await page.locator('[data-plane]:visible').first().evaluate(plane => {
    const animation = plane.getAnimations()[0]
    animation.pause()
    animation.currentTime = 0
    const start = new DOMMatrix(getComputedStyle(plane).transform)
    animation.currentTime = 1000
    const end = new DOMMatrix(getComputedStyle(plane).transform)
    const glyph = new DOMMatrix(getComputedStyle(plane.firstElementChild!).transform)
    return { x: end.m41 - start.m41, y: end.m42 - start.m42, rotation: Math.atan2(glyph.m12, glyph.m11) * 180 / Math.PI }
  })
  expect(drift.x).toBeGreaterThan(0)
  expect(drift.y).toBeCloseTo(-2 * drift.x, 3)
  expect(drift.rotation).toBeCloseTo(-18.4, 3)
  // WAAPI pause/currentTime writes override CSS playback; test visibility on fresh animations.
  await page.reload()
  await expect.poll(async () => (await planeAnimations(page)).running).toBe(30)
  // The vertical offset of the first plane on screen, which changes every frame while the field runs.
  const sample = () => page.evaluate(() => {
    const plane = [...document.querySelectorAll('[data-plane]')].find(element => element.getClientRects().length > 0)!
    return new DOMMatrix(getComputedStyle(plane).transform).m42
  })
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(async () => (await planeAnimations(page)).running).toBe(0)
  // CSS reports paused before its pending pause commits on the animation timeline.
  await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.ready)))
  const frozen = await sample()
  await page.waitForTimeout(300)
  expect(await sample()).toBe(frozen)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(async () => (await planeAnimations(page)).running).toBe(30)
})

test('planes stop while the brand band is scrolled out of view', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 390, height: 300 })
  await page.goto('/')
  await expect.poll(async () => (await planeAnimations(page)).running).toBe(14)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(async () => (await planeAnimations(page)).running).toBe(0)
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(async () => (await planeAnimations(page)).running).toBe(14)
})
