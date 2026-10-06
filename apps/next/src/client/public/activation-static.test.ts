// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { compileActivationAsset } from '../../../../../scripts/activation-asset.mjs'

const asset = resolve(process.cwd(), 'activation')
const html = readFileSync(resolve(asset, 'activate.html'), 'utf8')
const script = readFileSync(resolve(asset, 'activate.js'), 'utf8')
const request = vi.fn()
function boot(token = true, dark = false) {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  document.head.innerHTML = parsed.head.innerHTML
  document.body.innerHTML = parsed.body.innerHTML
  history.replaceState(null, '', `/activate${token ? `#token=${'A'.repeat(43)}` : ''}`)
  vi.stubGlobal('fetch', request)
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: dark, addEventListener: vi.fn() })))
  window.eval(script)
  document.dispatchEvent(new Event('DOMContentLoaded'))
}
const password = () => screen.getByLabelText('New password')
async function submit(value = 'personal-password') {
  fireEvent.change(password(), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Save password' }))
  await waitFor(() => expect(request).toHaveBeenCalled())
}
afterEach(() => {
  request.mockReset(); vi.unstubAllGlobals(); document.head.innerHTML = ''; document.body.innerHTML = ''
  for (const name of ['kuuki_locale', 'kuuki_theme', 'kuuki_accent']) document.cookie = `${name}=; Max-Age=0; Path=/`
})

it('builds isolated HTML with the canonical dark/accent tokens, one same-origin script and no blocked stylesheet or font requests', () => {
  const compiled = compileActivationAsset(html, readFileSync(resolve(process.cwd(), 'src/app/styles.css'), 'utf8'))
  const document = new DOMParser().parseFromString(compiled, 'text/html')
  const theme = document.getElementById('activation-tokens')!.textContent!
  expect(theme).toContain(':root[data-theme=dark]')
  expect(theme).toContain(':root[data-theme=dark][data-accent=asagi]')
  expect(theme).toContain('--background:#292827')
  expect(document.querySelector('link')).toBeNull()
  expect(compiled).not.toContain('@font-face')
  expect(compiled).not.toMatch(/\burl\((?!#)/)
  expect([...document.querySelectorAll('script')].map(element => element.getAttribute('src'))).toEqual(['/activate.js'])
  expect(() => compileActivationAsset('<html></html>', 'body{}')).toThrow()
})

it('scrubs the token before setup and offers one new-password field with a hidden username field and the text wordmark', () => {
  boot()
  expect(location.hash).toBe('')
  expect(screen.getByRole('img', { name: 'Kuuki' })).toHaveTextContent('Kuuki')
  expect(screen.getByRole('heading', { level: 1, name: 'Welcome back to Kuuki' })).toBeInTheDocument()
  expect(password()).toHaveAttribute('autocomplete', 'new-password')
  expect(password()).toHaveAccessibleDescription('At least 8 characters')
  expect(document.querySelectorAll('input[type=password]')).toHaveLength(1)
  const username = document.querySelector('input[autocomplete=username]') as HTMLInputElement
  expect(username).not.toBeNull()
  expect(username).not.toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
  expect(password()).toHaveAttribute('type', 'text')
  expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute('aria-pressed', 'true')
})

it('rejects a short password inline without a request, then saves with the bearer token and no credentials', async () => {
  boot()
  fireEvent.change(password(), { target: { value: 'short' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save password' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Use at least 8 characters.')
  expect(password()).toHaveAttribute('aria-invalid', 'true')
  expect(request).not.toHaveBeenCalled()
  let finish!: (response: Response) => void
  request.mockReturnValue(new Promise<Response>(resolve => { finish = resolve }))
  await submit()
  expect(screen.queryByRole('alert')).toBeNull()
  const busy = screen.getByRole('button', { name: 'Saving…' })
  expect(busy).toHaveAttribute('aria-disabled', 'true')
  fireEvent.click(busy)
  expect(request).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledWith('/api/auth/activation/complete', expect.objectContaining({
    method: 'POST', credentials: 'omit', body: JSON.stringify({ password: 'personal-password' }),
    headers: expect.objectContaining({ Authorization: `Bearer ${'A'.repeat(43)}` }),
  }))
  finish(new Response('{"ok":true}', { status: 200 }))
  await waitFor(() => expect(password()).toHaveValue(''))
})

it('an expired or used link retires the form, moves focus to the expired heading and keeps the main-origin links', async () => {
  boot()
  request.mockResolvedValue(new Response(JSON.stringify({ code: 'INVALID_ACTIVATION' }), { status: 400 }))
  await submit()
  const heading = await screen.findByRole('heading', { level: 1, name: 'This link has expired' })
  expect(heading).toHaveFocus()
  expect(screen.getByText('Links work once, for 30 minutes.')).toBeVisible()
  expect(password()).not.toBeVisible()
  expect(screen.getByRole('link', { name: 'Send a new link' })).toHaveAttribute('data-primary-path', '/activation-request')
  expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('data-primary-path', '/signin')
})

it.each([
  [429, 'RATE_LIMITED', 'Too many attempts. Please wait and try again.'],
  [503, 'UNAVAILABLE', 'Could not save your password. Please try again.'],
])('status %s keeps the form for a retry and shows an inline error', async (status, code, message) => {
  boot()
  request.mockResolvedValue(new Response(JSON.stringify({ code }), { status }))
  await submit()
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(screen.getByRole('button', { name: 'Save password' })).toHaveAttribute('aria-disabled', 'false')
  expect(password()).toHaveValue('personal-password')
})

it('opens without a token on the expired state, and switching language keeps the state without a reload', () => {
  boot(false)
  expect(screen.getByRole('heading', { level: 1, name: 'This link has expired' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Save password' })).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'ru' } })
  expect(document.documentElement.lang).toBe('ru')
  expect(screen.getByRole('heading', { level: 1, name: 'Срок действия ссылки истёк' })).toBeInTheDocument()
  expect(document.cookie).toContain('kuuki_locale=ru')
  expect(document.cookie).not.toContain('token')
})

it('follows the device theme until the Horizon toggle sets the opposite theme, and maps removed accents to terracotta', () => {
  document.cookie = 'kuuki_accent=kincha; Path=/'
  boot(true, true)
  const root = document.documentElement
  expect(root.dataset.theme).toBe('dark')
  expect(root.dataset.accent).toBe('terracotta')
  const toggle = screen.getByRole('button', { name: 'Dark theme' })
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(toggle)
  expect(root.dataset.theme).toBe('light')
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(document.cookie).toContain('kuuki_theme=light')
})
