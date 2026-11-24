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

export const MAX_ATTEMPTS = 4

export const digestOf = (value: unknown) => sha256Hex(JSON.stringify(value))

export const receiptStatement = (db: D1Database, userId: string, operationId: string) =>
  db
    .prepare(
      `SELECT kind, request_digest, complete, pressed_before_json, result_json
   FROM lifecycle_operation_receipts WHERE user_id = ? AND operation_id = ?`,
    )
    .bind(userId, operationId)

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

export function assertReplayable(receipt: Receipt, kind: OperationKind, digest: string): void {
  if (receipt.kind !== kind || receipt.request_digest !== digest) throw operationReused()
}

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
