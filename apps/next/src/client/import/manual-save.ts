// Saving flights added by hand. It reuses the shared create helper and its receipt (one stored key and payload per
// operation id, `flightCreateOperations`): an uncertain answer keeps the receipt so the unchanged payload replays under
// the same key, a changed payload under that key is refused locally (UnconfirmedFlightOperationError) until the member
// explicitly retries the original or says they checked the journal. A definite refusal wrote nothing, so its receipt is
// dropped and the corrected row gets a new operation. No second receipt store exists here.
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

/** The outcome of a create attempt that threw. Only a 4xx other than 408 is known to have written nothing. */
export function classifyManualFailure(error: unknown): ManualFailure {
  if (error instanceof UnconfirmedFlightOperationError) return { kind: 'unconfirmed', code: null }
  if (error instanceof ExpiredFlightOperationError) return { kind: 'expired', code: null }
  if (error instanceof ApiError) {
    const code = error.code ?? null
    if (error.status === 429) return { kind: 'busy', code }
    if (error.status >= 400 && error.status < 500 && error.status !== 408) return { kind: 'refused', code }
    return { kind: 'uncertain', code }
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
  const acks: DerivedAck[] = []
  const results = await create(ownerId, sent.map(row => ({ operationId: row.operationId, flight: payloads.get(row.key) ?? toFlightInput(row.values) })), ack => acks.push(ack))
  const saved: ManualRowState[] = []
  const failures = new Map<string, ManualFailure>()
  const next = new Map<string, ManualRowState>()
  sent.forEach((row, index) => {
    const error = results[index]
    if (error === null) { saved.push(row); return }
    const failure = classifyManualFailure(error)
    failures.set(row.key, failure)
    // A refusal wrote nothing: free the receipt so the corrected row is a fresh operation instead of a clash.
    if (failure.kind === 'refused' || failure.kind === 'busy') {
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
