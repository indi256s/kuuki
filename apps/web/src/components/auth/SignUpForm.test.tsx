import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Replace the real apiClient with the shared mock (the form drives it through useAuth).
vi.mock('@/lib/apiClient', async () => await import('@/test/mocks/apiClient'))
import { resetApiMock } from '@/test/mocks/apiClient'

import { SignUpForm } from './SignUpForm'

// Mock i18n - return predictable text
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'auth.email': 'Email',
        'auth.password': 'Password',
        'auth.confirmPassword': 'Confirm Password',
        'auth.createAccount': 'Create an account',
        'auth.signIn': 'Sign in',
        'auth.haveAccount': 'Already have an account?',
        'common.loading': 'Loading...',
        'errors.generic': 'Something went wrong',
      }
      return translations[key] || fallback || key
    },
  }),
}))

// Mock useAuth hook
const mockSignUp = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
    isLoading: false,
  }),
}))

describe('SignUpForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetApiMock()
    mockSignUp.mockReset()
  })

  it('renders all form fields', () => {
    render(<SignUpForm />)

    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create an account/i })).toBeInTheDocument()
  })

  it('does not render an invite code field', () => {
    render(<SignUpForm />)

    expect(screen.queryByLabelText(/invite code/i)).not.toBeInTheDocument()
  })

  it('validates password match', async () => {
    const user = userEvent.setup()

    render(<SignUpForm />)

    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'different123')
    await user.click(screen.getByRole('button', { name: /create an account/i }))

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('validates password length', async () => {
    const user = userEvent.setup()

    render(<SignUpForm />)

    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'short')
    await user.type(screen.getByLabelText(/confirm password/i), 'short')
    await user.click(screen.getByRole('button', { name: /create an account/i }))

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    })
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('calls signUp with email and password on valid submission', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValue({ success: true })

    const onSuccess = vi.fn()
    render(<SignUpForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create an account/i }))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'password123')
    })
  })

  it('calls onSuccess callback after successful signup', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValue({ success: true })

    const onSuccess = vi.fn()
    render(<SignUpForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create an account/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('displays error message on failed signup', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValue({ success: false, error: 'Email already in use' })

    render(<SignUpForm />)

    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create an account/i }))

    await waitFor(() => {
      expect(screen.getByText(/email already in use/i)).toBeInTheDocument()
    })
  })
})
