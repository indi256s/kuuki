import { ApiError } from '@google/genai'

export class ProviderResponseError extends Error {}

/** Stable, user-visible failures without leaking provider payloads or document text. */
export function providerFailure(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof ProviderResponseError) {
    return { status: 502, code: 'PROVIDER_INVALID_RESPONSE', message: 'The AI service returned an invalid response. Please try again.' }
  }
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return { status: 502, code: 'MODEL_UNAVAILABLE', message: 'The AI model is unavailable. Please try again later.' }
    }
    if (error.status === 429) {
      return { status: 503, code: 'PROVIDER_QUOTA', message: 'The AI service is at its usage limit. Please try again later.' }
    }
  }
  if (error instanceof Error && (error.name === 'AbortError' || /timed? out/i.test(error.message))) {
    return { status: 504, code: 'PROVIDER_TIMEOUT', message: 'The AI service timed out. Please try again.' }
  }
  return { status: 502, code: 'PROVIDER_ERROR', message: 'The AI service could not process this request. Please try again.' }
}
