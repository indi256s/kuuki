import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import {
  type Profile,
  getProfile,
  getUser,
  onAuthStateChange,
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
} from '@/lib/auth'

interface AuthStore {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isInitialized: boolean

  // Actions
  initialize: () => Promise<void>
  signUp: (email: string, password: string, inviteCode: string) => Promise<{ success: boolean; error?: string }>
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

    // Get initial user
    const user = await getUser()

    if (user) {
      const profile = await getProfile(user.id)
      set({ user, profile, isLoading: false, isInitialized: true })
    } else {
      set({ user: null, profile: null, isLoading: false, isInitialized: true })
    }

    // Subscribe to auth changes
    onAuthStateChange(async (user) => {
      if (user) {
        const profile = await getProfile(user.id)
        set({ user, profile, isLoading: false })
      } else {
        set({ user: null, profile: null, isLoading: false })
      }
    })
  },

  signUp: async (email, password, inviteCode) => {
    set({ isLoading: true })
    const result = await authSignUp(email, password, inviteCode)

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
