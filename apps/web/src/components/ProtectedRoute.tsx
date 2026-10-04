import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useAuthStore } from '@/stores/authStore'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, profile } = useAuth()
  const initializationError = useAuthStore(state => state.initializationError)
  const retryInitialization = useAuthStore(state => state.initialize)
  const { t } = useTranslation()
  const location = useLocation()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (initializationError) {
    return <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p>{t('errors.sessionCheckFailed', 'Could not verify your session. Please try again.')}</p>
      <Button onClick={() => void retryInitialization()}>{t('common.retry', 'Try again')}</Button>
    </div>
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
