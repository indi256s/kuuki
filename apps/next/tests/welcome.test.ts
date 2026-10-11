import { expect, test, type Page } from '@playwright/test'
import { fixtureHeaders } from './helpers'

/** A new account, signed in on `page`, that hasn't onboarded. */
async function signup(page: Page, origin: string) {
  const response = await page.request.post('/api/auth/sign-up/email', {
    headers: fixtureHeaders(origin),
    data: {
      email: `welcome-${crypto.randomUUID()}@example.test`,
      password: 'welcome-password-2026',
    },
  })
  expect(response.status()).toBe(201)
}

async function csrf(page: Page) {
  const cookies = await page.context().cookies()
  return decodeURIComponent(cookies.find((cookie) => cookie.name === 'kuuki_csrf')?.value ?? '')
}

async function api(
  page: Page,
  origin: string,
  method: 'patch' | 'post',
  path: string,
  data?: unknown,
) {
  const response = await page.request[method](path, {
    headers: { Origin: origin, 'X-CSRF-Token': await csrf(page) },
    data,
  })
  expect(response.ok(), `${method} ${path}: ${response.status()}`).toBe(true)
  return response.json()
}

const name = (page: Page, origin: string) =>
  api(page, origin, 'patch', '/api/profiles/me', {
    display_name: 'Alex Mor',
    username: `alex-${crypto.randomUUID().slice(0, 8)}`,
  })

test('old onboarding links and the member gate resume the card at the right step', async ({
  page,
  baseURL,
}) => {
  await signup(page, baseURL!)
  await page.goto('/onboarding?step=name')
  await expect(page).toHaveURL(/\/welcome\/name$/)
  await page.goto('/onboarding?step=capture')
  await expect(page).toHaveURL(/\/welcome\/name$/)
  await page.goto('/overview')
  await expect(page).toHaveURL(/\/welcome\/name$/)

  // A name but no import and not onboarded: the flights step.
  await name(page, baseURL!)
  await page.goto('/overview')
  await expect(page).toHaveURL(/\/welcome\/flights$/)
  await page.goto('/welcome/review')
  await expect(page).toHaveURL(/\/welcome\/flights$/)

  // A batch with drafts to review wins over the prompt, also when the old link asks for capture.
  const job = await api(page, baseURL!, 'post', '/api/import/jobs', {
    type: 'text',
    submissionOperationId: `welcome-${crypto.randomUUID()}`,
    content: 'KUUKI FLIGHTS v2\n2024-03-15 | JFK → LHR | BA 178 | 19:00 → 07:00',
  })
  const batch = job.batch?.id ?? job.batchId
  expect(batch).toBeTruthy()
  await page.goto('/onboarding?step=capture')
  await expect(page).toHaveURL(new RegExp(`/welcome/review\\?batch=${batch}$`))
  await page.goto('/welcome/flights')
  await expect(page).toHaveURL(new RegExp(`/welcome/review\\?batch=${batch}$`))

  // Onboarded: every welcome URL is the Overview.
  await api(page, baseURL!, 'post', '/api/profiles/me/onboarded')
  await page.goto('/welcome/name')
  await expect(page).toHaveURL(/\/overview$/)
  await page.goto('/onboarding')
  await expect(page).toHaveURL(/\/overview$/)
})

test('Create account morphs the card into the name step without a reload, and Back walks the steps', async ({
  page,
  baseURL,
}) => {
  // Continue spends `signin:<ip>` and the create answer `signup:<ip>`, so the journey gets its own IP.
  await page.setExtraHTTPHeaders({
    'CF-Connecting-IP': fixtureHeaders(baseURL!)['CF-Connecting-IP'],
  })
  await page.goto('/')
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`morph-${crypto.randomUUID()}@example.test`)
  await page.getByLabel('Password', { exact: true }).fill('welcome-password-2026')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  const create = page.getByRole('button', { name: 'Create account', exact: true })
  await expect(create).toBeFocused()
  // Markers on the document and on the card frame: a reload or a remounted shell would lose them.
  await page.evaluate(() => {
    Object.assign(window, { __welcomeMarker: true })
    Object.assign(document.querySelector('.auth-card')!, { __welcomeMarker: true })
  })
  await create.click()
  await page.waitForURL((url) => url.pathname === '/welcome/name')
  await expect(page.getByRole('heading', { name: 'What should we call you?' })).toBeVisible()
  expect(
    await page.evaluate(() => ({
      window: (window as { __welcomeMarker?: boolean }).__welcomeMarker,
      card: (document.querySelector('.auth-card') as { __welcomeMarker?: boolean } | null)
        ?.__welcomeMarker,
    })),
  ).toEqual({ window: true, card: true })

  const field = page.getByLabel('Your name', { exact: true })
  await field.fill('Alex Mor')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/welcome/flights')

  await page.goBack()
  await page.waitForURL((url) => url.pathname === '/welcome/name')
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Alex Mor')

  // Back past the name step never shows the create step again: the account exists.
  await page.goBack()
  await page.waitForURL((url) => url.pathname === '/welcome/name')
  await expect(page.getByLabel('Your name', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Start your journal', exact: true })).toHaveCount(
    0,
  )
})

test('I’ll do this later is final: an empty Overview, and the welcome URLs stay behind', async ({
  page,
  baseURL,
}) => {
  await signup(page, baseURL!)
  await name(page, baseURL!)
  await page.goto('/welcome/flights')
  await page.getByRole('button', { name: 'I’ll do this later', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/overview')
  await expect(page.locator('.ov3-first-run')).toBeVisible()
  await page.goto('/welcome/flights')
  await expect(page).toHaveURL(/\/overview$/)
})
