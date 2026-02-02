/**
 * Error categories for classification and message selection.
 *
 * Categories determine both the error message personality and whether
 * personality should be shown (mild errors) vs neutral messages (serious errors).
 */
export type ErrorCategory =
  | 'network'        // Fetch failures, timeouts, offline
  | 'api'            // 5xx server errors
  | 'auth'           // 401, session expired (serious - neutral tone)
  | 'validation'     // 400, 422 client errors
  | 'not-found'      // 404 errors
  | 'rate-limit'     // 429 too many requests
  | 'data-loss-risk' // Failed saves/updates/deletes (serious - neutral tone)
  | 'import'         // Import-specific parsing errors (inline display)
  | 'unknown'        // Fallback for unclassified errors

/**
 * Severity determines whether personality messages are shown.
 * - 'mild': Can show aviation-themed personality messages
 * - 'serious': Data loss risk or auth issues - use neutral, clear messages
 */
export type ErrorSeverity = 'mild' | 'serious'

/**
 * Context where the error occurred, affecting display behavior.
 * - 'modal': Error happened in a modal/dialog - show inline, not toast
 * - 'page': Error on a page - show toast
 * - 'background-refetch': Silent refetch failed - only toast if data was shown
 */
export type ErrorContext = 'modal' | 'page' | 'background-refetch'

/**
 * Processed error with classification and retry capability.
 */
export interface ClassifiedError {
  category: ErrorCategory
  severity: ErrorSeverity
  message: string           // Original error message
  messageKey: string        // i18n key for display
  isRetryable: boolean      // Whether retry makes sense
  httpStatus?: number       // HTTP status code if available
  originalError: unknown    // Original error for debugging
}
