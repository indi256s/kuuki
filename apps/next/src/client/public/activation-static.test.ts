// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { compileActivationAsset } from '../../../../../scripts/activation-asset.mjs'

const asset = resolve(process.cwd(), '../web/public')
const html = readFileSync(resolve(asset, 'activate.html'), 'utf8')
const script = readFileSync(resolve(asset, 'activate.js'), 'utf8')
const request = vi.fn()
function boot(token = true) {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  document.head.innerHTML = parsed.head.innerHTML
  document.body.innerHTML = parsed.body.innerHTML
  history.replaceState(null, '', `/activate${token ? `#token=${'A'.repeat(43)}` : ''}`)
  vi.stubGlobal('fetch', request)
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn() })))
  window.eval(script)
  document.dispatchEvent(new Event('DOMContentLoaded'))
}
async function submit() {
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'personal-password' } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'personal-password' } })
  fireEvent.submit(document.getElementById('activation-form')!)
  await waitFor(() => expect(request).toHaveBeenCalled())
}
afterEach(() => { request.mockReset(); vi.unstubAllGlobals(); document.head.innerHTML = ''; document.body.innerHTML = ''; document.cookie = 'kuuki_locale=; Max-Age=0; Path=/' })

it('builds isolated HTML with the canonical dark/accent tokens and no added blocked stylesheet or font requests', () => {
  const compiled = compileActivationAsset(html, readFileSync(resolve(process.cwd(), 'src/app/styles.css'), 'utf8'))
  const document = new DOMParser().parseFromString(compiled, 'text/html')
  const theme = document.getElementById('activation-tokens')!.textContent!
  expect(theme).toContain(':root[data-theme=dark]')
  expect(theme).toContain(':root[data-theme=dark][data-accent=ai]')
  expect(theme).toContain('--background:#292827')
  expect(document.querySelector('link[rel=stylesheet],link[rel=preload]')).toBeNull()
  expect(theme).not.toContain('@font-face')
  expect(document.querySelector('script')!.getAttribute('src')).toBe('/activate.js')
  expect(() => compileActivationAsset('<html></html>', 'body{}')).toThrow()
})

it('scrubs before interaction, validates and reveals passwords, then finishes without retaining the token and prefills only user-entered email', async () => {
  boot()
  expect(location.hash).toBe('')
  expect(screen.getByLabelText('Password', { exact: true })).toHaveAccessibleDescription(/Use 8 to 1024 characters\./)
  fireEvent.click(screen.getByRole('button', { name: 'Show: Password' }))
  expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'text')
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'personal-password' } })
  fireEvent.submit(document.getElementById('activation-form')!)
  expect(screen.getByLabelText('Confirm password')).toHaveAccessibleDescription('Passwords do not match.')
  expect(request).not.toHaveBeenCalled()
  request.mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
  await submit()
  expect(await screen.findByRole('status')).toHaveTextContent('Your account is active.')
  expect(request).toHaveBeenCalledWith('/api/auth/activation/complete', expect.objectContaining({ credentials: 'omit', headers: expect.objectContaining({ Authorization: `Bearer ${'A'.repeat(43)}` }) }))
  expect(document.getElementById('activation-form')).toHaveAttribute('hidden')
  expect(screen.getByLabelText(/Email for sign-in/)).toHaveValue('')
  fireEvent.input(screen.getByLabelText(/Email for sign-in/), { target: { value: 'person+test@example.test' } })
  expect(new URL(screen.getByRole('link', { name: 'Back to sign in' }).getAttribute('href')!, location.href).searchParams.get('email')).toBe('person+test@example.test')
  fireEvent.submit(document.getElementById('activation-form')!)
  expect(request).toHaveBeenCalledTimes(1)
})

it.each([
  [400, 'INVALID_ACTIVATION', 'invalid or expired', true],
  [429, 'RATE_LIMITED', 'Too many attempts.', false],
  [503, 'UNAVAILABLE', 'Could not confirm activation.', false],
])('activation status %s keeps expiry/resend distinct from retryable rate/network failures', async (status, code, message, retired) => {
  boot()
  request.mockResolvedValue(new Response(JSON.stringify({ code }), { status }))
  await submit()
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(document.getElementById('activation-form')!.hidden).toBe(retired)
  expect(screen.getByRole('link', { name: 'Request a new activation link' })).toBeInTheDocument()
})

it('a reload after erasure requires resend, and language changes preserve the live form without a reload', () => {
  boot(false)
  expect(screen.getByRole('status')).toHaveTextContent('invalid or expired')
  expect(screen.queryByRole('button', { name: 'Activate account' })).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'ru' } })
  expect(screen.getByRole('heading', { name: 'Активировать аккаунт' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('уже использована')
  expect(document.cookie).not.toContain('token')
})
