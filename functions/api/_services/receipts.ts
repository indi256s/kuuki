// Shared plumbing for the receipt-first lifecycle operations (confirm, transit review), ADR 0001 §5.
import { HttpError } from '../_lib/http'
import { sha256Hex } from '../_lib/crypto'
import {
  isDerivedReady,
  repairUserDerivedState,
  stateOf,
  type DerivedStateRow,
} from './derivedState'

export type OperationKind = 'confirm' | 'transit_review'

export interface Receipt {
  kind: string
  request_digest: string
  complete: number
  pressed_before_json: string | null
  result_json: string | null
}

/** Attempts before a persistently moving account gets a retryable conflict. */
export const MAX_ATTEMPTS = 4

export const digestOf = (value: unknown) => sha256Hex(JSON.stringify(value))

export const receiptStatement = (db: D1Database, userId: string, operationId: string) =>
  db
    .prepare(
      `SELECT kind, request_digest, complete, pressed_before_json, result_json
   FROM lifecycle_operation_receipts WHERE user_id = ? AND operation_id = ?`,
    )
    .bind(userId, operationId)

/** A duplicate operation id, a CHECK that rolled the batch back, or a revision that moved. Anything else is a real failure. */
export const isConstraintError = (error: unknown) =>
  /constraint/i.test(error instanceof Error ? error.message : String(error))

export const operationReused = () =>
  new HttpError(409, 'Operation id already used for a different request', 'IDEMPOTENCY_CONFLICT', {
    cause: 'operation_reused',
  })

export const concurrentUpdate = () =>
  new HttpError(409, 'Your flights are changing right now. Try again.', 'STATE_CONFLICT', {
    cause: 'concurrent_update',
  })

/** Same-kind, same-digest receipts replay; anything else on a known operation id is a conflict. */
export function assertReplayable(receipt: Receipt, kind: OperationKind, digest: string): void {
  if (receipt.kind !== kind || receipt.request_digest !== digest) throw operationReused()
}

/** Readiness after a repair when one is needed. Null: publication is still pending (the repair failed or lost a race). */
export async function readyState(db: D1Database, userId: string): Promise<DerivedStateRow | null> {
  let state = await stateOf(db, userId)
  if (!state || !isDerivedReady(state)) {
    await repairUserDerivedState(db, userId)
    state = await stateOf(db, userId)
  }
  return state && isDerivedReady(state) ? state : null
}

export const STATE_SELECT =
  'SELECT revision, published_revision, evidence_revision, last_error FROM user_derived_state WHERE user_id = ?'

/** The outcome is recorded once, by whoever gets there first; every caller returns what was recorded. */
export async function freezeResult<T extends { derivedState: string }>(
  db: D1Database,
  userId: string,
  operationId: string,
  outcome: T,
): Promise<T> {
  await db
    .prepare(
      `UPDATE lifecycle_operation_receipts SET result_json = ?
     WHERE user_id = ? AND operation_id = ? AND json_extract(result_json, '$.derivedState') IS NULL`,
    )
    .bind(JSON.stringify(outcome), userId, operationId)
    .run()
  const row = await receiptStatement(db, userId, operationId).first<Receipt>()
  return JSON.parse(row?.result_json ?? JSON.stringify(outcome)) as T
}
