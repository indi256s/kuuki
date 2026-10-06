// @vitest-environment jsdom
import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../web/src/lib/apiClient'
import { ResetPasswordForm } from './reset-password-form'
import { EmailLinkForm } from '../public/email-link-form'

const post = vi.hoisted(() => vi.fn())
const identity = vi.hoisted(() => vi.fn(async (run: (token: symbol) => Promise<unknown>) => run(Symbol('identity'))))
vi.mock('../../../../web/src/lib/apiClient', async importOriginal => ({ ...await importOriginal<typeof import('../../../../web/src/lib/apiClient')>(), api: { post } }))
vi.mock('../activity', () => ({ withIdentityMutation: identity }))
afterEach(() => { post.mockReset(); identity.mockClear(); delete window.__kuukiResetToken })

it.each(['activation', 'recovery'] as const)('keeps %s requests generic, validates email and separates rate limits from network failures', async purpose => {
  post.mockRejectedValueOnce(new ApiError(429, 'limited')).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce({ ok: true })
  render(<EmailLinkForm locale="en" purpose={purpose} />)
  const action = purpose === 'activation' ? 'Send activation link' : 'Send reset link'
  await userEvent.click(screen.getByRole('button', { name: action }))
  expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email.')
  expect(post).not.toHaveBeenCalled()
  await userEvent.type(screen.getByLabelText('Email'), 'unknown@example.test')
  await userEvent.click(screen.getByRole('button', { name: action }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts.')
  await userEvent.click(screen.getByRole('button', { name: action }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not submit the request.')
  await userEvent.click(screen.getByRole('button', { name: action }))
  expect(await screen.findByRole('status')).toHaveTextContent(purpose === 'activation' ? 'If activation is needed for this address' : 'If recovery is available for this address')
  expect(post).toHaveBeenLastCalledWith(purpose === 'activation' ? '/api/auth/activation/request' : '/api/auth/password-reset/request', { email: 'unknown@example.test' })
})

it('validates matching reset passwords and returns successful completion to sign-in', async () => {
  const token = 'A'.repeat(43)
  window.__kuukiResetToken = token
  post.mockResolvedValueOnce({ ok: true })
  render(<ResetPasswordForm locale="en" />)
  const password = await screen.findByLabelText('New password', { exact: true })
  expect(window.__kuukiResetToken).toBeUndefined()
  expect(password).toHaveAccessibleDescription('Use 8 to 1024 characters.')
  await userEvent.type(password, 'personal-password')
  await userEvent.type(screen.getByLabelText('Confirm password'), 'different-password')
  await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
  expect(screen.getByLabelText('Confirm password')).toHaveAccessibleDescription('Passwords do not match.')
  expect(post).not.toHaveBeenCalled()
  await userEvent.clear(screen.getByLabelText('Confirm password'))
  await userEvent.type(screen.getByLabelText('Confirm password'), 'personal-password')
  await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Password updated.')
  expect(identity).toHaveBeenLastCalledWith(expect.any(Function), '/password-updated')
  expect(post).toHaveBeenLastCalledWith('/api/auth/password-reset/complete', { password: 'personal-password' }, expect.objectContaining({ headers: { Authorization: `Bearer ${token}` } }))
})

it.each([
  [new ApiError(429, 'limited'), 'Too many attempts.'],
  [new TypeError('offline'), 'Could not save your password.'],
])('does not mislabel a retryable reset failure as an expired link: %s', async (error, message) => {
  window.__kuukiResetToken = 'A'.repeat(43)
  post.mockRejectedValueOnce(error).mockResolvedValueOnce({ ok: true })
  render(<ResetPasswordForm locale="en" />)
  await userEvent.type(await screen.findByLabelText('New password', { exact: true }), 'personal-password')
  await userEvent.type(screen.getByLabelText('Confirm password'), 'personal-password')
  await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(screen.getByLabelText('New password', { exact: true })).toHaveValue('personal-password')
  await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Password updated.')
})

it('retires an expired/consumed reset link and offers resend, then rejects a reload without the in-memory token', async () => {
  window.__kuukiResetToken = 'A'.repeat(43)
  post.mockRejectedValue(new ApiError(400, 'used', 'INVALID_RECOVERY'))
  const { unmount } = render(<ResetPasswordForm locale="ru" />)
  await userEvent.type(await screen.findByLabelText('Новый пароль', { exact: true }), 'personal-password')
  await userEvent.type(screen.getByLabelText('Повторите пароль'), 'personal-password')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить пароль' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('уже использована')
  expect(screen.queryByLabelText('Новый пароль', { exact: true })).toBeNull()
  expect(screen.getByRole('link', { name: 'Запросить новую ссылку' })).toHaveAttribute('href', '/forgot-password')
  unmount()
  render(<ResetPasswordForm locale="en" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('invalid or expired')
  expect(screen.queryByRole('button', { name: 'Save password' })).toBeNull()
})

it('consumes the one-time bootstrap handoff while surviving React effect replay', async () => {
  window.__kuukiResetToken = 'A'.repeat(43)
  render(<StrictMode><ResetPasswordForm locale="en" /></StrictMode>)
  expect(await screen.findByLabelText('New password', { exact: true })).toBeInTheDocument()
  expect(window.__kuukiResetToken).toBeUndefined()
})
