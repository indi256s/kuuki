import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignInForm } from './SignInForm'

// Mock i18n - return predictable text
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.signIn': 'Sign in',
        'auth.signingIn': 'Signing in...',
        'auth.email': 'Email',
        'auth.password': 'Password',
        'auth.newUser': 'New to Kuuki?',
        'auth.createAccount': 'Create an account',
        'errors.generic': 'Something went wrong',
      }
      return translations[key] || key
    },
  }),
}))

// Mock useAuth hook
const mockSignIn = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    isLoading: false,
  }),
}))

describe('SignInForm', () => {
  beforeEach(() => {
    mockSignIn.mockReset()
  })

  it('renders email and password fields', () => {
    render(<SignInForm />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('calls signIn with email and password on submit', async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValue({ success: true })

    render(<SignInForm />)

    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123')
    })
  })

  it('calls onSuccess callback after successful signin', async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValue({ success: true })

    const onSuccess = vi.fn()
    render(<SignInForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('displays error message on failed signin', async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValue({ success: false, error: 'Invalid credentials' })

    render(<SignInForm />)

    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })

  it('shows sign up link when onSignUpClick is provided', () => {
    const onSignUpClick = vi.fn()
    render(<SignInForm onSignUpClick={onSignUpClick} />)

    expect(screen.getByText(/new to kuuki/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create an account/i })).toBeInTheDocument()
  })

  it('calls onSignUpClick when sign up link is clicked', async () => {
    const user = userEvent.setup()
    const onSignUpClick = vi.fn()
    render(<SignInForm onSignUpClick={onSignUpClick} />)

    await user.click(screen.getByRole('button', { name: /create an account/i }))

    expect(onSignUpClick).toHaveBeenCalled()
  })

  it('does not show sign up link when onSignUpClick is not provided', () => {
    render(<SignInForm />)

    expect(screen.queryByText(/new to kuuki/i)).not.toBeInTheDocument()
  })
})
