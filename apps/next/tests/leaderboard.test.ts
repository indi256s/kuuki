import { test, expect } from '@playwright/test'

test('a profile name stays clickable above its aircraft peek on a wide leaderboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/leaderboard')
  const profile = page.getByRole('link', { name: 'Olga', exact: true })
  await expect(profile).toBeVisible()
  const name = await profile.boundingBox()
  expect(name).not.toBeNull()
  await page.mouse.click(name!.x + 8, name!.y + name!.height - 2)
  await expect(page).toHaveURL(/\/fly\/fixture-olga$/)
})
