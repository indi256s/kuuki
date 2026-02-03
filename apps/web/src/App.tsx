import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query'
import { LandingPage } from '@/routes/LandingPage'
import { AuthPage } from '@/routes/AuthPage'
import { DashboardPage } from '@/routes/DashboardPage'
import { FlightsPage } from '@/routes/FlightsPage'
import { ImportPage } from '@/routes/ImportPage'
import { OnboardingPage } from '@/routes/OnboardingPage'
import { ProfilePage } from '@/routes/ProfilePage'
import { LeaderboardPage } from '@/routes/LeaderboardPage'
import { PassportPage } from '@/routes/PassportPage'
import { SettingsPage } from '@/routes/SettingsPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ToastProvider, ErrorBoundary } from '@/components/error'

/**
 * React Query configuration with:
 * - Auto-retry: 3 attempts with exponential backoff (1s, 2s, 4s, max 30s)
 * - Stale time: 30 seconds
 * - No refetch on window focus (to reduce API calls)
 * - Global error handler for background refetch failures
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Don't auto-retry mutations - user should trigger retry
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only show toast for background refetch failures when we already had data
      // This prevents duplicate errors on initial load failures
      if (query.state.data !== undefined) {
        console.error('[QueryCache] Background refetch failed:', error)
        // Toast handling is done by individual components or useErrorHandler
        // We just log here for debugging/future Sentry integration
      }
    },
  }),
})

/**
 * Route wrapper that provides ErrorBoundary keyed by pathname.
 * This ensures errors on one route don't affect others, and
 * navigating away resets the error state.
 */
function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
}

/**
 * App routes wrapped with error boundaries.
 * Separated to use useLocation hook inside BrowserRouter.
 */
function AppRoutes() {
  return (
    <RouteErrorBoundary>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/flights"
          element={
            <ProtectedRoute>
              <FlightsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/import"
          element={
            <ProtectedRoute>
              <ImportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/passport"
          element={
            <ProtectedRoute>
              <PassportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        {/* Public routes */}
        <Route path="/fly/:username" element={<ProfilePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
      </Routes>
    </RouteErrorBoundary>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <ToastProvider />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
