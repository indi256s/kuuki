import { expect, test, type Locator, type Page } from '@playwright/test'
import { fixtureHeaders } from './helpers'

const TAGLINES = ['Snap a boarding pass. We’ll figure it out.', 'Halfway to the Moon, apparently.']

/** The card's key elements, located by role and accessible name. */
function card(page: Page) {
  return {
    heading: page.getByRole('heading', { level: 1, name: 'Welcome to Kuuki', exact: true }),
    email: page.getByRole('textbox', { name: 'Email', exact: true }),
    password: page.getByLabel('Password', { exact: true }),
    cantSignIn: page.getByRole('link', { name: 'Can’t sign in?', exact: true }),
    continue: page.getByRole('button', { name: 'Continue', exact: true }),
    tagline: page.getByText(
      new RegExp(`^(${TAGLINES.map((line) => line.replace(/[.?]/g, '\\$&')).join('|')})$`),
    ),
  }
}

/** Continue spends `signin:<ip>` and every `create` answer also spends `signup:<ip>`, so each journey gets its own IP. */
async function ownIp(page: Page, baseURL: string) {
  await page.setExtraHTTPHeaders({
    'CF-Connecting-IP': fixtureHeaders(baseURL)['CF-Connecting-IP'],
  })
}

const newEmail = () => `new-${crypto.randomUUID()}@example.test`

test('Google sign-in leaves the empty password form through the configured callback', async ({
  page,
  baseURL,
}) => {
  await ownIp(page, baseURL!)
  await page.route('https://accounts.google.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Google authorization fixture</h1>' }),
  )
  await page.goto('/signin')
  const request = page.waitForRequest('**/api/auth/sign-in/social')
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).focus()
  await page.keyboard.press('Enter')
  expect((await request).postDataJSON()).toEqual({ provider: 'google' })
  await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//)
  const authorization = new URL(page.url())
  expect(authorization.searchParams.get('redirect_uri')).toBe(`${baseURL}/api/auth/callback/google`)
  expect(authorization.searchParams.get('state')).toBeTruthy()
})

test('a failed Google callback offers a retry and an unlinked account offers email recovery', async ({
  page,
}) => {
  await page.goto('/signin?error=access_denied')
  await expect(page.locator('main').getByRole('alert')).toHaveText(
    'Google sign-in was not completed. Please try again.',
  )
  await expect(
    page.getByRole('button', { name: 'Continue with Google', exact: true }),
  ).toBeEnabled()
  await page.goto('/signin?error=account_not_linked')
  await expect(page.locator('main').getByRole('alert')).toHaveText(
    'Use “Can’t sign in?” to verify your email and sign in with a password.',
  )
  await page.getByRole('link', { name: 'Can’t sign in?', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Get back into Kuuki', exact: true }),
  ).toBeVisible()
})

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
  const paint = await change.evaluate((element) => {
    const style = getComputedStyle(element)
    let ancestor = element.parentElement
    while (ancestor && getComputedStyle(ancestor).backgroundColor === 'rgba(0, 0, 0, 0)')
      ancestor = ancestor.parentElement
    return {
      color: style.color,
      background: style.backgroundColor,
      paintedBackground: ancestor ? getComputedStyle(ancestor).backgroundColor : null,
    }
  })
  expect(paint.background).toBe('rgba(0, 0, 0, 0)')
  expect(paint.paintedBackground).toBe('rgb(35, 35, 35)')
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

test('Continue with known credentials lands in the journal, even when session bootstrap is unavailable', async ({
  page,
  baseURL,
}) => {
  await ownIp(page, baseURL!)
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 503, json: { error: 'Unavailable', code: 'UNAVAILABLE' } }),
  )
  await page.goto('/')
  const c = card(page)
  await c.email.fill('a@example.test')
  await c.password.fill('rehearsal-password-2026')
  const request = page.waitForRequest(
    (request) => request.url().endsWith('/api/auth/continue') && request.method() === 'POST',
  )
  await c.password.press('Enter')
  expect((await request).postDataJSON()).toEqual({
    email: 'a@example.test',
    password: 'rehearsal-password-2026',
  })
  await expect(page).toHaveURL(/\/overview$/)
})

test('a wrong password keeps the email, shows the error with an icon and offers a link to get back in', async ({
  page,
  baseURL,
}) => {
  await ownIp(page, baseURL!)
  await page.goto('/')
  const c = card(page)
  // A migrated account with no usable password (RESET_REQUIRED) gets the same state as a wrong password.
  for (const email of ['a@example.test', 'ranked@example.test']) {
    await continueAs(page, email, 'wrong-password')
    const error = page
      .locator('main')
      .getByRole('alert')
      .filter({ hasText: 'Email or password is incorrect.' })
    await expect(error).toBeVisible()
    await expect(error.locator('svg')).toBeVisible()
    await expect(c.email).toHaveValue(email)
    await expect(c.password).toHaveAttribute('aria-invalid', 'true')
    await expect(c.heading).toBeFocused()
    await expect(
      page.getByRole('button', { name: 'Email me a link to get back in', exact: true }),
    ).toBeVisible()
  }
  await page.getByRole('button', { name: 'Email me a link to get back in', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Get back into Kuuki', exact: true }),
  ).toBeFocused()
  await expect(c.email).toHaveValue('ranked@example.test')
  await expect(page).toHaveURL(/\/$/)
})

test('an unknown email turns the card into the create step in place, and Create account morphs into the name step', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: 'kuuki_theme', value: 'dark', url: baseURL! },
    { name: 'kuuki_accent', value: 'shu', url: baseURL! },
  ])
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
  await page.waitForURL((url) => url.pathname === '/welcome/name')
  await expect(page.getByRole('heading', { name: 'What should we call you?' })).toBeVisible()
})
