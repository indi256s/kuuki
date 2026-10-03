import { QueryClient, QueryCache } from '@tanstack/react-query'

/**
 * React Query configuration with:
 * - Auto-retry: 3 attempts with exponential backoff (1s, 2s, 4s, max 30s)
 * - Stale time: 60 seconds (reduce API calls for rarely-changing data)
 * - Garbage collection: 5 minutes (was cacheTime in v4)
 * - No refetch on window focus (to reduce API calls)
 * - Global error handler for background refetch failures
 */
export const queryClient = new QueryClient({
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

