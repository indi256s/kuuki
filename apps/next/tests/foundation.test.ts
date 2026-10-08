import { test, expect } from '@playwright/test'
import { signIn } from './helpers'

test('RU dark shell has no narrow viewport overflow with reduced motion', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'kuuki_locale', value: 'ru', url: baseURL! }, { name: 'kuuki_theme', value: 'dark', url: baseURL! }])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  const toggle = page.getByRole('button', { name: 'Тёмная тема', exact: true })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

for (const removed of ['terracotta', 'kincha', 'sumi', 'yellow']) {
  test(`a stored ${removed} accent renders shu and the cookie is rewritten`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'kuuki_accent', value: removed, url: baseURL! }])
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'shu')
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#c23417')
    expect((await context.cookies()).find(cookie => cookie.name === 'kuuki_accent')?.value).toBe('shu')
  })
}

// Each side's slide rule names the side and the state, so the reduced-motion fade must outrank both.
test('bottom and right sheets fade instead of sliding under reduced motion', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const [width, side] of [[390, 'bottom'], [1440, 'right']] as const) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
    await page.goto('/passport?country=US')
    const sheet = page.locator('.ui-sheet')
    await expect(sheet).toHaveAttribute('data-side', side)
    await expect(sheet).toHaveAttribute('data-state', 'open')
    expect(await sheet.evaluate(element => getComputedStyle(element).animationName)).toBe('ui-fade-in')
  }
})

test('BrandShell wordmark freezes on the first kana under reduced motion at desktop and mobile widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
    await page.goto('/account-deleted')
    const wordmark = page.getByRole('banner').getByRole('link', { name: 'Kuuki home', exact: true })
    await expect(wordmark).toBeVisible()
    const glyphs = wordmark.locator('[aria-hidden] > span')
    await expect(glyphs).toHaveText(['く', 'う', 'き'])
    for (let index = 0; index < 3; index++) {
      await expect(glyphs.nth(index)).toHaveCSS('animation-name', 'none')
      await expect(glyphs.nth(index)).toHaveCSS('opacity', index === 0 ? '1' : '0')
    }
  }
})

for (const [width, navigation, interaction, pseudo] of [
  [1440, 'Primary', 'hover', '::after'],
  [390, 'Tabs', 'press', '::before'],
] as const) {
  test(`dark Shu active ${navigation} navigation uses text ink on inset during ${interaction}`, async ({ page, context, baseURL }) => {
    await context.addCookies([
      { name: 'kuuki_locale', value: 'en', url: baseURL! },
      { name: 'kuuki_theme', value: 'dark', url: baseURL! },
      { name: 'kuuki_accent', value: 'shu', url: baseURL! },
    ])
    await signIn(page, baseURL!)
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
    await page.goto('/overview')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'shu')
    const active = page.getByRole('navigation', { name: navigation, exact: true }).getByRole('link', { name: 'Overview', exact: true })
    await expect(active).toHaveAttribute('aria-current', 'page')
    await active.hover()
    try {
      if (interaction === 'press') await page.mouse.down()
      await expect(active).toHaveCSS('background-color', 'rgb(64, 61, 58)')
      await expect(active).toHaveCSS('color', 'rgb(241, 239, 235)')
      await expect(active.getByText('Overview', { exact: true })).toHaveCSS('color', 'rgb(241, 239, 235)')
      await expect.poll(() => active.evaluate((element, indicator) => {
        const style = getComputedStyle(element, indicator)
        return { painted: style.content !== 'none' && parseFloat(style.width) > 0, height: style.height, color: style.backgroundColor }
      }, pseudo)).toEqual({ painted: true, height: '2px', color: 'rgb(234, 132, 111)' })
    } finally {
      if (interaction === 'press') await page.mouse.up()
    }
    // Enter keyboard modality before focusing the real link, so :focus-visible is exercised.
    await page.keyboard.press('Tab')
    await active.focus()
    await expect(active).toBeFocused()
    await expect(active).toHaveCSS('outline-style', 'solid')
    await expect(active).toHaveCSS('outline-width', '2px')
    await expect(active).toHaveCSS('outline-offset', '2px')
    await expect(active).toHaveCSS('outline-color', 'rgb(234, 132, 111)')
  })
}
