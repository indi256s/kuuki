import { useCallback } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useErrorStore } from '@/stores/errorStore'
import { classifyError, isRetryable } from '@/lib/errors'
import type { ErrorCategory } from '@/lib/errors'

interface ToastErrorOptions {
  /** Override the error category for classification */
  category?: ErrorCategory
  /** Callback to retry the operation */
  retry?: () => void
  /** Context hint for better error classification */
  context?: string
}

interface ToastSuccessOptions {
  /** Optional description below the title */
  description?: string
  /** Optional action button */
  action?: {
    label: string
    onClick: () => void
  }
  /** Duration in ms (default: 4000) */
  duration?: number
}

/**
 * Toast hook with i18n support and error deduplication.
 *
 * Usage:
 * ```tsx
 * const { showError, showSuccess } = useToast()
 *
 * // Show error with auto-classification
 * showError(error)
 *
 * // Show error with retry button
 * showError(error, { retry: () => mutation.mutate() })
 *
 * // Show success message
 * showSuccess('flights.saved')
 * ```
 */
export function useToast() {
  const { t } = useTranslation()
  const { isDuplicate, addError } = useErrorStore()

  /**
   * Show an error toast with i18n messages.
   * Handles deduplication and retry actions.
   */
  const showError = useCallback(
    (error: unknown, options: ToastErrorOptions = {}) => {
      const classified = classifyError(error, options.context)

      // Use provided category or classified one
      const messageKey = options.category
        ? `errors.${options.category}.1`
        : classified.messageKey

      // Get translated message
      const message = t(messageKey, t('errors.generic.1'))

      // Check for duplicate
      if (isDuplicate(message)) {
        console.debug('[Toast] Suppressed duplicate error:', message)
        return
      }

      // Track this error
      addError(message)

      // Log to console for debugging (future: Sentry)
      console.error('[Error]', classified.originalError)

      // Determine if we should show retry
      const shouldShowRetry =
        options.retry && (options.category ? isRetryable(options.category) : classified.isRetryable)

      // Show toast
      if (shouldShowRetry && options.retry) {
        toast.error(message, {
          action: {
            label: t('common.retry'),
            onClick: options.retry,
          },
        })
      } else {
        toast.error(message)
      }
    },
    [t, isDuplicate, addError]
  )

  /**
   * Show a success toast with i18n messages.
   */
  const showSuccess = useCallback(
    (message: string, options: ToastSuccessOptions = {}) => {
      // If message looks like a translation key, translate it
      const displayMessage = message.includes('.') ? t(message) : message
      const description = options.description ? t(options.description) : undefined

      toast.success(displayMessage, {
        description,
        duration: options.duration,
        ...(options.action && {
          action: {
            label: options.action.label,
            onClick: options.action.onClick,
          },
        }),
      })
    },
    [t]
  )

  /**
   * Show an info toast.
   */
  const showInfo = useCallback(
    (messageKey: string, description?: string) => {
      toast.info(t(messageKey), {
        description: description ? t(description) : undefined,
      })
    },
    [t]
  )

  /**
   * Show a warning toast.
   */
  const showWarning = useCallback(
    (messageKey: string, description?: string) => {
      toast.warning(t(messageKey), {
        description: description ? t(description) : undefined,
      })
    },
    [t]
  )

  /**
   * Dismiss all toasts.
   */
  const dismissAll = useCallback(() => {
    toast.dismiss()
  }, [])

  return {
    showError,
    showSuccess,
    showInfo,
    showWarning,
    dismissAll,
  }
}
