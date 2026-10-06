// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthForm } from './auth-form'
import { ApiError } from '@kuuki/client/apiClient'

const post = vi.hoisted(() => vi.fn())
const identity = vi.hoisted(() => vi.fn(async (run: (token: symbol) => Promise<unknown>) => run(Symbol('identity'))))
vi.mock('@kuuki/client/apiClient', async importOriginal => ({ ...await importOriginal<typeof import('@kuuki/client/apiClient')>(), api: { post } }))
vi.mock('../activity', () => ({ withIdentityMutation: identity }))
afterEach(() => { post.mockReset(); identity.mockClear() })

describe('auth entry forms', () => {
  it('shows signup rules and reveal before failure, associates mismatches, then submits matching passwords', async () => {
    render(<AuthForm mode="signup" locale="en" />)
    const password = screen.getByLabelText('Password', { exact: true })
    expect(password).toHaveAttribute('autocomplete', 'new-password')
    expect(password).toHaveAccessibleDescription('Use 8 to 1024 characters.')
    await userEvent.click(screen.getByRole('button', { name: 'Show: Password' }))
    expect(password).toHaveAttribute('type', 'text')
    await userEvent.type(screen.getByLabelText('Email', { exact: true }), 'person@example.test')
    await userEvent.type(password, 'personal-password')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'different-password')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toHaveAccessibleDescription('Passwords do not match.')
    expect(post).not.toHaveBeenCalled()
    await userEvent.clear(screen.getByLabelText('Confirm password'))
    await userEvent.type(screen.getByLabelText('Confirm password'), 'personal-password')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/auth/sign-up/email', { email: 'person@example.test', password: 'personal-password', displayName: '' }, expect.objectContaining({ identityToken: expect.any(Symbol) })))
    expect(identity).toHaveBeenLastCalledWith(expect.any(Function), '/onboarding')
  })

  it.each([
    [new ApiError(401, 'bad', 'INVALID_CREDENTIALS'), 'Email or password is incorrect.'],
    [new ApiError(429, 'limited'), 'Too many attempts. Please wait and try again.'],
    [new TypeError('offline'), 'We could not complete this request. Please try again.'],
  ])('keeps sign-in values and a usable retry after %s', async (error, message) => {
    post.mockRejectedValueOnce(error).mockResolvedValueOnce({})
    render(<AuthForm mode="signin" locale="en" initialEmail="person@example.test" />)
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('autocomplete', 'current-password')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'personal-password')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText('Email', { exact: true })).toHaveValue('person@example.test')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('link', { name: /Continue to activation/ })).toHaveAttribute('href', '/activation-request')
  })

  it('localizes a created-but-not-signed-in signup and preserves email in its sign-in link', async () => {
    post.mockRejectedValue(new ApiError(409, 'created', 'SIGN_IN_REQUIRED'))
    render(<AuthForm mode="signup" locale="ru" initialEmail="person+test@example.test" />)
    await userEvent.type(screen.getByLabelText('Пароль', { exact: true }), 'personal-password')
    await userEvent.type(screen.getByLabelText('Повторите пароль'), 'personal-password')
    await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Аккаунт создан')
    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/signin?email=person%2Btest%40example.test')
  })
})
