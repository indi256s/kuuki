import { test, expect, type Page } from '@playwright/test'
import { recordRouteTransitions, resetRouteTransitions, routeTransitions, signIn } from './helpers'

// DESIGN.md "Motion": the import hero and the leaderboard drill animate (the import hero is covered in import.test.ts); everything else swaps instantly.

const settled = (page: Page) => expect.poll(() => page.evaluate(() => document.documentElement.dataset.routeTransition ?? null)).toBeNull()
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name: name === 'Overview' ? /^Hi(?:,| ·|$)/ : name, exact: name !== 'Overview' })

test.describe('leaderboard → public profile', () => {
  test('drills into the profile and Back reverses it', async ({ page }) => {
    await recordRouteTransitions(page)
    await page.goto('/leaderboard')
    await expect(heading(page, 'Leaderboard')).toBeVisible()
    await resetRouteTransitions(page)

    await page.getByRole('link', { name: 'Ranked', exact: true }).click()
    await expect(page).toHaveURL(/\/fly\/fixture-ranked$/)
    await expect(heading(page, 'Ranked')).toBeFocused()
    await settled(page)
    expect(await routeTransitions(page)).toMatchObject({ markers: ['drill'], boundaries: 2, heroCopies: 0 })

    await page.goBack()
    await expect(page).toHaveURL(/\/leaderboard$/)
    await expect(heading(page, 'Leaderboard')).toBeFocused()
    await settled(page)
    expect((await routeTransitions(page)).markers).toEqual(['drill', 'drill'])
    await expect(page.locator('[data-ssgoi-transition]')).toHaveCount(1)

    // Forward redoes the drill.
    await page.goForward()
    await expect(heading(page, 'Ranked')).toBeFocused()
    await settled(page)
    expect((await routeTransitions(page)).markers).toEqual(['drill', 'drill', 'drill'])
  })

  test('a link from the profile back to the leaderboard stays instant', async ({ page }) => {
    await recordRouteTransitions(page)
    await page.goto('/leaderboard')
    await page.getByRole('link', { name: 'Ranked', exact: true }).click()
    await expect(heading(page, 'Ranked')).toBeFocused()
    await settled(page)
    await resetRouteTransitions(page)

    await page.getByRole('link', { name: 'View leaderboard', exact: true }).click()
    await expect(page).toHaveURL(/\/leaderboard$/)
    await expect(heading(page, 'Leaderboard')).toBeFocused()

    // Back onto the profile and Forward over that link are not the drill either.
    await page.goBack()
    await expect(heading(page, 'Ranked')).toBeFocused()
    await page.goForward()
    await expect(heading(page, 'Leaderboard')).toBeFocused()
    expect(await routeTransitions(page)).toMatchObject({ markers: [], boundaries: 1 })
  })

  test('opens the profile instantly under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await recordRouteTransitions(page)
    await page.goto('/leaderboard')
    await page.getByRole('link', { name: 'Ranked', exact: true }).click()
    await expect(heading(page, 'Ranked')).toBeFocused()
    await expect(page.locator('[data-ssgoi-transition]')).toHaveCount(1)
    expect((await routeTransitions(page)).markers).toEqual([])
  })

  test('category tabs stay instant', async ({ page }) => {
    await recordRouteTransitions(page)
    await page.goto('/leaderboard')
    await resetRouteTransitions(page)
    await page.getByRole('link', { name: 'Distance', exact: true }).click()
    await expect(page).toHaveURL(/category=distance/)
    await expect(page.getByRole('link', { name: 'Distance', exact: true })).toHaveAttribute('aria-current', 'page')
    expect(await routeTransitions(page)).toMatchObject({ markers: [], boundaries: 1 })
  })
})

test('a reload keeps the scroll position the browser restores', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await page.setViewportSize({ width: 390, height: 500 })
  await page.goto('/journal')
  await expect(heading(page, 'Journal')).toBeVisible()
  await page.evaluate(() => scrollTo(0, 300))
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(300)
  await page.reload()
  await expect(heading(page, 'Journal')).toBeVisible()
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(300)
  // ssgoi resets an entering page within its first frames; it must leave the loaded page alone.
  await page.evaluate(() => new Promise(resolve => { let frames = 0; const tick = () => (++frames >= 20 ? resolve(null) : requestAnimationFrame(tick)); requestAnimationFrame(tick) }))
  expect(await page.evaluate(() => scrollY)).toBe(300)
})

test('member tabs, header nav, Passport views, Journal filters, the flight sheet and Add stay instant', async ({ page, baseURL }) => {
  await signIn(page, baseURL!)
  await recordRouteTransitions(page)
  await page.goto('/overview')
  await expect(heading(page, 'Overview')).toBeVisible()
  await resetRouteTransitions(page)
  const tabs = page.getByRole('navigation', { name: 'Tabs' })

  for (const title of ['Journal', 'Passport', 'Overview', 'Passport']) {
    await tabs.getByRole('link', { name: title }).click()
    await expect(heading(page, title)).toBeFocused()
  }
  await page.getByRole('radio', { name: 'Map', exact: true }).click()
  await expect(page).toHaveURL(/view=map/)
  await expect(heading(page, 'Passport')).toBeFocused()

  await tabs.getByRole('link', { name: 'Journal' }).click()
  await page.getByRole('searchbox').fill('NO-SUCH-FLIGHT')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.waitForURL(url => url.searchParams.get('q') === 'NO-SUCH-FLIGHT')
  await page.goBack()
  await page.locator('[data-flight-row]').click()
  await page.waitForURL(url => url.searchParams.has('flight'))
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  await tabs.getByRole('button', { name: 'Add' }).click()
  await page.getByRole('link', { name: 'Enter manually' }).click()
  await expect(page).toHaveURL(/\/add$/)
  await expect(page.getByRole('dialog', { name: 'Add a flight' })).toBeVisible()
  await page.goBack()
  await expect(heading(page, 'Journal')).toBeVisible()

  // The header nav crosses into the public layout and back.
  await page.setViewportSize({ width: 1440, height: 900 })
  const primary = page.getByRole('navigation', { name: 'Primary' })
  for (const title of ['Leaderboard', 'Overview']) {
    await primary.getByRole('link', { name: title }).click()
    await expect(heading(page, title)).toBeFocused()
  }
  expect(await routeTransitions(page)).toMatchObject({ markers: [], boundaries: 1, heroCopies: 0 })
})
