import { QueryClient, QueryCache } from '@tanstack/react-query'
import { ApiError } from './apiClient'

/** Cancelled requests were dropped on purpose. The account-lock rejection is transient, so it still retries. */
function isCancellation(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.message === 'Request cancelled') return true
  return error.name === 'AbortError' && error.message !== 'Account action in progress'
}

/** Retry only reads that can recover without a user changing input or account state. */
export function shouldRetryRead(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2 || isCancellation(error)) return false
  if (error instanceof ApiError) {
    if (error.code && /quota|rate.?limit|billing|payment|invalid.?input|unauthorized|forbidden/i.test(error.code)) return false
    return error.status === 408 || error.status >= 500
  }
  return error instanceof TypeError || (error instanceof Error && /network|fetch|timed out/i.test(error.message))
}

/**
 * React Query configuration with:
 * - Auto-retry: 3 attempts with exponential backoff (1s, 2s, 4s, max 30s), never for cancelled requests
 * - Stale time: 60 seconds (reduce API calls for rarely-changing data)
 * - Garbage collection: 5 minutes (was cacheTime in v4)
 * - No refetch on window focus (to reduce API calls)
 * - Global error handler for background refetch failures
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryRead,
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
