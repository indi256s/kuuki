import { describe, it, expect, beforeEach, vi } from 'vitest'

// Replace the real apiClient with the shared mock.
vi.mock('@/lib/apiClient', async () => await import('@/test/mocks/apiClient'))
import { api, ApiError, resetApiMock } from '@/test/mocks/apiClient'

// Import after mocking
import { signUp, signIn, signOut, verifyPassword, deleteAccount } from './auth'

describe('auth functions', () => {
  beforeEach(() => {
    resetApiMock()
  })

  describe('signUp', () => {
    it('creates a user on success', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        profile: null,
      })

      const result = await signUp('test@example.com', 'password123')

      expect(result).toEqual({
        success: true,
        user: { id: 'user-123', email: 'test@example.com' },
      })
      expect(api.post).toHaveBeenCalledWith('/api/auth/signup', {
        email: 'test@example.com',
        password: 'password123',
      })
    })

    it('returns error when the email is already taken', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(
        new ApiError(409, 'An account with this email already exists', 'EMAIL_TAKEN')
      )

      const result = await signUp('test@example.com', 'password123')

      expect(result).toEqual({
        success: false,
        error: 'An account with this email already exists',
      })
    })
  })

  describe('signIn', () => {
    it('returns success on valid credentials', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'test@example.com' },
        profile: null,
      })

      const result = await signIn('test@example.com', 'password123')

      expect(result).toEqual({
        success: true,
        user: { id: 'user-123', email: 'test@example.com' },
      })
      expect(api.post).toHaveBeenCalledWith('/api/auth/signin', {
        email: 'test@example.com',
        password: 'password123',
      })
    })

    it('returns error on invalid credentials', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(
        new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
      )

      const result = await signIn('test@example.com', 'wrongpassword')

      expect(result).toEqual({
        success: false,
        error: 'Invalid email or password',
      })
    })
  })

  describe('signOut', () => {
    it('posts to the signout endpoint', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ ok: true })

      await signOut()

      expect(api.post).toHaveBeenCalledWith('/api/auth/signout')
    })

    it('swallows errors', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new ApiError(500, 'boom'))

      await expect(signOut()).resolves.toBeUndefined()
    })
  })

  describe('verifyPassword', () => {
    it('returns true when the password is correct', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ ok: true })

      const result = await verifyPassword('password123')

      expect(result).toBe(true)
      expect(api.post).toHaveBeenCalledWith('/api/auth/verify-password', {
        password: 'password123',
      })
    })

    it('returns false when the password is incorrect', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(
        new ApiError(401, 'Incorrect password', 'INVALID_CREDENTIALS')
      )

      const result = await verifyPassword('wrongpassword')

      expect(result).toBe(false)
    })
  })

  describe('deleteAccount', () => {
    it('returns success when the account is deleted', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ ok: true })

      const result = await deleteAccount('password123')

      expect(result).toEqual({ success: true })
      expect(api.delete).toHaveBeenCalledWith('/api/auth/account', { password: 'password123' })
    })

    it('returns error on failure', async () => {
      vi.mocked(api.delete).mockRejectedValueOnce(
        new ApiError(500, 'Failed to delete account')
      )

      const result = await deleteAccount('password123')

      expect(result).toEqual({ success: false, error: 'Failed to delete account' })
    })
  })
})
