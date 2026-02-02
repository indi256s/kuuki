import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, profile } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
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
