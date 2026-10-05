import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../../web/src/lib/apiClient'
import { classifyBatchFailure, classifyRequestFailure, classifyRowFailure, retryAtOf } from './import-errors'

describe('request failures (ApiError.code / status -> cause and action)', () => {
  const cases: Array<[string, ApiError | Error, string, string[]]> = [
    ['provider quota', new ApiError(503, 'x', 'PROVIDER_QUOTA'), 'quota', ['manual']],
    ['application rate limit', new ApiError(429, 'x', 'RATE_LIMITED'), 'rateLimit', ['manual']],
    ['model unavailable', new ApiError(502, 'x', 'MODEL_UNAVAILABLE'), 'unavailable', ['retry', 'manual']],
    ['service unavailable', new ApiError(503, 'x', 'IMPORT_SERVICE_UNAVAILABLE'), 'unavailable', ['retry', 'manual']],
    ['plain 500', new ApiError(500, 'x', 'INTERNAL'), 'unavailable', ['retry', 'manual']],
    ['provider timeout', new ApiError(504, 'x', 'PROVIDER_TIMEOUT'), 'timeout', ['retry']],
    ['client timeout', Object.assign(new DOMException('t', 'TimeoutError')), 'timeout', ['retry']],
    ['invalid file', new ApiError(400, 'x', 'INVALID_FILE'), 'file', ['otherFile', 'pasteText']],
    ['too large', new ApiError(413, 'x', 'PAYLOAD_TOO_LARGE'), 'file', ['otherFile', 'pasteText']],
    ['bad body', new ApiError(400, 'x', 'INVALID_BODY'), 'file', ['otherFile', 'pasteText']],
    ['unknown source type', new ApiError(400, 'x', 'INVALID_SOURCE_TYPE'), 'file', ['otherFile', 'pasteText']],
    ['text too long', new ApiError(400, 'x', 'TEXT_TOO_LONG'), 'file', ['otherFile', 'pasteText']],
    ['nothing found', new ApiError(200, 'x', 'NO_FLIGHTS_FOUND'), 'nothing', ['manual', 'otherFile']],
    ['another import running', new ApiError(409, 'x', 'IMPORT_IN_PROGRESS'), 'inProgress', ['openRunning']],
    ['too many open batches', new ApiError(409, 'x', 'IMPORT_BATCH_LIMIT'), 'batchLimit', ['unfinished']],
    ['expired', new ApiError(410, 'x', 'IMPORT_BATCH_EXPIRED'), 'expired', ['newImport']],
    ['discarded', new ApiError(410, 'x', 'IMPORT_BATCH_DISCARDED'), 'notFound', ['newImport']],
    ['missing', new ApiError(404, 'x', 'IMPORT_BATCH_NOT_FOUND'), 'notFound', ['newImport']],
    ['network down', new TypeError('Failed to fetch'), 'offline', ['retry']],
  ]
  it.each(cases)('%s', (_name, error, kind, actions) => {
    const failure = classifyRequestFailure(error)
    expect(failure.kind).toBe(kind)
    expect(failure.actions).toEqual(actions)
  })

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
})

describe('batch failures (a stored error_code on the batch)', () => {
  it('maps each stored code to a cause', () => {
    expect(classifyBatchFailure('NO_FLIGHTS_FOUND', null)?.kind).toBe('nothing')
    expect(classifyBatchFailure('PROVIDER_QUOTA', '2026-10-05T14:05:00Z')).toMatchObject({ kind: 'quota', retryAt: '2026-10-05T14:05:00.000Z' })
    expect(classifyBatchFailure('PROVIDER_TIMEOUT', null)?.kind).toBe('timeout')
    expect(classifyBatchFailure('INVALID_FILE', null)?.kind).toBe('file')
    expect(classifyBatchFailure('JOB_INTERRUPTED', null)).toMatchObject({ kind: 'interrupted', actions: ['newImport'] })
    expect(classifyBatchFailure('ROWS_TRUNCATED', null)?.kind).toBe('truncated')
    expect(classifyBatchFailure('ROWS_REJECTED', null)?.kind).toBe('rejected')
    expect(classifyBatchFailure('OUTPUT_LIMIT', null)?.kind).toBe('outputLimit')
    expect(classifyBatchFailure('PROVIDER_ERROR', null)?.kind).toBe('unavailable')
    expect(classifyBatchFailure(null, null)).toBeNull()
  })
})

describe('row failures from confirm', () => {
  it.each([
    ['YEAR_NOT_CONFIRMED', 400, 'year', false],
    ['DUPLICATE_NOT_ACKNOWLEDGED', 409, 'duplicate', false],
    ['DRAFT_VERSION_CONFLICT', 409, 'versionConflict', false],
    ['IDEMPOTENCY_CONFLICT', 409, 'idempotencyConflict', false],
    ['DRAFT_ALREADY_CONVERTED', 409, 'alreadySaved', false],
    ['CONVERTED_FLIGHT_DELETED', 410, 'flightDeleted', false],
    ['UNKNOWN_AIRPORT', 400, 'invalid', false],
    ['UNKNOWN_AIRCRAFT', 400, 'invalid', false],
    ['INVALID_FLIGHT', 400, 'invalid', false],
    ['IMPORT_BATCH_EXPIRED', 410, 'expired', false],
    ['IMPORT_BATCH_PROCESSING', 409, 'processing', true],
    ['UNAVAILABLE', 503, 'transient', true],
    ['INTERNAL', 500, 'transient', true],
    ['RATE_LIMITED', 429, 'transient', true],
  ])('%s -> %s (retryable %s)', (code, status, kind, retryable) => {
    expect(classifyRowFailure({ code, http_status: status })).toEqual({ kind, retryable })
  })
  it('treats an unknown 5xx without a code as transient', () => {
    expect(classifyRowFailure({ http_status: 502 })).toEqual({ kind: 'transient', retryable: true })
  })
})
