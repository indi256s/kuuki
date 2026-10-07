import { test, expect, type BrowserContext, type Page } from '@playwright/test'

// One real sign-in: sign-in is rate limited per IP across the whole suite.
let memberCookies: Awaited<ReturnType<BrowserContext['cookies']>> = []
test.beforeAll(async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  // The suite shares one per-IP sign-in budget; this file signs in once from its own client address.
  const response = await page.request.post('/api/auth/sign-in/email', { headers: { Origin: baseURL!, 'CF-Connecting-IP': '203.0.113.60' }, data: { email: 'a@example.test', password: 'rehearsal-password-2026' } })
  expect(response.status()).toBe(200)
  memberCookies = await context.cookies()
  await context.close()
})
async function asMember(page: Page) { await page.context().addCookies(memberCookies) }

test('Commissioner loads with equal-width tabular digits at every UI weight', async ({ page }) => {
  await page.goto('/')
  const report = await page.evaluate(async () => {
    const probe = document.createElement('span')
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap'
    document.querySelector('body')!.appendChild(probe)
    const rows = []
    for (const weight of [400, 500, 600, 700]) {
      const faces = await document.fonts.load(`${weight} 15px Commissioner`, 'Авиакомпании 0123456789')
      probe.style.fontWeight = String(weight)
      const widths = [...'0123456789'].map(digit => {
        probe.textContent = digit.repeat(8)
        return probe.getBoundingClientRect().width
      })
      rows.push({ loaded: faces.length > 0, family: getComputedStyle(probe).fontFamily, numeric: getComputedStyle(probe).fontVariantNumeric, spread: Math.max(...widths) - Math.min(...widths) })
    }
    probe.remove()
    return rows
  })
  for (const row of report) {
    expect(row.loaded).toBe(true)
    expect(row.family).toContain('Commissioner')
    expect(row.numeric).toBe('tabular-nums')
    expect(row.spread).toBeLessThan(0.1)
  }
})

const ACTIONS = [['upload', '/import', '?source=file'], ['paste', '/import', '?source=text'], ['manual', '/add', '']] as const

test.describe('mobile shell at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('all five tabs work and mark the current page', async ({ page }) => {
    await asMember(page)
    await page.goto('/overview')
    const tabs = page.locator('nav.tab-bar')
    await expect(tabs.locator('li')).toHaveCount(5)
    await expect(page.locator('header').locator('nav.desktop-nav')).toBeHidden()
    for (const route of ['journal', 'passport', 'overview']) {
      await tabs.locator(`a[href="/${route}"]`).click()
      await page.waitForURL(url => url.pathname === `/${route}`)
      await expect(tabs.locator(`a[href="/${route}"]`)).toHaveAttribute('aria-current', 'page')
    }
    await tabs.locator('a[href="/me"]').click()
    await page.waitForURL(url => url.pathname.startsWith('/fly/'))
    await expect(tabs.locator('a[href="/me"]')).toHaveAttribute('aria-current', 'page')
  })

  test('Overview stays current for a year query', async ({ page }) => {
    await asMember(page)
    await page.goto('/overview?year=2024')
    await expect(page.locator('nav.tab-bar a[href="/overview"]')).toHaveAttribute('aria-current', 'page')
  })

  for (const [id, path, search] of ACTIONS) {
    test(`Add sheet action ${id} navigates`, async ({ page }) => {
      await asMember(page)
      await page.goto('/overview')
      await page.locator('nav.tab-bar button.tab-add').click()
      const sheet = page.getByRole('dialog')
      await expect(sheet.locator('a[data-add-action]')).toHaveCount(3)
      await sheet.locator(`a[data-add-action="${id}"]`).click()
      await page.waitForURL(url => url.pathname === path && url.search === search)
      // The Add sheet closes on the route change; /add then shows its own capture dialog, also titled "Add a flight".
      await expect(page.locator('a[data-add-action]')).toHaveCount(0)
    })
  }

  test('the Add sheet sits above the tab bar', async ({ page }) => {
    await asMember(page)
    await page.goto('/overview')
    const box = (await page.locator('nav.tab-bar').boundingBox())!
    await page.locator('nav.tab-bar button.tab-add').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.waitForTimeout(450) // enter animation
    const inside = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.ui-sheet'), { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    expect(inside).toBe(true)
  })

  test('the Add sheet closes on back navigation', async ({ page }) => {
    await asMember(page)
    await page.goto('/overview')
    await page.locator('nav.tab-bar a[href="/journal"]').click()
    await page.waitForURL(url => url.pathname === '/journal')
    await page.locator('nav.tab-bar button.tab-add').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.goBack()
    await page.waitForURL(url => url.pathname === '/overview')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Tabs' })).toBeVisible()
  })

  test('the header is 48px and content clears the tab bar', async ({ page }) => {
    await asMember(page)
    await page.goto('/overview')
    expect((await page.locator('header.site-header').boundingBox())!.height).toBeCloseTo(48, 0)
    await expect(page.locator('header.site-header')).toHaveCSS('border-bottom-width', '0px')
    const tab = (await page.locator('nav.tab-bar').boundingBox())!
    const paddingBottom = await page.locator('main#main').evaluate(node => parseFloat(getComputedStyle(node).paddingBottom))
    expect(paddingBottom).toBeGreaterThanOrEqual(tab.height)
  })
})

test.describe('mobile shell at 320px', () => {
  test.use({ viewport: { width: 320, height: 640 } })

  for (const locale of ['en', 'ru']) {
    test(`tab labels fit without overflow (${locale})`, async ({ page, context, baseURL }) => {
      await asMember(page)
      await context.addCookies([{ name: 'kuuki_locale', value: locale, url: baseURL! }])
      await page.goto('/overview')
      const report = await page.evaluate(() => {
        const bar = document.querySelector('nav.tab-bar')!
        const tabs = [...bar.querySelectorAll<HTMLElement>('.tab')]
        return {
          page: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
          bar: [bar.scrollWidth, bar.clientWidth],
          tabs: tabs.map(tab => { const label = tab.querySelector<HTMLElement>('.tab-label')!; return { tab: [tab.scrollWidth, tab.clientWidth], label: [label.scrollWidth, label.clientWidth], text: label.innerText } }),
        }
      })
      expect(report.page[0]).toBeLessThanOrEqual(report.page[1])
      expect(report.bar[0]).toBeLessThanOrEqual(report.bar[1])
      expect(report.tabs).toHaveLength(5)
      expect(report.tabs.map(tab => tab.text)).toEqual(locale === 'ru' ? ['Обзор', 'Журнал', 'Добавить', 'Паспорт', 'Я'] : ['Overview', 'Journal', 'Add', 'Passport', 'Me'])
      for (const tab of report.tabs) {
        expect(tab.label[0], tab.text).toBeLessThanOrEqual(tab.label[1])
        expect(tab.tab[0], tab.text).toBeLessThanOrEqual(tab.tab[1])
        expect(tab.label[1], tab.text).toBeLessThanOrEqual(tab.tab[1])
      }
    })
  }
})

test.describe('desktop shell', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  async function tabTo(page: Page, label: string) {
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      if (await page.evaluate(name => document.activeElement?.getAttribute('aria-label') === name, label)) return
    }
    throw new Error(`never focused ${label}`)
  }

  test('header is 56px with nav, split Add and avatar menu; tab bar is hidden', async ({ page }) => {
    await asMember(page)
    await page.goto('/overview')
    expect((await page.locator('header.site-header').boundingBox())!.height).toBeCloseTo(56, 0)
    await expect(page.locator('header.site-header')).toHaveCSS('border-bottom-width', '0px')
    await expect(page.locator('nav.tab-bar')).toBeHidden()
    await expect(page.locator('nav.desktop-nav a:visible')).toHaveCount(4)
    await expect(page.locator('nav.desktop-nav a[href="/overview"]')).toHaveAttribute('aria-current', 'page')
  })

  test('split Add menu works by keyboard alone', async ({ page }) => {
    await asMember(page)
    await page.goto('/overview')
    await tabTo(page, 'More ways to add')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem')).toHaveCount(3)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await page.waitForURL(url => url.pathname.startsWith('/import') || url.pathname === '/add')
  })

  test('avatar menu works by keyboard and the theme radio changes data-theme', async ({ page }) => {
    await asMember(page)
    await page.goto('/overview')
    await tabTo(page, 'Account menu')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /My profile/ })).toHaveAttribute('href', /^\/fly\//)
    await expect(page.getByRole('menuitem', { name: /My profile/ })).toBeFocused()
    await expect(page.getByRole('menuitemcheckbox', { name: 'Public profile' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    for (let i = 0; i < 12; i++) {
      const name = await page.evaluate(() => document.activeElement?.textContent ?? '')
      if (name === 'Dark') break
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(50)
    }
    await page.keyboard.press('Enter')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeFocused()
  })

  test('profile visibility toggle writes and stays in sync', async ({ page }) => {
    await asMember(page)
    await page.goto('/overview')
    await page.getByRole('button', { name: 'Account menu' }).click()
    const toggle = page.getByRole('menuitemcheckbox', { name: 'Public profile' })
    const before = await toggle.getAttribute('aria-checked')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', before!)
  })
})
