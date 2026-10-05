// Atomic confirmation (ADR 0001 §5, C4): awaiting -> logged by the member, with a receipt that makes the whole
// operation idempotent.
//
// Receipt-first: a known operation id is answered from its receipt before anything else is validated, so a replay
// never depends on the flights still existing or on a fresh candidate token. One D1 batch (one transaction) holds
//   1. INSERT receipt (complete 0, expected N)         - a duplicate operation id aborts the whole batch
//   2. UPDATE flights ... (awaiting only, revision guard)
//   3. UPDATE receipt SET applied_count = changes(), complete = 1
//                                                       - the CHECK (complete = 0 OR applied = expected) aborts the
//                                                         whole batch when any flight was lost to another writer
//   4. the dirty mark
// so the receipt, the flights and the dirty mark commit together or not at all. `changes()` counts the direct
// UPDATE only (never trigger writes), unlike D1's `meta.changes`.
//
// The publication repair runs after the commit. When it fails the response says so (`derivedState: 'pending'`) and
// the receipt keeps no outcome; the next replay of the same operation repairs, freezes the outcome once and returns
// it, without applying anything a second time.
import { HttpError } from '../_lib/http'
import { sha256Hex } from '../_lib/crypto'
import { countryContributions, type EvidenceFlight } from './countryEvidence'
import { dirtyUserStatement, ensureDerivedStateRow, isDerivedReady, repairUserDerivedState, stateOf, type DerivedStateRow } from './derivedState'
import { QUEUE_PAGE_LIMIT, candidateTokenOf, describeAwaiting } from './queue'
import { evidenceFlightsStatement } from './countryEvidence'
import { firstOf, rowsOf } from './stats'

export const MAX_CONFIRM_ITEMS = QUEUE_PAGE_LIMIT
/** Attempts before a persistently moving account gets a retryable conflict. */
const MAX_ATTEMPTS = 4

export interface ConfirmItem {
  flightId: number
  candidateToken: string
  /** Omitted: take the effective default shown in the queue. */
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
  /** Countries this operation's flights pressed. Null when it cannot be told (see `newlyStamped`). */
  newlyStampedCountries: string[] | null
  /** Pending countries after publication; null while publication is pending. */
  pendingCountryCount: number | null
}

const invalid = (message = 'Invalid confirmation request') => new HttpError(400, message, 'INVALID_REQUEST')

export function parseConfirmRequest(body: unknown): ConfirmRequest {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw invalid()
  const { operationId, items } = body as Record<string, unknown>
  if (typeof operationId !== 'string' || operationId.length < 8 || operationId.length > 128) throw invalid('operationId must be 8-128 characters')
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_CONFIRM_ITEMS) throw invalid(`items must hold 1-${MAX_CONFIRM_ITEMS} entries`)
  const seen = new Set<number>()
  const parsed = items.map<ConfirmItem>(entry => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw invalid()
    const { flightId, candidateToken, arrivalTransit } = entry as Record<string, unknown>
    if (typeof flightId !== 'number' || !Number.isSafeInteger(flightId) || flightId <= 0) throw invalid('flightId must be a positive integer')
    if (typeof candidateToken !== 'string' || candidateToken.length === 0 || candidateToken.length > 128) throw invalid('candidateToken required')
    if (arrivalTransit !== undefined && typeof arrivalTransit !== 'boolean') throw invalid('arrivalTransit must be a boolean')
    if (seen.has(flightId)) throw invalid('Duplicate flightId')
    seen.add(flightId)
    return { flightId, candidateToken, ...(arrivalTransit === undefined ? {} : { arrivalTransit }) }
  })
  return { operationId, items: parsed }
}

/** The request identity: the flights and the decisions made, never the tokens (a replay must not need fresh ones). */
const digestOf = (items: ConfirmItem[]) =>
  sha256Hex(JSON.stringify([...items].sort((a, b) => a.flightId - b.flightId).map(item => [item.flightId, item.arrivalTransit ?? null])))

interface Receipt {
  kind: string
  request_digest: string
  complete: number
  pressed_before_json: string | null
  result_json: string | null
}

const receiptStatement = (db: D1Database, userId: string, operationId: string) => db.prepare(
  `SELECT kind, request_digest, complete, pressed_before_json, result_json
   FROM lifecycle_operation_receipts WHERE user_id = ? AND operation_id = ?`,
).bind(userId, operationId)

const isConstraintError = (error: unknown) => /constraint/i.test(error instanceof Error ? error.message : String(error))

interface StoredResult { results: ConfirmedFlight[] }
type FrozenResult = StoredResult & Pick<ConfirmOutcome, 'derivedState' | 'revision' | 'newlyStampedCountries' | 'pendingCountryCount'>

/**
 * Turns a committed receipt into the response. The outcome is frozen once, the first time publication is ready;
 * until then every call reports `pending` and repairs again.
 */
export async function resolveReceipt(db: D1Database, userId: string, operationId: string, receipt: Receipt): Promise<ConfirmOutcome> {
  const stored = JSON.parse(receipt.result_json ?? '{}') as StoredResult & Partial<FrozenResult>
  if (stored.derivedState) return stored as FrozenResult

  let state: DerivedStateRow | null = await stateOf(db, userId)
  if (!state || !isDerivedReady(state)) {
    await repairUserDerivedState(db, userId)
    state = await stateOf(db, userId)
  }
  if (!state || !isDerivedReady(state)) {
    return { results: stored.results, derivedState: 'pending', revision: state?.revision ?? 0, newlyStampedCountries: null, pendingCountryCount: null }
  }
  const [stateNow, flightsRead, evidenceRead] = await db.batch([
    db.prepare('SELECT revision, published_revision, evidence_revision, last_error FROM user_derived_state WHERE user_id = ?').bind(userId),
    evidenceFlightsStatement(db, userId),
    db.prepare('SELECT country_code, status FROM country_visit_evidence WHERE user_id = ?').bind(userId),
  ])
  const current = firstOf<DerivedStateRow>(stateNow)
  if (!current || !isDerivedReady(current)) {
    return { results: stored.results, derivedState: 'pending', revision: current?.revision ?? 0, newlyStampedCountries: null, pendingCountryCount: null }
  }
  const evidence = rowsOf<{ country_code: string; status: 'pressed' | 'pending' }>(evidenceRead)
  const pressedNow = new Set(evidence.filter(row => row.status === 'pressed').map(row => row.country_code))
  const confirmed = new Set(stored.results.map(result => result.flightId))
  // Only countries these flights contribute can be "newly stamped": a claim or another writer's flight that
  // pressed a country in the same window is never credited to this operation.
  const contributed = new Set(countryContributions(rowsOf<EvidenceFlight>(flightsRead)).contributions
    .filter(entry => confirmed.has(entry.flight_id) && entry.state === 'logged').map(entry => entry.country_code))
  const before = receipt.pressed_before_json ? new Set(JSON.parse(receipt.pressed_before_json) as string[]) : null
  const frozen: FrozenResult = {
    results: stored.results,
    derivedState: 'ready',
    revision: current.revision,
    newlyStampedCountries: before ? [...contributed].filter(code => pressedNow.has(code) && !before.has(code)).sort() : null,
    pendingCountryCount: evidence.filter(row => row.status === 'pending').length,
  }
  // First writer wins; every caller returns what was recorded.
  await db.prepare(
    `UPDATE lifecycle_operation_receipts SET result_json = ?
     WHERE user_id = ? AND operation_id = ? AND json_extract(result_json, '$.derivedState') IS NULL`,
  ).bind(JSON.stringify(frozen), userId, operationId).run()
  const row = await receiptStatement(db, userId, operationId).first<Receipt>()
  return JSON.parse(row?.result_json ?? JSON.stringify(frozen)) as FrozenResult
}

async function replay(db: D1Database, userId: string, operationId: string, digest: string, receipt: Receipt): Promise<ConfirmOutcome> {
  if (receipt.kind !== 'confirm' || receipt.request_digest !== digest) {
    throw new HttpError(409, 'Operation id already used for a different request', 'IDEMPOTENCY_CONFLICT', { cause: 'operation_reused' })
  }
  return resolveReceipt(db, userId, operationId, receipt)
}

export async function confirmFlights(
  db: D1Database,
  userId: string,
  request: ConfirmRequest,
  now: Date = new Date(),
): Promise<ConfirmOutcome> {
  const { operationId, items } = request
  const digest = await digestOf(items)
  const instant = now.toISOString()
  let repairTried = false

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const known = await receiptStatement(db, userId, operationId).first<Receipt>()
    if (known) return replay(db, userId, operationId, digest, known)

    await ensureDerivedStateRow(db, userId).run()
    // The "before" set needs a published, current projection. Repair first when it is not; if that fails the
    // confirmation still goes ahead, and newlyStampedCountries is reported as unknown rather than guessed.
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
      // A concurrent identical operation may have committed between the receipt lookup and the validation.
      const late = await receiptStatement(db, userId, operationId).first<Receipt>()
      if (late) return replay(db, userId, operationId, digest, late)
      throw error
    }

    const nonce = crypto.randomUUID()
    const payload = JSON.stringify(plan.decisions)
    try {
      await db.batch([
        db.prepare(
          `INSERT INTO lifecycle_operation_receipts
             (user_id, operation_id, kind, request_digest, batch_nonce, expected_count, applied_count, complete,
              pressed_before_json, result_json, created_at)
           VALUES (?, ?, 'confirm', ?, ?, ?, 0, 0, ?, ?, ?)`,
        ).bind(userId, operationId, digest, nonce, plan.results.length, snapshot.ready ? JSON.stringify(snapshot.pressed) : null, JSON.stringify({ results: plan.results }), instant),
        db.prepare(
          `UPDATE flights SET lifecycle_state = 'logged', is_upcoming = 0, confirmation_source = 'user', confirmed_at = ?,
             arrival_transit = (SELECT json_extract(j.value, '$.transit') FROM json_each(?) j WHERE json_extract(j.value, '$.id') = flights.id),
             arrival_transit_leg_id = (SELECT json_extract(j.value, '$.leg') FROM json_each(?) j WHERE json_extract(j.value, '$.id') = flights.id)
           WHERE user_id = ? AND lifecycle_state = 'awaiting'
             AND id IN (SELECT json_extract(value, '$.id') FROM json_each(?))
             AND EXISTS (SELECT 1 FROM user_derived_state WHERE user_id = ? AND revision = ?)`,
        ).bind(instant, payload, payload, userId, payload, userId, snapshot.revision),
        db.prepare(
          `UPDATE lifecycle_operation_receipts SET applied_count = changes(), complete = 1
           WHERE user_id = ? AND operation_id = ? AND batch_nonce = ?`,
        ).bind(userId, operationId, nonce),
        dirtyUserStatement(db, userId),
      ])
    } catch (error) {
      // A duplicate operation id, a flight another operation took, or a revision that moved under the decisions:
      // the transaction rolled back whole. Look again (receipt first), then decide on fresh state.
      if (!isConstraintError(error)) throw error
      continue
    }
    const receipt = await receiptStatement(db, userId, operationId).first<Receipt>()
    return resolveReceipt(db, userId, operationId, receipt!)
  }
  throw new HttpError(409, 'Your flights are changing right now. Try again.', 'STATE_CONFLICT', { cause: 'concurrent_update' })
}

interface Snapshot {
  flights: EvidenceFlight[]
  revision: number
  ready: boolean
  pressed: string[]
}

async function readSnapshot(db: D1Database, userId: string): Promise<Snapshot> {
  const [state, flights, pressed] = await db.batch([
    db.prepare('SELECT revision, published_revision, evidence_revision, last_error FROM user_derived_state WHERE user_id = ?').bind(userId),
    evidenceFlightsStatement(db, userId),
    db.prepare("SELECT country_code FROM country_visit_evidence WHERE user_id = ? AND status = 'pressed' ORDER BY country_code").bind(userId),
  ])
  const row = firstOf<DerivedStateRow>(state)
  return {
    flights: rowsOf<EvidenceFlight>(flights),
    revision: row?.revision ?? 0,
    ready: !!row && isDerivedReady(row),
    pressed: rowsOf<{ country_code: string }>(pressed).map(entry => entry.country_code),
  }
}

/**
 * Validates every item against the snapshot and decides what each flight stores. Order of precedence, so one
 * request reports one kind of problem: unknown or foreign flight (404, indistinguishable), flights that are not
 * awaiting (409 STATE_CONFLICT with a cause per flight), a connection that changed since the member looked
 * (409 CANDIDATES_CHANGED), then an arrival decision the connection cannot support (400).
 */
async function planConfirmation(items: ConfirmItem[], flights: EvidenceFlight[], instant: string) {
  const byId = new Map(flights.map(flight => [flight.id, flight]))
  if (items.some(item => !byId.has(item.flightId))) throw new HttpError(404, 'Flight not found', 'NOT_FOUND')

  const notAwaiting = items.filter(item => byId.get(item.flightId)!.lifecycle_state !== 'awaiting')
  if (notAwaiting.length > 0) {
    throw new HttpError(409, 'Some flights are no longer awaiting confirmation', 'STATE_CONFLICT', {
      cause: 'not_awaiting',
      items: notAwaiting.map(item => ({ flightId: item.flightId, cause: byId.get(item.flightId)!.lifecycle_state })),
    })
  }

  const views = describeAwaiting(flights)
  const changed: ConfirmItem[] = []
  for (const item of items) {
    if (item.candidateToken !== await candidateTokenOf(byId.get(item.flightId)!, views.get(item.flightId)!)) changed.push(item)
  }
  if (changed.length > 0) {
    throw new HttpError(409, 'The connection for some flights changed. Review them again.', 'CANDIDATES_CHANGED', {
      cause: 'candidates_changed',
      items: changed.map(item => ({ flightId: item.flightId, cause: 'candidates_changed' })),
    })
  }

  const unsupported = items.filter(item => item.arrivalTransit === true && views.get(item.flightId)!.decision?.kind !== 'link')
  if (unsupported.length > 0) {
    throw new HttpError(400, 'Transit needs one unambiguous connecting flight', 'INVALID_ARRIVAL_TRANSIT', {
      items: unsupported.map(item => ({ flightId: item.flightId })),
    })
  }

  const decisions = [...items].sort((a, b) => a.flightId - b.flightId).map(item => {
    const view = views.get(item.flightId)!
    const transit = item.arrivalTransit ?? view.effectiveDefault.transit
    const leg = !transit ? null : item.arrivalTransit === true ? view.candidate.legId : view.effectiveDefault.legId
    return { id: item.flightId, transit: transit ? 1 : 0, leg }
  })
  const results = decisions.map<ConfirmedFlight>(decision => ({
    flightId: decision.id, lifecycleState: 'logged', confirmationSource: 'user', confirmedAt: instant,
    arrivalTransit: decision.transit === 1, arrivalTransitLegId: decision.leg,
  }))
  return { decisions, results }
}
