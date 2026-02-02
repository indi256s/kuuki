import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useToast } from './useToast'
import { classifyError } from '@/lib/errors'
import type { ErrorContext } from '@/lib/errors'

interface ErrorHandlerOptions {
  /** If true, don't show any UI feedback */
  silent?: boolean
  /** Context where error occurred - affects display behavior */
  context?: ErrorContext
  /** Callback to retry the failed operation */
  onRetry?: () => void
  /** Additional context hint for classification */
  contextHint?: string
}

/**
 * Central error handling hook.
 *
 * Features:
 * - Silent re-auth attempt on 401 errors
 * - Context-aware display (modal = inline, page = toast)
 * - Retry button for retryable errors
 * - Deduplication via useToast
 *
 * Usage:
 * ```tsx
 * const { handleError } = useErrorHandler()
 *
 * // In mutation onError
 * onError: (error) => handleError(error, { onRetry: () => mutate() })
 *
 * // Silent handling (no UI feedback)
 * handleError(error, { silent: true })
 * ```
 */
export function useErrorHandler() {
  const navigate = useNavigate()
  const { showError } = useToast()

  /**
   * Attempt silent session refresh for 401 errors.
   * Returns true if refresh succeeded and operation should be retried.
   */
  const attemptSessionRefresh = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data.session) {
        console.debug('[Auth] Session refresh failed:', error?.message)
        return false
      }
      console.debug('[Auth] Session refreshed successfully')
      return true
    } catch (e) {
      console.debug('[Auth] Session refresh error:', e)
      return false
    }
  }, [])

  /**
   * Handle an error with appropriate UI feedback.
   */
  const handleError = useCallback(
    async (
      error: unknown,
      options: ErrorHandlerOptions = {}
    ): Promise<void> => {
      const { silent = false, context = 'page', onRetry, contextHint } = options

      // Classify the error
      const classified = classifyError(error, contextHint)

      // Handle auth errors specially
      if (classified.category === 'auth') {
        // Try silent re-auth first
        const refreshed = await attemptSessionRefresh()

        if (refreshed && onRetry) {
          // Session refreshed - retry the operation silently
          console.debug('[ErrorHandler] Retrying after session refresh')
          onRetry()
          return
        }

        // Refresh failed - redirect to auth page
        if (!silent) {
          // Navigate to auth with return URL
          navigate('/auth', {
            state: { from: window.location.pathname },
            replace: true,
          })
        }
        return
      }

      // For modal context, we don't show toast - errors should be handled inline
      if (context === 'modal') {
        console.debug('[ErrorHandler] Modal context - skipping toast')
        return
      }

      // For background refetch failures, only show toast if we have data
      // (this is typically handled at the QueryCache level)
      if (context === 'background-refetch') {
        // We let this through to show error - the caller should decide
        // whether to show based on whether data was already displayed
      }

      // Show toast unless silent
      if (!silent) {
        showError(error, {
          context: contextHint,
          retry: onRetry && classified.isRetryable ? onRetry : undefined,
        })
      }
    },
    [attemptSessionRefresh, navigate, showError]
  )

  /**
   * Create an onError handler for React Query mutations.
   */
  const createMutationErrorHandler = useCallback(
    (options: Omit<ErrorHandlerOptions, 'silent'> = {}) => {
      return (error: unknown) => handleError(error, options)
    },
    [handleError]
  )

  return {
    handleError,
    createMutationErrorHandler,
  }
}

/**
 * Create a global error handler for use outside of React components.
 * Used by QueryCache onError callback.
 */
export function createGlobalErrorHandler(navigate: (path: string) => void) {
  return async (error: unknown, silent = false) => {
    const classified = classifyError(error)

    // Log all errors (future: Sentry)
    console.error('[GlobalError]', error)

    // Auth errors redirect to login
    if (classified.category === 'auth' && !silent) {
      navigate('/auth')
    }
  }
}
