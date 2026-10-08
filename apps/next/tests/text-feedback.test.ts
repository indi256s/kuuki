import { test, expect } from '@playwright/test'
import { signIn } from './helpers'

for (const locale of ['en', 'ru'] as const) for (const reduced of [false, true]) {
  test(`text feedback keeps current names, focus and width (${locale}, reduced=${reduced})`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' })
    await page.context().addCookies([{ name: 'kuuki_locale', value: locale, url: baseURL! }])
    await page.addInitScript(() => {
      const records: Array<{ frames: unknown; duration: unknown }> = []
      Object.assign(window, { feedbackAnimations: records, failCopy: false })
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {
        if ((window as unknown as { failCopy: boolean }).failCopy) throw new Error('Clipboard unavailable')
      } } })
      const animate = Element.prototype.animate
      Element.prototype.animate = function (frames, options) {
        if (this.closest('.ui-button')) records.push({ frames, duration: typeof options === 'object' ? options.duration : options })
        return animate.call(this, frames, options)
      }
    })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await signIn(page, baseURL!)
    await page.goto('/import')
    const ru = locale === 'ru'
    await page.getByRole('button', { name: ru ? 'Как выгрузить перелёты из почты' : 'How to export flights from your email' }).click()
    const copyLabel = ru ? 'Скопировать запрос' : 'Copy the prompt'
    const copiedLabel = ru ? 'Скопировано' : 'Copied'
    const copy = page.getByRole('button', { name: copyLabel, exact: true })
    await expect(copy).toBeVisible()
    const before = await copy.boundingBox()
    const label = await copy.locator(':scope > span:last-child > span').elementHandle()
    await page.evaluate(() => { (window as unknown as { feedbackAnimations: unknown[] }).feedbackAnimations.length = 0 })
    await copy.click()
    const copied = page.getByRole('button', { name: copiedLabel, exact: true })
    await expect(copied).toBeFocused()
    const after = await copied.boundingBox()
    expect(after!.width).toBeCloseTo(before!.width, 1)
    expect(after!.x + after!.width).toBeLessThanOrEqual(320)
    if (label) expect(await label.evaluate(node => node.isConnected)).toBe(true)
    const motion = await page.evaluate(() => (window as unknown as { feedbackAnimations: Array<{ frames: unknown; duration: unknown }> }).feedbackAnimations)
    if (reduced) expect(motion).toHaveLength(0)
    else {
      expect(motion.length).toBeGreaterThan(0)
      expect(motion.map(record => record.duration)).toContain(200)
      expect(JSON.stringify(motion)).not.toMatch(/scale\(0\./)
    }
    // Rapid repeat, then clipboard failure, never presents success for the failed attempt.
    await copied.click()
    await page.evaluate(() => { (window as unknown as { failCopy: boolean }).failCopy = true })
    await copied.click()
    const fallback = page.getByRole('textbox', { name: ru ? 'Текст запроса' : 'Prompt text', exact: true })
    await expect(fallback).toBeFocused()
    expect(await fallback.evaluate((node: HTMLTextAreaElement) => node.readOnly && node.selectionStart === 0 && node.selectionEnd === node.value.length)).toBe(true)
    await expect(page.getByRole('status').filter({ hasText: ru ? 'Не удалось скопировать' : 'Could not copy' })).toBeVisible()
    await page.evaluate(() => { (window as unknown as { failCopy: boolean }).failCopy = false; (window as unknown as { feedbackAnimations: unknown[] }).feedbackAnimations.length = 0 })
    await page.getByRole('button', { name: copyLabel, exact: true }).press('Enter')
    await expect(copied).toBeFocused()
    expect(await page.evaluate(() => (window as unknown as { feedbackAnimations: unknown[] }).feedbackAnimations.length)).toBe(0)
    await expect(page.getByRole('button', { name: copyLabel, exact: true })).toBeVisible({ timeout: 6000 })
    // Enlarge text without shrinking it to hide wrapping/overflow defects.
    await page.getByRole('button', { name: copyLabel, exact: true }).evaluate(button => { button.style.fontSize = '30px'; button.style.lineHeight = '40px' })
    const fits = await page.getByRole('button', { name: copyLabel, exact: true }).evaluate(button => {
      const box = button.getBoundingClientRect(), label = button.querySelector('span:last-child')!.getBoundingClientRect()
      return { fits: label.left >= box.left && label.right <= box.right && box.right <= innerWidth, box: box.toJSON(), label: label.toJSON() }
    })
    expect(fits).toMatchObject({ fits: true })
    await page.goto('/settings')
    await page.getByLabel(ru ? 'Имя' : 'Display name', { exact: true }).fill('Text feedback check')
    const saveLabel = ru ? 'Сохранить' : 'Save changes'
    const savingLabel = ru ? 'Сохраняем…' : 'Saving…'
    const save = page.getByRole('button', { name: saveLabel, exact: true })
    const idleWidth = (await save.boundingBox())!.width
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    let requests = 0
    await page.route('**/api/profiles/me', async route => {
      if (route.request().method() !== 'PATCH') return route.continue()
      requests++
      await held
      await route.fulfill({ status: 503, json: { error: 'Temporary failure', code: 'INTERNAL' } })
    })
    await save.click()
    const saving = page.getByRole('button', { name: savingLabel, exact: true })
    await expect(saving).toHaveAttribute('aria-busy', 'true')
    await expect(saving).toBeFocused()
    expect((await saving.boundingBox())!.width).toBeCloseTo(idleWidth, 1)
    await saving.click({ force: true })
    expect(requests).toBe(1)
    release()
    await expect(save).toBeFocused()
    await expect(page.locator('.settings-editor').getByRole('alert')).toContainText(ru ? 'Не удалось сохранить' : 'Could not save')
    // Implicit form submission from the input also obeys instant keyboard feedback.
    await page.unroute('**/api/profiles/me')
    const retryHeld = new Promise<void>(resolve => { release = resolve })
    await page.route('**/api/profiles/me', async route => {
      if (route.request().method() !== 'PATCH') return route.continue()
      await retryHeld
      await route.fulfill({ status: 503, json: { error: 'Temporary failure', code: 'INTERNAL' } })
    })
    await page.evaluate(() => { (window as unknown as { feedbackAnimations: unknown[] }).feedbackAnimations.length = 0 })
    await page.getByLabel(ru ? 'Имя' : 'Display name', { exact: true }).press('Enter')
    await expect(saving).toHaveAttribute('aria-busy', 'true')
    expect(await page.evaluate(() => (window as unknown as { feedbackAnimations: unknown[] }).feedbackAnimations.length)).toBe(0)
    release(); await expect(save).toBeVisible()
    expect(errors).toEqual([])
  })
}
