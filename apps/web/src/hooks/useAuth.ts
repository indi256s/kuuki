import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const store = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      profile: state.profile,
      isLoading: state.isLoading,
      isAuthenticated: !!state.user,
      signUp: state.signUp,
      signIn: state.signIn,
      signOut: state.signOut,
      refreshProfile: state.refreshProfile,
      initialize: state.initialize,
    }))
  )

  useEffect(() => {
    store.initialize()
  }, [store.initialize])

  return store
}
