import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock Supabase client - use vi.hoisted to ensure it's available during mock hoisting
const { mockSupabaseClient } = vi.hoisted(() => ({
  mockSupabaseClient: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    rpc: vi.fn(),
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabaseClient,
}))

import { SignUpForm } from './SignUpForm'

// Mock i18n - return predictable text
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'auth.inviteCode': 'Invite Code',
        'auth.email': 'Email',
        'auth.password': 'Password',
        'auth.confirmPassword': 'Confirm Password',
        'auth.createAccount': 'Create an account',
        'auth.signIn': 'Sign in',
        'auth.haveAccount': 'Already have an account?',
        'auth.codeValid': 'Valid invite code',
        'auth.codeInvalid': 'Invalid or expired invite code',
        'auth.passwordMismatch': 'Passwords do not match',
        'auth.passwordTooShort': 'Password must be at least 8 characters',
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
    mockSupabaseClient.rpc.mockReset()
    mockSignUp.mockReset()
  })

  it('renders all form fields', () => {
    render(<SignUpForm />)

    expect(screen.getByLabelText(/invite code/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create an account/i })).toBeInTheDocument()
  })

  it('requires invite code for submission', async () => {
    const user = userEvent.setup()

    render(<SignUpForm />)

    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create an account/i }))

    await waitFor(() => {
      expect(screen.getByText(/invite code is required/i)).toBeInTheDocument()
    })
  })

  it('shows error when signup fails due to invalid invite code', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValue({ success: false, error: 'Invalid or expired invite code' })

    render(<SignUpForm />)

    await user.type(screen.getByLabelText(/invite code/i), 'INVALID-CODE')
    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create an account/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid or expired/i)).toBeInTheDocument()
    })
  })

  it('validates password match', async () => {
    const user = userEvent.setup()
    mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null })

    render(<SignUpForm />)

    await user.type(screen.getByLabelText(/invite code/i), 'KUUKI-TEST-swift-cloud')
    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'different123')
    await user.click(screen.getByRole('button', { name: /create an account/i }))

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
  })

  it('validates password length', async () => {
    const user = userEvent.setup()
    mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null })

    render(<SignUpForm />)

    await user.type(screen.getByLabelText(/invite code/i), 'KUUKI-TEST-swift-cloud')
    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'short')
    await user.type(screen.getByLabelText(/confirm password/i), 'short')
    await user.click(screen.getByRole('button', { name: /create an account/i }))

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    })
  })

  it('calls signUp with correct values on valid submission', async () => {
    const user = userEvent.setup()
    mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null })
    mockSignUp.mockResolvedValue({ success: true })

    const onSuccess = vi.fn()
    render(<SignUpForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/invite code/i), 'KUUKI-TEST-swift-cloud')
    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create an account/i }))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        'KUUKI-TEST-SWIFT-CLOUD'
      )
    })
  })

  it('calls onSuccess callback after successful signup', async () => {
    const user = userEvent.setup()
    mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null })
    mockSignUp.mockResolvedValue({ success: true })

    const onSuccess = vi.fn()
    render(<SignUpForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/invite code/i), 'KUUKI-TEST-swift-cloud')
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
    mockSupabaseClient.rpc.mockResolvedValue({ data: true, error: null })
    mockSignUp.mockResolvedValue({ success: false, error: 'Email already in use' })

    render(<SignUpForm />)

    await user.type(screen.getByLabelText(/invite code/i), 'KUUKI-TEST-swift-cloud')
    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create an account/i }))

    await waitFor(() => {
      expect(screen.getByText(/email already in use/i)).toBeInTheDocument()
    })
  })

  it('converts invite code to uppercase', async () => {
    const user = userEvent.setup()
    render(<SignUpForm />)

    const codeInput = screen.getByLabelText(/invite code/i) as HTMLInputElement
    await user.type(codeInput, 'kuuki-test-swift-cloud')

    expect(codeInput.value).toBe('KUUKI-TEST-SWIFT-CLOUD')
  })
})
