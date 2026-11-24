import { HttpError } from '../_lib/http'
import { evidenceFlightsStatement, type EvidenceFlight } from './countryEvidence'
import { pressedCountriesStatement, readPublishedStamps } from './newlyStamped'
import {
  dirtyUserStatement,
  ensureDerivedStateRow,
  isDerivedReady,
  repairUserDerivedState,
  stateOf,
  type DerivedStateRow,
} from './derivedState'
import { QUEUE_PAGE_LIMIT, candidateTokenOf, describeAwaiting } from './queue'
import {
  MAX_ATTEMPTS,
  STATE_SELECT,
  assertReplayable,
  concurrentUpdate,
  digestOf,
  freezeResult,
  isConstraintError,
  readyState,
  receiptStatement,
  type Receipt,
} from './receipts'
import { firstOf, rowsOf } from './stats'

export const MAX_CONFIRM_ITEMS = QUEUE_PAGE_LIMIT
export interface ConfirmItem {
  flightId: number
  candidateToken: string
  arrivalTransit?: boolean
}

export interface ConfirmRequest {
  operationId: string
  items: ConfirmItem[]
}

export interface ConfirmedFlight {
  flightId: number
  lifecycleState: 'logged'
  confirmationSource: 'user'
  confirmedAt: string
  arrivalTransit: boolean
  arrivalTransitLegId: number | null
}

export interface ConfirmOutcome {
  results: ConfirmedFlight[]
  derivedState: 'ready' | 'pending'
  revision: number
  newlyStampedCountries: string[] | null
  pendingCountryCount: number | null
}

const invalid = (message = 'Invalid confirmation request') =>
  new HttpError(400, message, 'INVALID_REQUEST')

export function parseConfirmRequest(body: unknown): ConfirmRequest {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw invalid()
  const { operationId, items } = body as Record<string, unknown>
  if (typeof operationId !== 'string' || operationId.length < 8 || operationId.length > 128)
    throw invalid('operationId must be 8-128 characters')
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_CONFIRM_ITEMS)
    throw invalid(`items must hold 1-${MAX_CONFIRM_ITEMS} entries`)
  const seen = new Set<number>()
  const parsed = items.map<ConfirmItem>((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw invalid()
    const { flightId, candidateToken, arrivalTransit } = entry as Record<string, unknown>
    if (typeof flightId !== 'number' || !Number.isSafeInteger(flightId) || flightId <= 0)
      throw invalid('flightId must be a positive integer')
    if (
      typeof candidateToken !== 'string' ||
      candidateToken.length === 0 ||
      candidateToken.length > 128
    )
      throw invalid('candidateToken required')
    if (arrivalTransit !== undefined && typeof arrivalTransit !== 'boolean')
      throw invalid('arrivalTransit must be a boolean')
    if (seen.has(flightId)) throw invalid('Duplicate flightId')
    seen.add(flightId)
    return { flightId, candidateToken, ...(arrivalTransit === undefined ? {} : { arrivalTransit }) }
  })
  return { operationId, items: parsed }
}

const requestDigest = (items: ConfirmItem[]) =>
  digestOf({
    kind: 'confirm',
    items: [...items]
      .sort((a, b) => a.flightId - b.flightId)
      .map((item) => [item.flightId, item.arrivalTransit ?? null]),
  })

interface StoredResult {
  results: ConfirmedFlight[]
}
type FrozenResult = StoredResult &
  Pick<
    ConfirmOutcome,
    'derivedState' | 'revision' | 'newlyStampedCountries' | 'pendingCountryCount'
  >

export async function resolveReceipt(
  db: D1Database,
  userId: string,
  operationId: string,
  receipt: Receipt,
): Promise<ConfirmOutcome> {
  const stored = JSON.parse(receipt.result_json ?? '{}') as StoredResult & Partial<FrozenResult>
  if (stored.derivedState) return stored as FrozenResult

  const pending = (revision: number): ConfirmOutcome => ({
    results: stored.results,
    derivedState: 'pending',
    revision,
    newlyStampedCountries: null,
    pendingCountryCount: null,
  })
  if (!(await readyState(db, userId))) return pending((await stateOf(db, userId))?.revision ?? 0)
  const before = receipt.pressed_before_json
    ? (JSON.parse(receipt.pressed_before_json) as string[])
    : null
  const published = await readPublishedStamps(db, userId, before)
  if (!published.ready) return pending(published.revision)
  return freezeResult(db, userId, operationId, {
    results: stored.results,
    derivedState: 'ready',
    revision: published.revision,
    newlyStampedCountries: published.newlyStamped(stored.results.map((result) => result.flightId)),
    pendingCountryCount: published.pendingCountryCount,
  } satisfies FrozenResult)
}

async function replay(
  db: D1Database,
  userId: string,
  operationId: string,
  digest: string,
  receipt: Receipt,
): Promise<ConfirmOutcome> {
  assertReplayable(receipt, 'confirm', digest)
  return resolveReceipt(db, userId, operationId, receipt)
}

export async function confirmFlights(
  db: D1Database,
  userId: string,
  request: ConfirmRequest,
  now: Date = new Date(),
): Promise<ConfirmOutcome> {
  const { operationId, items } = request
  const digest = await requestDigest(items)
  const instant = now.toISOString()
  let repairTried = false

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const known = await receiptStatement(db, userId, operationId).first<Receipt>()
    if (known) return replay(db, userId, operationId, digest, known)

    await ensureDerivedStateRow(db, userId).run()
    let snapshot = await readSnapshot(db, userId)
    if (!snapshot.ready && !repairTried) {
      repairTried = true
      await repairUserDerivedState(db, userId)
      snapshot = await readSnapshot(db, userId)
    }

    let plan: Awaited<ReturnType<typeof planConfirmation>>
    try {
      plan = await planConfirmation(items, snapshot.flights, instant)
    } catch (error) {
      const late = await receiptStatement(db, userId, operationId).first<Receipt>()
      if (late) return replay(db, userId, operationId, digest, late)
      throw error
    }

    const nonce = crypto.randomUUID()
    const payload = JSON.stringify(plan.decisions)
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO lifecycle_operation_receipts
             (user_id, operation_id, kind, request_digest, batch_nonce, expected_count, applied_count, complete,
              pressed_before_json, result_json, created_at)
           VALUES (?, ?, 'confirm', ?, ?, ?, 0, 0, ?, ?, ?)`,
          )
          .bind(
            userId,
            operationId,
            digest,
            nonce,
            plan.results.length,
            snapshot.ready ? JSON.stringify(snapshot.pressed) : null,
            JSON.stringify({ results: plan.results }),
            instant,
          ),
        db
          .prepare(
            `UPDATE flights SET lifecycle_state = 'logged', is_upcoming = 0, confirmation_source = 'user', confirmed_at = ?,
             arrival_transit = (SELECT json_extract(j.value, '$.transit') FROM json_each(?) j WHERE json_extract(j.value, '$.id') = flights.id),
             arrival_transit_leg_id = (SELECT json_extract(j.value, '$.leg') FROM json_each(?) j WHERE json_extract(j.value, '$.id') = flights.id)
           WHERE user_id = ? AND lifecycle_state = 'awaiting'
             AND id IN (SELECT json_extract(value, '$.id') FROM json_each(?))
             AND EXISTS (SELECT 1 FROM user_derived_state WHERE user_id = ? AND revision = ?)`,
          )
          .bind(instant, payload, payload, userId, payload, userId, snapshot.revision),
        db
          .prepare(
            `UPDATE lifecycle_operation_receipts SET applied_count = changes(), complete = 1
           WHERE user_id = ? AND operation_id = ? AND batch_nonce = ?`,
          )
          .bind(userId, operationId, nonce),
        dirtyUserStatement(db, userId),
      ])
    } catch (error) {
      if (!isConstraintError(error)) throw error
      continue
    }
    const receipt = await receiptStatement(db, userId, operationId).first<Receipt>()
    return resolveReceipt(db, userId, operationId, receipt!)
  }
  throw concurrentUpdate()
}

interface Snapshot {
  flights: EvidenceFlight[]
  revision: number
  ready: boolean
  pressed: string[]
}

async function readSnapshot(db: D1Database, userId: string): Promise<Snapshot> {
  const [state, flights, pressed] = await db.batch([
    db.prepare(STATE_SELECT).bind(userId),
    evidenceFlightsStatement(db, userId),
    pressedCountriesStatement(db, userId),
  ])
  const row = firstOf<DerivedStateRow>(state)
  return {
    flights: rowsOf<EvidenceFlight>(flights),
    revision: row?.revision ?? 0,
    ready: !!row && isDerivedReady(row),
    pressed: rowsOf<{ country_code: string }>(pressed).map((entry) => entry.country_code),
  }
}

async function planConfirmation(items: ConfirmItem[], flights: EvidenceFlight[], instant: string) {
  const byId = new Map(flights.map((flight) => [flight.id, flight]))
  if (items.some((item) => !byId.has(item.flightId)))
    throw new HttpError(404, 'Flight not found', 'NOT_FOUND')

  const notAwaiting = items.filter(
    (item) => byId.get(item.flightId)!.lifecycle_state !== 'awaiting',
  )
  if (notAwaiting.length > 0) {
    throw new HttpError(409, 'Some flights are no longer awaiting confirmation', 'STATE_CONFLICT', {
      cause: 'not_awaiting',
      items: notAwaiting.map((item) => ({
        flightId: item.flightId,
        cause: byId.get(item.flightId)!.lifecycle_state,
      })),
    })
  }

  const views = describeAwaiting(flights)
  const changed: ConfirmItem[] = []
  for (const item of items) {
    if (
      item.candidateToken !==
      (await candidateTokenOf(byId.get(item.flightId)!, views.get(item.flightId)!))
    )
      changed.push(item)
  }
  if (changed.length > 0) {
    throw new HttpError(
      409,
      'The connection for some flights changed. Review them again.',
      'CANDIDATES_CHANGED',
      {
        cause: 'candidates_changed',
        items: changed.map((item) => ({ flightId: item.flightId, cause: 'candidates_changed' })),
      },
    )
  }

  const unsupported = items.filter(
    (item) => item.arrivalTransit === true && views.get(item.flightId)!.decision?.kind !== 'link',
  )
  if (unsupported.length > 0) {
    throw new HttpError(
      400,
      'Transit needs one unambiguous connecting flight',
      'INVALID_ARRIVAL_TRANSIT',
      {
        items: unsupported.map((item) => ({ flightId: item.flightId })),
      },
    )
  }

  const decisions = [...items]
    .sort((a, b) => a.flightId - b.flightId)
    .map((item) => {
      const view = views.get(item.flightId)!
      const transit = item.arrivalTransit ?? view.effectiveDefault.transit
      const leg = !transit
        ? null
        : item.arrivalTransit === true
          ? view.candidate.legId
          : view.effectiveDefault.legId
      return { id: item.flightId, transit: transit ? 1 : 0, leg }
    })
  const results = decisions.map<ConfirmedFlight>((decision) => ({
    flightId: decision.id,
    lifecycleState: 'logged',
    confirmationSource: 'user',
    confirmedAt: instant,
    arrivalTransit: decision.transit === 1,
    arrivalTransitLegId: decision.leg,
  }))
  return { decisions, results }
}
