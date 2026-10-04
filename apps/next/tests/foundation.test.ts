import { test, expect } from '@playwright/test'

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
