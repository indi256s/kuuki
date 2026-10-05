// Saving flights added by hand. It reuses the shared create helper and its receipt (one stored key and payload per
// operation id, `flightCreateOperations`). An operation stays unsettled, with its receipt, operation id and pinned
// payload, until the outcome is known: a 2xx (written or replayed), a definitive validation refusal on an operation
// with no earlier attempt, or the member's explicit "I checked the journal". Everything else (401/403, 408, 409/410
// idempotency answers, 413, 429, 5xx, network loss, or any refusal after an earlier attempt) may have followed a
// committed write, so the receipt stays and the unchanged row replays under the same key. A changed payload under
// that receipt is refused locally (UnconfirmedFlightOperationError). No second receipt store exists here.
import { ApiError } from '../../../../web/src/lib/apiClient'
import type { DerivedAck } from '../../../../web/src/lib/derivedState'
import { abandonFlightCreateOperation, ExpiredFlightOperationError, pendingFlightCreateOperation, pendingFlightCreateOperations, UnconfirmedFlightOperationError } from '../../../../web/src/lib/flightCreateOperations'
import { createFlights, flightCreatePayload } from '../capture/flight-writes'
import type { ManualFailureKind } from './copy'
import { toFlightInput } from './flight-input'
import { toValues, type FieldValues } from './review-model'

export interface ManualFailure {
  kind: ManualFailureKind
  code: string | null
  /** For `duplicate`: the operation id of the unresolved save of the same flight that holds this row back. */
  heldBy?: string
}
export interface ManualRowState {
  /** Stable identity of the row (React key, counted once however often it is retried). */
  key: string
  /** The create operation: its receipt pins one key and payload until the outcome is known. */
  operationId: string
  values: FieldValues
  failure?: ManualFailure
}

/**
 * Manual operation ids are `manual:<scope>:<uuid>`, where the scope is the import batch (or `solo` without one). Recovery
 * does not depend on it: every unresolved receipt of the owner is found whatever its id (see `unconfirmedSaves`).
 */
const MANUAL_PREFIX = 'manual:'
const operationScope = (operationId: string) => operationId.startsWith(MANUAL_PREFIX) ? operationId.slice(0, operationId.lastIndexOf(':') + 1) : ''
const newOperationId = (scope: string) => `${MANUAL_PREFIX}${scope}:${crypto.randomUUID()}`
const rotatedOperationId = (operationId: string) => `${operationScope(operationId) || `${MANUAL_PREFIX}solo:`}${crypto.randomUUID()}`

export const newManualRow = (values: FieldValues, scope = 'solo'): ManualRowState => ({ key: crypto.randomUUID(), operationId: newOperationId(scope), values })

/** An unresolved create of this owner, as the recovery list shows it. */
export interface UnconfirmedSave {
  operationId: string
  /** The flight its receipt pinned; null when the receipt cannot be read. */
  values: FieldValues | null
  /** Past the safe-retry window (or unreadable): only the journal check can settle it. */
  expired: boolean
}

/**
 * Every unresolved create receipt of this owner in this browser, whatever wrote it: a manual row of any import (plain
 * UUID ids from earlier versions, `manual:<scope>:` ids), the add-flight form, or the legacy import's `<run>:<row>` ids.
 * Each is shown once with the payload its receipt pinned. Retrying replays that payload under its own key, so listing
 * a receipt that another screen also owns can never mint a second key; it only lets the member settle it here.
 */
export function unconfirmedSaves(ownerId: string): UnconfirmedSave[] {
  return pendingFlightCreateOperations(ownerId).map(receipt => {
    const body = receipt.body as Partial<Record<keyof FieldValues, unknown>>
    const readable = receipt.key !== '' && typeof body.date === 'string' && typeof body.origin === 'string' && typeof body.destination === 'string'
    return { operationId: receipt.operationId, values: readable ? toValues(body as Partial<Record<keyof FieldValues, string>>) : null, expired: receipt.expired || !readable }
  })
}

/** A create payload in a form that ignores key order and absent-versus-null optional fields. */
const comparable = (payload: object): string =>
  JSON.stringify(Object.entries(payload).filter(([, value]) => value !== null && value !== undefined).sort(([a], [b]) => a.localeCompare(b)))

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
  // A new row must not mint a second key for a flight whose earlier save is still unresolved, whatever wrote that
  // receipt: the identical payload is held back, pointing at that save, until it is settled.
  const unresolved = pendingFlightCreateOperations(ownerId).map(receipt => ({ operationId: receipt.operationId, payload: comparable(receipt.body) }))
  const held = new Map<string, string>()
  for (const row of sent) {
    if (original.has(row.key) || !fresh.has(row.key)) continue
    let payload: string
    try { payload = comparable(flightCreatePayload(toFlightInput(row.values))) } catch { continue }
    const match = unresolved.find(receipt => receipt.operationId !== row.operationId && receipt.payload === payload)
    if (match) held.set(row.key, match.operationId)
  }
  const acks: DerivedAck[] = []
  const sending = sent.filter(row => !held.has(row.key))
  const results = sending.length === 0 ? [] : await create(ownerId, sending.map(row => ({ operationId: row.operationId, flight: payloads.get(row.key) ?? toFlightInput(row.values) })), ack => acks.push(ack))
  const saved: ManualRowState[] = []
  const failures = new Map<string, ManualFailure>()
  const next = new Map<string, ManualRowState>()
  for (const row of sent.filter(item => held.has(item.key))) {
    const failure: ManualFailure = { kind: 'duplicate', code: null, heldBy: held.get(row.key) }
    failures.set(row.key, failure)
    next.set(row.key, { ...row, failure })
  }
  sending.forEach((row, index) => {
    const error = results[index]
    if (error === null) { saved.push(row); return }
    const failure = classifyManualFailure(error, fresh.has(row.key))
    failures.set(row.key, failure)
    // Only a validation refusal of a first attempt wrote nothing: free the receipt so the corrected row is a fresh
    // operation instead of a clash. Every other failure keeps the receipt and the operation id.
    if (failure.kind === 'refused') {
      abandonFlightCreateOperation(ownerId, row.operationId)
      next.set(row.key, { ...row, operationId: rotatedOperationId(row.operationId), failure })
    } else next.set(row.key, { ...row, failure })
  })
  return { saved, failures, acks, rows: next }
}

/** The member checked the journal: drop the old receipt and give the row a new operation. */
export function startNewOperation(ownerId: string, row: ManualRowState): ManualRowState {
  abandonFlightCreateOperation(ownerId, row.operationId)
  return { key: row.key, operationId: rotatedOperationId(row.operationId), values: row.values }
}

/**
 * "Retry original save" for a listed unresolved save: its pinned payload is sent again under its own key. Nothing is
 * rotated or dropped unless the answer is a 2xx; any other answer leaves the receipt for another retry or the journal
 * check. `saved` is false and `failure` null when the receipt is gone already (settled elsewhere).
 */
export async function retryUnconfirmedSave(ownerId: string, operationId: string, create: typeof createFlights = createFlights): Promise<{ saved: boolean; failure: ManualFailure | null; acks: DerivedAck[] }> {
  const receipt = pendingFlightCreateOperation(ownerId, operationId)
  if (!receipt) return { saved: false, failure: null, acks: [] }
  if (receipt.expired) return { saved: false, failure: { kind: 'expired', code: null }, acks: [] }
  const acks: DerivedAck[] = []
  const [error] = await create(ownerId, [{ operationId, flight: receipt.body as ReturnType<typeof toFlightInput> }], ack => acks.push(ack))
  // The receipt existed before this send, so no refusal proves the earlier attempt wrote nothing.
  return error === null ? { saved: true, failure: null, acks } : { saved: false, failure: classifyManualFailure(error, false), acks }
}

/** The member checked the journal for a listed unresolved save: its receipt is dropped and nothing is sent. */
export function settleUnconfirmedSave(ownerId: string, operationId: string): void {
  abandonFlightCreateOperation(ownerId, operationId)
}
