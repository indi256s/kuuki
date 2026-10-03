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

  it('submits credentials, then calls onSuccess', async () => {
    const user = userEvent.setup()
    mockSignIn.mockResolvedValue({ success: true })

    const onSuccess = vi.fn()
    render(<SignInForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123')
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
})
