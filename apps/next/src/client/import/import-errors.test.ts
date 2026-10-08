import { expect, it } from 'vitest'
import { ApiError } from '@kuuki/client/apiClient'
import { classifyRequestFailure, classifyRowFailure, retryAtOf } from './import-errors'

it('never maps an unknown error to a raw message', () => {
  expect(classifyRequestFailure(new ApiError(418, 'raw server text', 'WEIRD'))).toMatchObject({ kind: 'unavailable' })
  expect(classifyRequestFailure('Failed to fetch')).toMatchObject({ kind: 'unavailable' })
})

it('preserves retryAt from the error body when it is a valid instant', () => {
  const body = { error: 'x', code: 'PROVIDER_QUOTA', retryAt: '2026-10-05T14:05:00.000Z' }
  expect(classifyRequestFailure(new ApiError(503, 'x', 'PROVIDER_QUOTA', body)).retryAt).toBe('2026-10-05T14:05:00.000Z')
  expect(classifyRequestFailure(new ApiError(503, 'x', 'PROVIDER_QUOTA', { retryAt: 'soon' })).retryAt).toBeNull()
  expect(retryAtOf({ retryAfter: '2026-10-05T14:05:00Z' })).toBe('2026-10-05T14:05:00.000Z')
  expect(retryAtOf(null)).toBeNull()
})

it('treats an unknown 5xx without a code as transient', () => {
  expect(classifyRowFailure({ http_status: 502 })).toEqual({ kind: 'transient', retryable: true })
})
