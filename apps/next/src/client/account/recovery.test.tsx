// @vitest-environment jsdom
import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@kuuki/client/apiClient'
import { ResetPasswordForm } from './reset-password-form'

const post = vi.hoisted(() => vi.fn())
const identity = vi.hoisted(() => vi.fn(async (run: (token: symbol) => Promise<unknown>) => run(Symbol('identity'))))
vi.mock('@kuuki/client/apiClient', async importOriginal => ({ ...await importOriginal<typeof import('@kuuki/client/apiClient')>(), api: { post } }))
vi.mock('../activity', () => ({ withIdentityMutation: identity }))
beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  document.documentElement.lang = 'en'
  document.documentElement.dataset.locale = 'en'
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
})
afterEach(() => { post.mockReset(); identity.mockClear(); delete window.__kuukiResetToken; vi.unstubAllGlobals() })

it('validates one new password, associates a known email and returns confirmed completion to the card notice', async () => {
  const token = 'A'.repeat(43)
  window.__kuukiResetToken = token
  sessionStorage.setItem('kuuki_auth_email', 'known@example.test')
  post.mockResolvedValueOnce({ ok: true })
  render(<ResetPasswordForm locale="en" />)
  const password = await screen.findByLabelText('New password', { exact: true })
  expect(window.__kuukiResetToken).toBeUndefined()
  expect(password).toHaveAttribute('autocomplete', 'new-password')
  expect(password).toHaveAccessibleDescription('At least 8 characters')
  expect(screen.queryByLabelText('Confirm password')).toBeNull()
  expect(document.querySelector('input[type=hidden][autocomplete=username]')).toHaveValue('known@example.test')
  await userEvent.type(password, 'short')
  await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
  expect(password).toHaveAccessibleDescription('At least 8 characters Use 8 to 1024 characters.')
  expect(screen.getByRole('heading', { name: 'Choose a new password' })).toHaveFocus()
  expect(post).not.toHaveBeenCalled()
  await userEvent.clear(password)
  await userEvent.type(password, 'personal-password')
  await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Password saved. Sign in with it now.')
  expect(screen.queryByLabelText('New password', { exact: true })).toBeNull()
  expect(identity).toHaveBeenLastCalledWith(expect.any(Function), '/?notice=password-saved')
  expect(post).toHaveBeenCalledExactlyOnceWith('/api/auth/password-reset/complete', { password: 'personal-password' }, expect.objectContaining({ headers: { Authorization: `Bearer ${token}` } }))
})

it.each([
  [new ApiError(429, 'limited'), 'Too many attempts.'],
  [new TypeError('offline'), 'Could not save your password.'],
])('keeps the credential and link available for retryable reset failures: %s', async (error, message) => {
  window.__kuukiResetToken = 'A'.repeat(43)
  post.mockRejectedValueOnce(error).mockResolvedValueOnce({ ok: true })
  render(<ResetPasswordForm locale="en" />)
  await userEvent.type(await screen.findByLabelText('New password', { exact: true }), 'personal-password')
  await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(screen.getByLabelText('New password', { exact: true })).toHaveValue('personal-password')
  await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Password saved.')
})

it('keeps focus on the password field while saving and after a retryable failure', async () => {
  window.__kuukiResetToken = 'A'.repeat(43)
  let rejectRequest!: (reason: unknown) => void
  post.mockReturnValueOnce(new Promise((_, reject) => { rejectRequest = reject }))
  render(<ResetPasswordForm locale="en" />)
  const password = await screen.findByLabelText('New password', { exact: true })
  await userEvent.type(password, 'personal-password{Enter}')
  expect(post).toHaveBeenCalledOnce()
  expect(password).toHaveFocus()

  rejectRequest(new TypeError('offline'))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your password.')
  expect(password).toHaveFocus()
})

it('does not retire the credential or claim success for a malformed 2xx completion', async () => {
  window.__kuukiResetToken = 'A'.repeat(43)
  post.mockResolvedValueOnce({}).mockResolvedValueOnce({ ok: true })
  render(<ResetPasswordForm locale="en" />)
  await userEvent.type(await screen.findByLabelText('New password', { exact: true }), 'personal-password')
  await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your password.')
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByLabelText('New password', { exact: true })).toHaveValue('personal-password')
  await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Password saved.')
})

it('retires an expired/consumed reset link, focuses the expired heading and offers a new link', async () => {
  window.__kuukiResetToken = 'A'.repeat(43)
  post.mockRejectedValue(new ApiError(400, 'used', 'INVALID_RECOVERY'))
  const { unmount } = render(<ResetPasswordForm locale="ru" />)
  await userEvent.type(await screen.findByLabelText('Новый пароль', { exact: true }), 'personal-password')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить пароль' }))
  expect(await screen.findByRole('heading', { name: 'Срок действия ссылки истёк' })).toHaveFocus()
  expect(screen.queryByLabelText('Новый пароль', { exact: true })).toBeNull()
  expect(screen.getByRole('link', { name: 'Отправить новую ссылку' })).toHaveAttribute('href', '/forgot-password')
  unmount()
  render(<ResetPasswordForm locale="en" />)
  expect(await screen.findByRole('heading', { name: 'This link has expired' })).toHaveFocus()
  expect(screen.queryByRole('button', { name: 'Save password' })).toBeNull()
})

it.each(['', 'invalid-address'])('does not invent a username for a token-only visit with email hint %s', async address => {
  window.__kuukiResetToken = 'A'.repeat(43)
  if (address) sessionStorage.setItem('kuuki_auth_email', address)
  render(<ResetPasswordForm locale="en" />)
  expect(await screen.findByLabelText('New password', { exact: true })).toBeInTheDocument()
  expect(document.querySelector('input[autocomplete=username]')).toBeNull()
  expect(post).not.toHaveBeenCalled()
})

it('consumes the one-time bootstrap handoff while surviving React effect replay', async () => {
  window.__kuukiResetToken = 'A'.repeat(43)
  render(<StrictMode><ResetPasswordForm locale="en" /></StrictMode>)
  expect(await screen.findByLabelText('New password', { exact: true })).toBeInTheDocument()
  expect(window.__kuukiResetToken).toBeUndefined()
})

it('keeps the password and captured token through EN to RU to EN changes and localizes validation', async () => {
  const token = 'A'.repeat(43)
  window.__kuukiResetToken = token
  post.mockResolvedValueOnce({ ok: true })
  render(<ResetPasswordForm locale="en" />)
  await userEvent.type(await screen.findByLabelText('New password', { exact: true }), 'short')
  await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'ru')
  const password = screen.getByLabelText('Новый пароль', { exact: true })
  expect(password).toHaveValue('short')
  expect(password).toHaveAccessibleDescription('Не менее 8 символов От 8 до 1024 символов.')
  expect(document.cookie).toContain('kuuki_locale=ru')
  expect(localStorage.getItem('kuuki-language')).toBe('ru')
  expect(document.documentElement).toHaveAttribute('data-locale', 'ru')
  await userEvent.clear(password)
  await userEvent.type(password, 'personal-password')
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Язык' }), 'en')
  expect(document.documentElement).toHaveAttribute('data-locale', 'en')
  expect(screen.getByLabelText('New password', { exact: true })).toHaveValue('personal-password')
  await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Password saved. Sign in with it now.')
  expect(post).toHaveBeenCalledExactlyOnceWith('/api/auth/password-reset/complete', { password: 'personal-password' }, expect.objectContaining({ headers: { Authorization: `Bearer ${token}` } }))
  expect(sessionStorage.length).toBe(0)
  expect(localStorage.length).toBe(1)
  expect(window.__kuukiResetToken).toBeUndefined()
})
