import { expect, test } from '@playwright/test'

test.describe('Horizon theme toggle on the card', () => {
  test('follows a light device, a click sets dark explicitly and the choice survives reload', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/signin')
    const toggle = page.getByRole('button', { name: 'Dark theme', exact: true })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(toggle).toHaveAttribute('title', 'Dark theme')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    expect(
      (await page.context().cookies()).find((cookie) => cookie.name === 'kuuki_theme')?.value,
    ).toBe('system')

    await toggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveAccessibleName('Dark theme')
    expect(
      (await page.context().cookies()).find((cookie) => cookie.name === 'kuuki_theme')?.value,
    ).toBe('dark')
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
})
