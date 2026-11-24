import { ApiError } from '@kuuki/client/apiClient'
import type { DerivedAck } from '@kuuki/client/derivedState'
import {
  abandonFlightCreateOperation,
  ExpiredFlightOperationError,
  SettledFlightOperationError,
  pendingFlightCreateOperation,
  pendingFlightCreateOperations,
  UnconfirmedFlightOperationError,
} from '@kuuki/client/flightCreateOperations'
import {
  createFlights,
  flightCreatePayload,
  isFlightValidationRefusal,
} from '../capture/flight-writes'
import type { ManualFailureKind } from './copy'
import { toFlightInput } from './flight-input'
import { toValues, type FieldValues } from './review-model'

export interface ManualFailure {
  kind: ManualFailureKind
  code: string | null
  heldBy?: string
}
export interface ManualRowState {
  key: string
  operationId: string
  values: FieldValues
  retryKey?: string
  failure?: ManualFailure
}

const MANUAL_PREFIX = 'manual:'
const operationScope = (operationId: string) =>
  operationId.startsWith(MANUAL_PREFIX)
    ? operationId.slice(0, operationId.lastIndexOf(':') + 1)
    : ''
const newOperationId = (scope: string) => `${MANUAL_PREFIX}${scope}:${crypto.randomUUID()}`
const rotatedOperationId = (operationId: string) =>
  `${operationScope(operationId) || `${MANUAL_PREFIX}solo:`}${crypto.randomUUID()}`

export const newManualRow = (values: FieldValues, scope = 'solo'): ManualRowState => ({
  key: crypto.randomUUID(),
  operationId: newOperationId(scope),
  values,
})

export interface UnconfirmedSave {
  operationId: string
  values: FieldValues | null
  expired: boolean
  retryKey: string
}

export function unconfirmedSaves(ownerId: string): UnconfirmedSave[] {
  return pendingFlightCreateOperations(ownerId).map((receipt) => {
    const body = receipt.body as Partial<Record<keyof FieldValues, unknown>>
    const readable =
      receipt.key !== '' &&
      typeof body.date === 'string' &&
      typeof body.origin === 'string' &&
      typeof body.destination === 'string' &&
      ['airline_iata', 'aircraft_icao', 'flight_number', 'departure_time', 'arrival_time'].every(
        (field) =>
          body[field as keyof FieldValues] == null ||
          typeof body[field as keyof FieldValues] === 'string',
      )
    return {
      operationId: receipt.operationId,
      values: readable ? toValues(body as Partial<Record<keyof FieldValues, string>>) : null,
      expired: receipt.expired || !readable,
      retryKey: receipt.key,
    }
  })
}

export const flightIdentity = (payload: object): string | null => {
  const body = payload as Record<string, unknown>
  if (
    ![body.date, body.origin, body.destination].every(
      (value) => typeof value === 'string' && value.trim() !== '',
    )
  )
    return null
  return JSON.stringify([
    String(body.date).trim(),
    String(body.origin).trim().toUpperCase(),
    String(body.destination).trim().toUpperCase(),
  ])
}

export function classifyManualFailure(error: unknown, firstAttempt: boolean): ManualFailure {
  if (error instanceof SettledFlightOperationError) return { kind: 'settled', code: null }
  if (error instanceof UnconfirmedFlightOperationError) return { kind: 'unconfirmed', code: null }
  if (error instanceof ExpiredFlightOperationError) return { kind: 'expired', code: null }
  if (error instanceof ApiError) {
    const code = error.code ?? null
    return {
      kind: firstAttempt && isFlightValidationRefusal(error) ? 'refused' : 'uncertain',
      code,
    }
  }
  if (
    error instanceof TypeError ||
    (typeof DOMException !== 'undefined' && error instanceof DOMException)
  )
    return { kind: 'uncertain', code: null }
  return { kind: 'expired', code: null }
}

export interface ManualSaveResult {
  saved: ManualRowState[]
  failures: Map<string, ManualFailure>
  acks: DerivedAck[]
  rows: Map<string, ManualRowState>
}

export async function saveManualRows(
  ownerId: string,
  rows: ManualRowState[],
  original: ReadonlySet<string> = new Set(),
  create: typeof createFlights = createFlights,
): Promise<ManualSaveResult> {
  const retryKeys = new Map<string, string>()
  const payloads = new Map<string, ReturnType<typeof toFlightInput>>()
  const sent = rows.map((row) => {
    const receipt = original.has(row.key)
      ? pendingFlightCreateOperation(ownerId, row.operationId)
      : null
    if (
      row.failure?.kind === 'duplicate' &&
      row.failure.heldBy &&
      !pendingFlightCreateOperation(ownerId, row.failure.heldBy)
    )
      retryKeys.set(row.key, '')
    if (
      original.has(row.key) ||
      (row.failure && row.failure.kind !== 'refused' && row.failure.kind !== 'duplicate')
    )
      retryKeys.set(
        row.key,
        row.retryKey ??
          receipt?.key ??
          pendingFlightCreateOperation(ownerId, row.operationId)?.key ??
          '',
      )
    if (!receipt || receipt.expired) return row
    payloads.set(row.key, receipt.body as ReturnType<typeof toFlightInput>)
    return { ...row, values: toValues(receipt.body as Partial<Record<keyof FieldValues, string>>) }
  })
  const fresh = new Set(
    sent
      .filter((row) => pendingFlightCreateOperation(ownerId, row.operationId) === null)
      .map((row) => row.key),
  )
  const unresolved = pendingFlightCreateOperations(ownerId).map((receipt) => ({
    operationId: receipt.operationId,
    payload: flightIdentity(receipt.body),
  }))
  const held = new Map<string, string>()
  for (const row of sent) {
    if (original.has(row.key) || !fresh.has(row.key)) continue
    let payload: string | null
    try {
      payload = flightIdentity(flightCreatePayload(toFlightInput(row.values)))
    } catch {
      continue
    }
    if (payload === null) continue
    const match = unresolved.find(
      (receipt) => receipt.operationId !== row.operationId && receipt.payload === payload,
    )
    if (match) held.set(row.key, match.operationId)
  }
  const acks: DerivedAck[] = []
  const sending = sent.filter((row) => !held.has(row.key))
  const results =
    sending.length === 0
      ? []
      : await create(
          ownerId,
          sending.map((row) => ({
            operationId: row.operationId,
            retryKey: retryKeys.get(row.key),
            flight: payloads.get(row.key) ?? toFlightInput(row.values),
          })),
          (ack) => acks.push(ack),
        )
  const saved: ManualRowState[] = []
  const failures = new Map<string, ManualFailure>()
  const next = new Map<string, ManualRowState>()
  for (const row of sent.filter((item) => held.has(item.key))) {
    const failure: ManualFailure = { kind: 'duplicate', code: null, heldBy: held.get(row.key) }
    failures.set(row.key, failure)
    next.set(row.key, { ...row, failure })
  }
  sending.forEach((row, index) => {
    const error = results[index]
    if (error === null) {
      saved.push(row)
      return
    }
    const failure = classifyManualFailure(error, fresh.has(row.key))
    failures.set(row.key, failure)
    if (failure.kind === 'refused') {
      abandonFlightCreateOperation(ownerId, row.operationId)
      next.set(row.key, { ...row, operationId: rotatedOperationId(row.operationId), failure })
    } else
      next.set(row.key, {
        ...row,
        retryKey:
          retryKeys.get(row.key) ?? pendingFlightCreateOperation(ownerId, row.operationId)?.key,
        failure,
      })
  })
  return { saved, failures, acks, rows: next }
}

export function startNewOperation(ownerId: string, row: ManualRowState): ManualRowState {
  abandonFlightCreateOperation(ownerId, row.operationId)
  return { key: row.key, operationId: rotatedOperationId(row.operationId), values: row.values }
}

export async function retryUnconfirmedSave(
  ownerId: string,
  operationId: string,
  create: typeof createFlights = createFlights,
  retryKey?: string,
): Promise<{ saved: boolean; failure: ManualFailure | null; acks: DerivedAck[] }> {
  const receipt = pendingFlightCreateOperation(ownerId, operationId)
  if (!receipt || (retryKey !== undefined && receipt.key !== retryKey))
    return { saved: false, failure: { kind: 'settled', code: null }, acks: [] }
  if (receipt.expired) return { saved: false, failure: { kind: 'expired', code: null }, acks: [] }
  const acks: DerivedAck[] = []
  const [error] = await create(
    ownerId,
    [
      {
        operationId,
        retryKey: retryKey ?? receipt.key,
        flight: receipt.body as ReturnType<typeof toFlightInput>,
      },
    ],
    (ack) => acks.push(ack),
  )
  return error === null
    ? { saved: true, failure: null, acks }
    : { saved: false, failure: classifyManualFailure(error, false), acks }
}

export function settleUnconfirmedSave(ownerId: string, operationId: string): void {
  abandonFlightCreateOperation(ownerId, operationId)
}
