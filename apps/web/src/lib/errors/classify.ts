import type { ErrorCategory, ClassifiedError } from './types'

/**
 * Extract HTTP status code from various error shapes.
 */
function getStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined

  // Fetch Response
  if ('status' in error && typeof error.status === 'number') {
    return error.status
  }

  // Supabase error shape
  if ('code' in error && typeof error.code === 'string') {
    const code = parseInt(error.code, 10)
    if (!isNaN(code) && code >= 100 && code < 600) return code
  }

  // Error with statusCode property
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode
  }

  return undefined
}

/**
 * Extract error message from various error shapes.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }
    if ('error' in error && typeof error.error === 'string') {
      return error.error
    }
  }
  return 'Unknown error'
}

/**
 * Check if error message indicates a network failure.
 */
function isNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()

  // Common network error patterns
  const networkPatterns = [
    'network',
    'fetch',
    'failed to fetch',
    'network request failed',
    'net::',
    'cors',
    'timeout',
    'timed out',
    'aborted',
    'connection refused',
    'no internet',
    'offline',
    'dns',
  ]

  return networkPatterns.some((pattern) => message.includes(pattern))
}

/**
 * Check if error indicates a data mutation failure (data loss risk).
 */
function isDataLossRisk(error: unknown, context?: string): boolean {
  const message = getErrorMessage(error).toLowerCase()

  // Context hints from mutation operations
  const contextHints = [
    'save',
    'create',
    'update',
    'delete',
    'remove',
    'mutation',
  ]

  if (context && contextHints.some((hint) => context.toLowerCase().includes(hint))) {
    return true
  }

  // Message hints
  const messagePatterns = [
    'failed to save',
    'failed to create',
    'failed to update',
    'failed to delete',
    'could not save',
    'could not create',
    'could not update',
    'could not delete',
  ]

  return messagePatterns.some((pattern) => message.includes(pattern))
}

/**
 * Classify an error into a category based on status code and message.
 */
export function classifyError(
  error: unknown,
  mutationContext?: string
): ClassifiedError {
  const status = getStatusCode(error)
  const message = getErrorMessage(error)

  // Network errors (no status code, but fetch-like failures)
  if (isNetworkError(error)) {
    return {
      category: 'network',
      severity: 'mild',
      message,
      messageKey: getRandomMessageKey('network'),
      isRetryable: true,
      originalError: error,
    }
  }

  // HTTP status-based classification
  if (status) {
    // Auth errors
    if (status === 401 || status === 403) {
      return {
        category: 'auth',
        severity: 'serious',
        message,
        messageKey: 'errors.auth.sessionExpired',
        isRetryable: false,
        httpStatus: status,
        originalError: error,
      }
    }

    // Rate limiting
    if (status === 429) {
      return {
        category: 'rate-limit',
        severity: 'mild',
        message,
        messageKey: getRandomMessageKey('rateLimit'),
        isRetryable: true,
        httpStatus: status,
        originalError: error,
      }
    }

    // Not found
    if (status === 404) {
      return {
        category: 'not-found',
        severity: 'mild',
        message,
        messageKey: getRandomMessageKey('notFound'),
        isRetryable: false,
        httpStatus: status,
        originalError: error,
      }
    }

    // Validation errors
    if (status === 400 || status === 422) {
      return {
        category: 'validation',
        severity: 'mild',
        message,
        messageKey: 'errors.validation.invalid',
        isRetryable: false,
        httpStatus: status,
        originalError: error,
      }
    }

    // Server errors
    if (status >= 500) {
      return {
        category: 'api',
        severity: 'mild',
        message,
        messageKey: getRandomMessageKey('api'),
        isRetryable: true,
        httpStatus: status,
        originalError: error,
      }
    }
  }

  // Check for data loss risk based on context or message
  if (isDataLossRisk(error, mutationContext)) {
    return {
      category: 'data-loss-risk',
      severity: 'serious',
      message,
      messageKey: 'errors.dataLoss.saveFailed',
      isRetryable: true,
      originalError: error,
    }
  }

  // Unknown/fallback
  return {
    category: 'unknown',
    severity: 'mild',
    message,
    messageKey: getRandomMessageKey('generic'),
    isRetryable: true,
    originalError: error,
  }
}

/**
 * Message key counts for each category (3-5 variants).
 */
const MESSAGE_COUNTS: Record<string, number> = {
  network: 3,
  api: 3,
  rateLimit: 2,
  notFound: 2,
  generic: 3,
}

/**
 * Get a random message key for a category (1-indexed).
 */
function getRandomMessageKey(category: string): string {
  const count = MESSAGE_COUNTS[category] || 1
  const index = Math.floor(Math.random() * count) + 1
  return `errors.${category}.${index}`
}

/**
 * Determine if an error category should show personality or neutral messages.
 */
export function shouldShowPersonality(category: ErrorCategory): boolean {
  // Serious errors get neutral, clear messages
  const seriousCategories: ErrorCategory[] = ['auth', 'data-loss-risk', 'validation']
  return !seriousCategories.includes(category)
}

/**
 * Check if an error is retryable based on category.
 */
export function isRetryable(category: ErrorCategory): boolean {
  const retryableCategories: ErrorCategory[] = [
    'network',
    'api',
    'rate-limit',
    'data-loss-risk',
    'unknown',
  ]
  return retryableCategories.includes(category)
}
