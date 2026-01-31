import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const store = useAuthStore()

  // Initialize auth on first use
  useEffect(() => {
    store.initialize()
  }, [])

  return {
    user: store.user,
    profile: store.profile,
    isLoading: store.isLoading,
    isAuthenticated: !!store.user,
    signUp: store.signUp,
    signIn: store.signIn,
    signOut: store.signOut,
    refreshProfile: store.refreshProfile,
  }
}
