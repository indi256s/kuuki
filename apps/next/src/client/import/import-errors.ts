// Structured cause/action classification for the import flow. Pure: the copy lives in copy.ts, so a message string
// from the server is never shown and "Failed to fetch" never reaches the member.

export type FailureKind =
  | 'quota' | 'rateLimit' | 'unavailable' | 'timeout' | 'file' | 'nothing' | 'offline'
  | 'inProgress' | 'batchLimit' | 'expired' | 'notFound' | 'interrupted' | 'truncated' | 'rejected' | 'outputLimit'
export type FailureAction = 'retry' | 'manual' | 'otherFile' | 'pasteText' | 'newImport' | 'openRunning' | 'unfinished'

export interface Failure { kind: FailureKind; actions: FailureAction[]; retryAt: string | null; code: string | null; status: number | null }

const ACTIONS: Record<FailureKind, FailureAction[]> = {
  quota: ['manual'], rateLimit: ['manual'], unavailable: ['retry', 'manual'], timeout: ['retry'], file: ['otherFile', 'pasteText'],
  nothing: ['manual', 'otherFile'], offline: ['retry'], inProgress: ['openRunning'], batchLimit: ['unfinished'],
  expired: ['newImport'], notFound: ['newImport'], interrupted: ['newImport'], truncated: ['newImport'], rejected: ['newImport'], outputLimit: ['newImport'],
}

const KIND_BY_CODE: Record<string, FailureKind> = {
  PROVIDER_QUOTA: 'quota', RATE_LIMITED: 'rateLimit',
  MODEL_UNAVAILABLE: 'unavailable', PROVIDER_ERROR: 'unavailable', PROVIDER_INVALID_RESPONSE: 'unavailable',
  IMPORT_SERVICE_UNAVAILABLE: 'unavailable', INTERNAL: 'unavailable',
  PROVIDER_TIMEOUT: 'timeout',
  INVALID_FILE: 'file', INVALID_BODY: 'file', PAYLOAD_TOO_LARGE: 'file',
  NO_FLIGHTS_FOUND: 'nothing',
  IMPORT_IN_PROGRESS: 'inProgress', IMPORT_BATCH_LIMIT: 'batchLimit',
  IMPORT_BATCH_EXPIRED: 'expired', IMPORT_BATCH_DISCARDED: 'notFound', IMPORT_BATCH_NOT_FOUND: 'notFound',
  JOB_INTERRUPTED: 'interrupted', ROWS_TRUNCATED: 'truncated', ROWS_REJECTED: 'rejected', OUTPUT_LIMIT: 'outputLimit',
}

/** A valid instant from `retryAt` / `retryAfter` / `retry_after`, normalised to ISO; anything else is unknown (null). */
export function retryAtOf(source: unknown): string | null {
  const value = typeof source === 'string' ? source
    : source && typeof source === 'object' ? ((source as Record<string, unknown>).retryAt ?? (source as Record<string, unknown>).retryAfter ?? (source as Record<string, unknown>).retry_after) : null
  if (typeof value !== 'string' || !value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

const make = (kind: FailureKind, retryAt: string | null, code: string | null, status: number | null): Failure =>
  ({ kind, actions: ACTIONS[kind], retryAt: kind === 'quota' || kind === 'rateLimit' || kind === 'unavailable' ? retryAt : null, code, status })

/** Failure of an API call (an `ApiError`, a network `TypeError`, a timeout `DOMException`). */
export function classifyRequestFailure(error: unknown): Failure {
  const shaped = error as { status?: unknown; code?: unknown; body?: unknown; name?: unknown } | null
  const status = typeof shaped?.status === 'number' ? shaped.status : null
  const code = typeof shaped?.code === 'string' ? shaped.code : null
  if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) return make('timeout', null, null, null)
  if (error instanceof TypeError) return make('offline', null, null, null)
  if (code && KIND_BY_CODE[code]) return make(KIND_BY_CODE[code], retryAtOf(shaped?.body), code, status)
  if (status === 504) return make('timeout', null, code, status)
  if (status === 429) return make('rateLimit', retryAtOf(shaped?.body), code, status)
  if (status === 413 || status === 415 || (status === 400 && !code)) return make('file', null, code, status)
  return make('unavailable', retryAtOf(shaped?.body), code, status)
}

/** The cause stored on a batch (`error_code`), or null when the batch carries none. */
export function classifyBatchFailure(code: string | null, retryAfter: string | null): Failure | null {
  if (!code) return null
  return make(KIND_BY_CODE[code] ?? 'unavailable', retryAtOf(retryAfter), code, null)
}

export type RowFailureKind = 'year' | 'duplicate' | 'versionConflict' | 'idempotencyConflict' | 'alreadySaved' | 'flightDeleted' | 'invalid' | 'expired' | 'processing' | 'missing' | 'transient'
export interface RowFailure { kind: RowFailureKind; retryable: boolean }

/** Per-item error of `POST /api/import/batches/:id/confirm`. Only transient causes are retried with the same key. */
export function classifyRowFailure({ code, http_status }: { code?: string; http_status?: number }): RowFailure {
  switch (code) {
    case 'YEAR_NOT_CONFIRMED': return { kind: 'year', retryable: false }
    case 'DUPLICATE_NOT_ACKNOWLEDGED': return { kind: 'duplicate', retryable: false }
    case 'DRAFT_VERSION_CONFLICT': return { kind: 'versionConflict', retryable: false }
    case 'IDEMPOTENCY_CONFLICT': return { kind: 'idempotencyConflict', retryable: false }
    case 'DRAFT_ALREADY_CONVERTED': return { kind: 'alreadySaved', retryable: false }
    case 'CONVERTED_FLIGHT_DELETED': return { kind: 'flightDeleted', retryable: false }
    case 'IMPORT_BATCH_EXPIRED': return { kind: 'expired', retryable: false }
    case 'IMPORT_BATCH_PROCESSING': return { kind: 'processing', retryable: true }
    case 'DRAFT_NOT_FOUND': case 'IMPORT_BATCH_NOT_FOUND': return { kind: 'missing', retryable: false }
  }
  if (http_status === 400 || http_status === 404) return { kind: 'invalid', retryable: false }
  return { kind: 'transient', retryable: true }
}
