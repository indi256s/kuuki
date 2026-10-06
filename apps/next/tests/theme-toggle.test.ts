import { expect, test } from '@playwright/test'

test.describe('Horizon theme toggle on the card', () => {
  test('follows a light device, a click sets dark explicitly and the choice survives reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/signin')
    const toggle = page.getByRole('button', { name: 'Dark theme', exact: true })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(toggle).toHaveAttribute('title', 'Dark theme')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    expect((await page.context().cookies()).find(cookie => cookie.name === 'kuuki_theme')?.value).toBe('system')

    await toggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveAccessibleName('Dark theme')
    expect((await page.context().cookies()).find(cookie => cookie.name === 'kuuki_theme')?.value).toBe('dark')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#292827')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')

    await toggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  test('follows the device while the preference is still system', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/signin')
    const toggle = page.getByRole('button', { name: 'Dark theme', exact: true })
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  test('moves the sun and shifts the icon by the specified amounts, instantly under reduced motion', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/signin')
    const toggle = page.getByRole('button', { name: 'Dark theme', exact: true })
    const icon = toggle.locator('svg')
    const sun = toggle.locator('g path')
    const box = await toggle.boundingBox()
    expect(box?.width).toBe(44)
    expect(box?.height).toBe(44)
    expect(await icon.evaluate(node => getComputedStyle(node).width)).toBe('16px')
    expect(await icon.evaluate(node => getComputedStyle(node).translate)).toBe('0px -0.5px')
    expect(await sun.evaluate(node => getComputedStyle(node).translate)).toBe('none')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(await icon.evaluate(node => getComputedStyle(node).translate)).toBe('0px -4.5px')
    expect(await sun.evaluate(node => getComputedStyle(node).translate)).toBe('0px 50%')
  })

  test('animates over 500ms with the Horizon curve when motion is allowed', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' })
    await page.goto('/signin')
    const toggle = page.getByRole('button', { name: 'Dark theme', exact: true })
    for (const target of [toggle.locator('svg'), toggle.locator('g path')]) {
      const style = await target.evaluate(node => { const s = getComputedStyle(node); return [s.transitionDuration, s.transitionTimingFunction] })
      expect(style).toEqual(['0.5s', 'cubic-bezier(0, 0, 0.15, 1)'])
    }
  })

  test('is named in Russian', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'kuuki_locale', value: 'ru', url: baseURL! }])
    await page.goto('/signin')
    const toggle = page.getByRole('button', { name: 'Тёмная тема', exact: true })
    await expect(toggle).toHaveAttribute('title', 'Тёмная тема')
  })
})
