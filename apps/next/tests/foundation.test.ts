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
  await page.getByRole('combobox', { name: 'Тема' }).selectOption('light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

for (const removed of ['kincha', 'sumi']) {
  test(`a stored ${removed} accent renders terracotta and the cookie is rewritten`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'kuuki_accent', value: removed, url: baseURL! }])
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'terracotta')
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#a94e35')
    expect((await context.cookies()).find(cookie => cookie.name === 'kuuki_accent')?.value).toBe('terracotta')
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
