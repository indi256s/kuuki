import { describe, it, expect, beforeEach } from 'vitest'
import { mockSupabaseClient, resetSupabaseMocks } from '@/test/mocks/supabase'

// Import after mocking
import { checkInviteCode, signUp, signIn, signOut } from './auth'

describe('auth functions', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  describe('checkInviteCode', () => {
    it('returns true for valid code', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: true, error: null })

      const result = await checkInviteCode('KUUKI-TEST-swift-cloud')

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('check_invite_code', {
        p_code: 'KUUKI-TEST-SWIFT-CLOUD',
      })
      expect(result).toBe(true)
    })

    it('returns false for invalid code', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: false, error: null })

      const result = await checkInviteCode('INVALID-CODE')

      expect(result).toBe(false)
    })

    it('returns false on error', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      })

      const result = await checkInviteCode('KUUKI-TEST-swift-cloud')

      expect(result).toBe(false)
    })

    it('converts code to uppercase', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: true, error: null })

      await checkInviteCode('kuuki-test-swift-cloud')

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('check_invite_code', {
        p_code: 'KUUKI-TEST-SWIFT-CLOUD',
      })
    })
  })

  describe('signUp', () => {
    it('returns error for invalid invite code', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: false, error: null })

      const result = await signUp('test@example.com', 'password123', 'INVALID')

      expect(result).toEqual({
        success: false,
        error: 'Invalid or expired invite code',
      })
      expect(mockSupabaseClient.auth.signUp).not.toHaveBeenCalled()
    })

    it('creates user and uses invite code on success', async () => {
      // Mock checkInviteCode
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: true, error: null })
      // Mock signUp
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      })
      // Mock useInviteCode
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: true, error: null })

      const result = await signUp('test@example.com', 'password123', 'KUUKI-TEST-swift-cloud')

      expect(result).toMatchObject({ success: true })
      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            invite_code: 'KUUKI-TEST-SWIFT-CLOUD',
          },
        },
      })
    })

    it('returns error when auth signUp fails', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: true, error: null })
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Email already registered' },
      })

      const result = await signUp('test@example.com', 'password123', 'KUUKI-TEST-swift-cloud')

      expect(result).toEqual({
        success: false,
        error: 'Email already registered',
      })
    })
  })

  describe('signIn', () => {
    it('returns success on valid credentials', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      const result = await signIn('test@example.com', 'password123')

      expect(result).toMatchObject({ success: true })
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })

    it('returns error on invalid credentials', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      })

      const result = await signIn('test@example.com', 'wrongpassword')

      expect(result).toEqual({
        success: false,
        error: 'Invalid login credentials',
      })
    })
  })

  describe('signOut', () => {
    it('calls supabase signOut', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValueOnce({ error: null })

      await signOut()

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled()
    })
  })
})
