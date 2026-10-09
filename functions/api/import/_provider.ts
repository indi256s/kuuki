import { ApiError } from '@google/genai'
import { HttpError } from '../_lib/http'

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
// Import UI has a 120s deadline; leave time for validation and response delivery.
export const PROVIDER_TIMEOUT_MS = 90_000

export function usageBucket(tokens: number | undefined): string {
  if (tokens == null || !Number.isFinite(tokens) || tokens < 0) return 'unknown'
  if (tokens < 1_000) return '<1k'
  if (tokens < 10_000) return '1k-10k'
  if (tokens < 100_000) return '10k-100k'
  return '100k+'
}

export class ProviderResponseError extends Error {}

/** Stable, user-visible failures without leaking provider payloads or document text. */
export function providerFailure(error: unknown): HttpError {
  if (error instanceof ProviderResponseError) {
    return new HttpError(
      502,
      'The AI service returned an invalid response. Please try again.',
      'PROVIDER_INVALID_RESPONSE',
    )
  }
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return new HttpError(
        502,
        'The AI model is unavailable. Please try again later.',
        'MODEL_UNAVAILABLE',
      )
    }
    if (error.status === 429) {
      return new HttpError(
        503,
        'The AI service is at its usage limit. Please try again later.',
        'PROVIDER_QUOTA',
      )
    }
  }
  if (
    error instanceof Error &&
    (error.name === 'AbortError' || /timed? out/i.test(error.message))
  ) {
    return new HttpError(504, 'The AI service timed out. Please try again.', 'PROVIDER_TIMEOUT')
  }
  return new HttpError(
    502,
    'The AI service could not process this request. Please try again.',
    'PROVIDER_ERROR',
  )
}
