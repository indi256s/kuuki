import { vi } from 'vitest'

// Mock Supabase client for testing
export const mockSupabaseClient = {
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
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(),
    })),
  })),
  rpc: vi.fn(),
}

// Reset all mocks
export function resetSupabaseMocks() {
  mockSupabaseClient.auth.signUp.mockReset()
  mockSupabaseClient.auth.signInWithPassword.mockReset()
  mockSupabaseClient.auth.signOut.mockReset()
  mockSupabaseClient.auth.getSession.mockReset()
  mockSupabaseClient.auth.getUser.mockReset()
  mockSupabaseClient.rpc.mockReset()
}

// Mock the supabase module
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabaseClient,
}))
