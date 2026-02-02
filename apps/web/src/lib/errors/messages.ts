import type { ErrorCategory } from './types'

/**
 * Aviation-themed error message keys organized by category.
 *
 * Design philosophy:
 * - Personality messages: Aviation theme + Corporate-speak parody (GLaDOS-lite)
 * - Frequency: Personality for mild errors, neutral for serious ones
 * - 3-5 variants per category to avoid repetition
 */

/**
 * Message key groups for personality categories.
 * Each group has multiple variants for variety.
 */
export const PERSONALITY_MESSAGES = {
  network: [
    'errors.network.1', // Ground control lost signal
    'errors.network.2', // Radar showing static
    'errors.network.3', // Tower not responding
  ],
  api: [
    'errors.api.1', // Servers experiencing turbulence
    'errors.api.2', // Something went wrong on our end
    'errors.api.3', // Backend having a moment
  ],
  rateLimit: [
    'errors.rateLimit.1', // Faster than a 737 at takeoff
    'errors.rateLimit.2', // Slow down, speed racer
  ],
  notFound: [
    'errors.notFound.1', // Destination not on charts
    'errors.notFound.2', // Flight plan not found
  ],
  generic: [
    'errors.generic.1', // Unexpected turbulence
    'errors.generic.2', // Hit an air pocket
    'errors.generic.3', // Instruments acting up
  ],
} as const

/**
 * Neutral message keys for serious errors.
 * Clear, direct, no personality.
 */
export const NEUTRAL_MESSAGES = {
  auth: 'errors.auth.sessionExpired',
  dataLoss: 'errors.dataLoss.saveFailed',
  validation: 'errors.validation.invalid',
} as const

/**
 * Get a random message key for a personality category.
 */
export function getPersonalityMessageKey(
  category: 'network' | 'api' | 'rateLimit' | 'notFound' | 'generic'
): string {
  const messages = PERSONALITY_MESSAGES[category]
  const index = Math.floor(Math.random() * messages.length)
  return messages[index]
}

/**
 * Get the appropriate message key based on error category.
 * Handles both personality and neutral categories.
 */
export function getMessageKeyForCategory(category: ErrorCategory): string {
  switch (category) {
    case 'network':
      return getPersonalityMessageKey('network')
    case 'api':
      return getPersonalityMessageKey('api')
    case 'rate-limit':
      return getPersonalityMessageKey('rateLimit')
    case 'not-found':
      return getPersonalityMessageKey('notFound')
    case 'auth':
      return NEUTRAL_MESSAGES.auth
    case 'data-loss-risk':
      return NEUTRAL_MESSAGES.dataLoss
    case 'validation':
      return NEUTRAL_MESSAGES.validation
    case 'import':
      // Import errors are handled inline, but provide fallback
      return 'errors.import.parseFailed'
    case 'unknown':
    default:
      return getPersonalityMessageKey('generic')
  }
}

/**
 * Import-specific error message keys for inline display.
 */
export const IMPORT_ERROR_MESSAGES = {
  parseFailed: 'errors.import.parseFailed',
  timeout: 'errors.import.timeout',
  invalidFormat: 'errors.import.invalidFormat',
  noFlights: 'errors.import.noFlights',
} as const

/**
 * Crash screen message keys.
 */
export const CRASH_MESSAGES = {
  title: 'errors.crashScreen.title',
  message: 'errors.crashScreen.message',
  reload: 'errors.crashScreen.reload',
} as const
