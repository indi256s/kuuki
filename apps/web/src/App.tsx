import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query'
import { LandingPage } from '@/routes/LandingPage'
import { AuthPage } from '@/routes/AuthPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ToastProvider, ErrorBoundary } from '@/components/error'
import { ImportNotificationManager } from '@/components/import/ImportNotificationManager'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { Agentation } from 'agentation'

const DashboardPage = lazy(() => import('@/routes/DashboardPage').then(m => ({ default: m.DashboardPage })))
const FlightsPage = lazy(() => import('@/routes/FlightsPage').then(m => ({ default: m.FlightsPage })))
const ImportPage = lazy(() => import('@/routes/ImportPage').then(m => ({ default: m.ImportPage })))
const OnboardingPage = lazy(() => import('@/routes/OnboardingPage').then(m => ({ default: m.OnboardingPage })))
const ProfilePage = lazy(() => import('@/routes/ProfilePage').then(m => ({ default: m.ProfilePage })))
const LeaderboardPage = lazy(() => import('@/routes/LeaderboardPage').then(m => ({ default: m.LeaderboardPage })))
const PassportPage = lazy(() => import('@/routes/PassportPage').then(m => ({ default: m.PassportPage })))
const SettingsPage = lazy(() => import('@/routes/SettingsPage').then(m => ({ default: m.SettingsPage })))
const DevResetPage = lazy(() => import('@/routes/DevResetPage').then(m => ({ default: m.DevResetPage })))

/**
 * React Query configuration with:
 * - Auto-retry: 3 attempts with exponential backoff (1s, 2s, 4s, max 30s)
 * - Stale time: 60 seconds (reduce API calls for rarely-changing data)
 * - Garbage collection: 5 minutes (was cacheTime in v4)
 * - No refetch on window focus (to reduce API calls)
 * - Global error handler for background refetch failures
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 60_000, // 1 minute (reduced API calls)
      gcTime: 5 * 60 * 1000, // 5 minutes
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
    <Suspense fallback={<LoadingScreen />}>
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
        {/* Dev tools */}
        <Route
          path="/dev/reset"
          element={
            <ProtectedRoute>
              <DevResetPage />
            </ProtectedRoute>
          }
        />
        {/* Public routes */}
        <Route path="/fly/:username" element={<ProfilePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
      </Routes>
    </RouteErrorBoundary>
    </Suspense>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <ToastProvider />
        <ImportNotificationManager />
        {import.meta.env.DEV && <Agentation />}
      </BrowserRouter>
    </QueryClientProvider>
  )
}
