import { create } from 'zustand'
import { setUnauthorizedHandler } from '@/lib/apiClient'
import {
  type AuthUser,
  type Profile,
  getMe,
  getProfile,
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
} from '@/lib/auth'

interface AuthStore {
  user: AuthUser | null
  profile: Profile | null
  isLoading: boolean
  isInitialized: boolean

  // Actions
  initialize: () => Promise<void>
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) return

    set({ isLoading: true })

    // A failed session refresh (inside apiClient) hard-logs-out the user.
    setUnauthorizedHandler(() => set({ user: null, profile: null }))

    try {
      // Bootstrap the session from the httpOnly cookie.
      const { user, profile } = await getMe()
      set({ user, profile, isLoading: false, isInitialized: true })
    } catch (error) {
      // Network errors, timeouts, etc. - don't leave loading state stuck
      console.error('Auth initialization failed:', error)
      set({ user: null, profile: null, isLoading: false, isInitialized: true })
    }
  },

  signUp: async (email, password) => {
    set({ isLoading: true })
    const result = await authSignUp(email, password)

    // Set user immediately to avoid race condition with navigation
    if (result.success && result.user) {
      const profile = await getProfile(result.user.id)
      set({ user: result.user, profile, isLoading: false })
    } else {
      set({ isLoading: false })
    }

    return result
  },

  signIn: async (email, password) => {
    set({ isLoading: true })
    const result = await authSignIn(email, password)

    // Set user immediately to avoid race condition with navigation
    if (result.success && result.user) {
      const profile = await getProfile(result.user.id)
      set({ user: result.user, profile, isLoading: false })
    } else {
      set({ isLoading: false })
    }

    return result
  },

  signOut: async () => {
    set({ isLoading: true })
    await authSignOut()
    set({ user: null, profile: null, isLoading: false })
  },

  refreshProfile: async () => {
    const { user } = get()
    if (user) {
      const profile = await getProfile(user.id)
      set({ profile })
    }
  },
}))

// Selector hooks for convenience
export const useUser = () => useAuthStore((state) => state.user)
export const useProfile = () => useAuthStore((state) => state.profile)
export const useIsAuthenticated = () => useAuthStore((state) => !!state.user)
export const useIsLoading = () => useAuthStore((state) => state.isLoading)
