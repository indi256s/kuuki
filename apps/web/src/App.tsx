import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query'
import { LandingPage } from '@/routes/LandingPage'
import { AuthPage } from '@/routes/AuthPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ToastProvider, ErrorBoundary } from '@/components/error'
import { ImportNotificationManager } from '@/components/import/ImportNotificationManager'
import { BadgeNotificationManager } from '@/components/badges'
import { LoadingScreen } from '@/components/ui/LoadingScreen'

const LazyAgentation = lazy(() => import('agentation').then(m => ({ default: m.Agentation })))

/**
 * Wraps a dynamic import to handle stale chunk errors after deployments.
 * When Cloudflare Pages serves new assets, old chunk hashes no longer exist
 * and the SPA fallback returns HTML instead of JS. This detects the failure
 * and reloads the page once to fetch fresh HTML with correct chunk references.
 */
function lazyWithRetry(factory: () => Promise<{ default: React.ComponentType }>) {
  return lazy(() =>
    factory().catch((error: unknown) => {
      const alreadyRetried = sessionStorage.getItem('chunk_retry')
      if (!alreadyRetried) {
        sessionStorage.setItem('chunk_retry', '1')
        window.location.reload()
        return new Promise<never>(() => {})
      }
      sessionStorage.removeItem('chunk_retry')
      throw error
    })
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const named = <K extends string>(key: K) => (m: any) => ({ default: m[key] })

const DashboardPage = lazyWithRetry(() => import('@/routes/DashboardPage').then(named('DashboardPage')))
const FlightsPage = lazyWithRetry(() => import('@/routes/FlightsPage').then(named('FlightsPage')))
const ImportPage = lazyWithRetry(() => import('@/routes/ImportPage').then(named('ImportPage')))
const OnboardingPage = lazyWithRetry(() => import('@/routes/OnboardingPage').then(named('OnboardingPage')))
const LeaderboardPage = lazyWithRetry(() => import('@/routes/LeaderboardPage').then(named('LeaderboardPage')))
const PassportPage = lazyWithRetry(() => import('@/routes/PassportPage').then(named('PassportPage')))
const SettingsPage = lazyWithRetry(() => import('@/routes/SettingsPage').then(named('SettingsPage')))
const DevResetPage = lazyWithRetry(() => import('@/routes/DevResetPage').then(named('DevResetPage')))
const JourneyPlannerPage = lazyWithRetry(() => import('@/routes/JourneyPlannerPage').then(named('JourneyPlannerPage')))
const ProfilePage = lazyWithRetry(() => import('@/routes/ProfilePage').then(named('ProfilePage')))

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
          <Route
            path="/journey"
            element={
              <ProtectedRoute>
                <JourneyPlannerPage />
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
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/fly/:username" element={<ProfilePage />} />
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
        <BadgeNotificationManager />
        {import.meta.env.DEV && <Suspense><LazyAgentation /></Suspense>}
      </BrowserRouter>
    </QueryClientProvider>
  )
}
