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
  const toggle = page.getByRole('button', { name: 'Тёмная тема', exact: true })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
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
