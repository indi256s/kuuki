import { describe, it, expect, beforeEach, vi } from 'vitest'

// Replace the real apiClient with the shared mock.
vi.mock('@kuuki/client/apiClient', async () => await import('@/test/mocks/apiClient'))
import { api, ApiError, resetApiMock } from '@/test/mocks/apiClient'

// Import after mocking
import { signUp, signIn, signOut, verifyPassword, deleteAccount, getMe } from './auth'

describe('auth functions', () => {
  beforeEach(() => {
    resetApiMock()
  })

  it('propagates a session lookup outage instead of confirming anonymity', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new ApiError(503, 'Unavailable'))
    await expect(getMe()).rejects.toMatchObject({ status: 503 })
  })

  it('sends Better Auth email actions through the identity-scoped API transport', async () => {
    const token = Symbol('account action')
    const user = { id: 'user-1', email: 'test@example.com' }
    vi.mocked(api.post).mockResolvedValueOnce({ user })
    await expect(signIn(' test@example.com ', 'password123', token)).resolves.toEqual({ success: true, user })
    expect(api.post).toHaveBeenCalledWith('/api/auth/sign-in/email', {
      email: 'test@example.com', password: 'password123',
    }, expect.objectContaining({ identityToken: token }))

    vi.mocked(api.post).mockResolvedValueOnce({ user })
    await expect(signUp(' test@example.com ', 'password123', token)).resolves.toEqual({ success: true, user })
    expect(api.post).toHaveBeenLastCalledWith('/api/auth/sign-up/email', {
      email: 'test@example.com', password: 'password123', name: '',
    }, expect.objectContaining({ identityToken: token }))

    vi.mocked(api.post).mockResolvedValueOnce({ success: true })
    await expect(signOut(token)).resolves.toEqual({ success: true })
    expect(api.post).toHaveBeenLastCalledWith('/api/auth/sign-out', {},
      expect.objectContaining({ identityToken: token }))
  })

  it.each([
    {
      name: 'signUp (email taken)',
      method: 'post' as const,
      error: new ApiError(409, 'An account with this email already exists', 'EMAIL_TAKEN'),
      call: () => signUp('test@example.com', 'password123'),
      expected: { success: false, error: 'An account with this email already exists' },
    },
    {
      name: 'signIn (invalid credentials)',
      method: 'post' as const,
      error: new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS'),
      call: () => signIn('test@example.com', 'wrongpassword'),
      expected: { success: false, error: 'Invalid email or password' },
    },
    {
      name: 'signOut',
      method: 'post' as const,
      error: new ApiError(500, 'boom'),
      call: () => signOut(),
      expected: { success: false, error: 'boom' },
    },
    {
      name: 'deleteAccount',
      method: 'delete' as const,
      error: new ApiError(500, 'Failed to delete account'),
      call: () => deleteAccount('password123'),
      expected: { success: false, error: 'Failed to delete account' },
    },
  ])('maps ApiError to { success: false, error }: $name', async ({ method, error, call, expected }) => {
    vi.mocked(api[method]).mockRejectedValueOnce(error)

    await expect(call()).resolves.toEqual(expected)
  })

  it('verifyPassword returns false on error', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(
      new ApiError(401, 'Incorrect password', 'INVALID_CREDENTIALS')
    )

    const result = await verifyPassword('wrongpassword')

    expect(result).toBe(false)
  })
})
