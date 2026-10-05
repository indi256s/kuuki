// Saving flights added by hand. It reuses the shared create helper and its receipt (one stored key and payload per
// operation id, `flightCreateOperations`). An operation stays unsettled, with its receipt, operation id and pinned
// payload, until the outcome is known: a 2xx (written or replayed), a definitive validation refusal on an operation
// with no earlier attempt, or the member's explicit "I checked the journal". Everything else (401/403, 408, 409/410
// idempotency answers, 413, 429, 5xx, network loss, or any refusal after an earlier attempt) may have followed a
// committed write, so the receipt stays and the unchanged row replays under the same key. A changed payload under
// that receipt is refused locally (UnconfirmedFlightOperationError). No second receipt store exists here.
import { ApiError } from '../../../../web/src/lib/apiClient'
import type { DerivedAck } from '../../../../web/src/lib/derivedState'
import { abandonFlightCreateOperation, ExpiredFlightOperationError, pendingFlightCreateOperation, UnconfirmedFlightOperationError } from '../../../../web/src/lib/flightCreateOperations'
import { createFlights } from '../capture/flight-writes'
import type { ManualFailureKind } from './copy'
import { toFlightInput } from './flight-input'
import { toValues, type FieldValues } from './review-model'

export interface ManualFailure { kind: ManualFailureKind; code: string | null }
export interface ManualRowState {
  /** Stable identity of the row (React key, counted once however often it is retried). */
  key: string
  /** The create operation: its receipt pins one key and payload until the outcome is known. */
  operationId: string
  values: FieldValues
  failure?: ManualFailure
}

export const newManualRow = (values: FieldValues): ManualRowState => ({ key: crypto.randomUUID(), operationId: crypto.randomUUID(), values })

/** Server answers that come from validating the details, before any receipt or write exists. */
const isValidationRefusal = (error: ApiError): boolean =>
  (error.status === 400 || error.status === 422) && !(error.code ?? '').startsWith('IDEMPOTENCY_') && error.code !== 'CSRF'

/**
 * The outcome of a create attempt that threw. `firstAttempt` is true only when no receipt existed before this send,
 * i.e. no earlier attempt of unknown outcome. Only then is a validation refusal proof that nothing was written.
 */
export function classifyManualFailure(error: unknown, firstAttempt: boolean): ManualFailure {
  if (error instanceof UnconfirmedFlightOperationError) return { kind: 'unconfirmed', code: null }
  if (error instanceof ExpiredFlightOperationError) return { kind: 'expired', code: null }
  if (error instanceof ApiError) {
    const code = error.code ?? null
    return { kind: firstAttempt && isValidationRefusal(error) ? 'refused' : 'uncertain', code }
  }
  // Network loss, timeout or abort: the request may have been committed.
  if (error instanceof TypeError || (typeof DOMException !== 'undefined' && error instanceof DOMException)) return { kind: 'uncertain', code: null }
  // Anything else came from preparing the receipt locally (damaged or unwritable): nothing was sent and no safe retry exists.
  return { kind: 'expired', code: null }
}

export interface ManualSaveResult { saved: ManualRowState[]; failures: Map<string, ManualFailure>; acks: DerivedAck[]; rows: Map<string, ManualRowState> }

/** `original` lists rows to send as their stored receipt payload (the explicit "retry the original save"). */
export async function saveManualRows(ownerId: string, rows: ManualRowState[], original: ReadonlySet<string> = new Set(), create: typeof createFlights = createFlights): Promise<ManualSaveResult> {
  const payloads = new Map<string, ReturnType<typeof toFlightInput>>()
  const sent = rows.map(row => {
    const receipt = original.has(row.key) ? pendingFlightCreateOperation(ownerId, row.operationId) : null
    if (!receipt || receipt.expired) return row
    payloads.set(row.key, receipt.body as ReturnType<typeof toFlightInput>)
    // Showing the original payload keeps the row, the summary and the receipt consistent.
    return { ...row, values: toValues(receipt.body as Partial<Record<keyof FieldValues, string>>) }
  })
  // A receipt that exists before the send belongs to an earlier attempt whose outcome may never have been seen.
  const fresh = new Set(sent.filter(row => pendingFlightCreateOperation(ownerId, row.operationId) === null).map(row => row.key))
  const acks: DerivedAck[] = []
  const results = await create(ownerId, sent.map(row => ({ operationId: row.operationId, flight: payloads.get(row.key) ?? toFlightInput(row.values) })), ack => acks.push(ack))
  const saved: ManualRowState[] = []
  const failures = new Map<string, ManualFailure>()
  const next = new Map<string, ManualRowState>()
  sent.forEach((row, index) => {
    const error = results[index]
    if (error === null) { saved.push(row); return }
    const failure = classifyManualFailure(error, fresh.has(row.key))
    failures.set(row.key, failure)
    // Only a validation refusal of a first attempt wrote nothing: free the receipt so the corrected row is a fresh
    // operation instead of a clash. Every other failure keeps the receipt and the operation id.
    if (failure.kind === 'refused') {
      abandonFlightCreateOperation(ownerId, row.operationId)
      next.set(row.key, { ...row, operationId: crypto.randomUUID(), failure })
    } else next.set(row.key, { ...row, failure })
  })
  return { saved, failures, acks, rows: next }
}

/** The member checked the journal: drop the old receipt and give the row a new operation. */
export function startNewOperation(ownerId: string, row: ManualRowState): ManualRowState {
  abandonFlightCreateOperation(ownerId, row.operationId)
  return { key: row.key, operationId: crypto.randomUUID(), values: row.values }
}
