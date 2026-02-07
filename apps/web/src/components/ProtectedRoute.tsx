import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/ui/LoadingScreen'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, profile } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  // Redirect to onboarding if user has no username
  // (but not if already on onboarding page to prevent redirect loop)
  const needsOnboarding = profile?.username === null
  const isOnOnboarding = location.pathname === '/onboarding'

  if (needsOnboarding && !isOnOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
