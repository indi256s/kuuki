// Transit cleanup for historical flights (ADR 0001 §4 and §5). A logged `legacy` or `save` flight with no arrival
// decision keeps its destination country (rule 3): nothing reclassifies history on its own. When the same
// calculation that gives awaiting flights a transit default finds an unambiguous third-country connection for
// one, the member may opt in; applying stores `arrival_transit = 1` plus the leg and changes nothing else.
//
// GET is a pure read. POST follows the receipt-first protocol of `confirmation.ts` (shared pieces in
// `receipts.ts`): apply is all or nothing; dismiss records the marker only.
import { HttpError } from '../_lib/http'
import { toOwnFlight, FLIGHT_COLUMNS, type FlightRow } from '../_lib/flights'
import { sha256Hex } from '../_lib/crypto'
import { connectionChains, type ConnectionLeg } from './connections'
import {
  deriveCountryEvidence,
  prospectiveTransit,
  type CountryEvidenceRow,
  type EvidenceFlight,
} from './countryEvidence'
import {
  dirtyUserStatement,
  ensureDerivedStateRow,
  isDerivedReady,
  legacyEvidenceStatement,
  mergeVisits,
  repairUserDerivedState,
  stateOf,
  type DerivedStateRow,
  type LegacyVisitSource,
} from './derivedState'
import { derivedLabelOf, type CandidateView } from './queue'
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

export const MAX_REVIEW_ITEMS = 100

/** Logged by an old writer or a plain save, with no arrival decision yet. */
interface ReviewRow extends EvidenceFlight {
  confirmation_source: string | null
}

const reviewFlightsStatement = (db: D1Database, userId: string) =>
  db
    .prepare(
      `SELECT f.id, f.date, f.origin, f.destination, f.lifecycle_state, f.arrival_transit, f.arrival_transit_leg_id,
          f.departure_utc, f.arrival_utc, f.confirmation_source, o.country_code AS origin_country, o.city AS origin_city,
          d.country_code AS destination_country, d.city AS destination_city
   FROM flights f
   LEFT JOIN airports_reference o ON o.iata = f.origin
   LEFT JOIN airports_reference d ON d.iata = f.destination
   WHERE f.user_id = ?`,
    )
    .bind(userId)

export interface ReviewCandidate {
  flightId: number
  candidate: CandidateView
  candidateToken: string
  /** Countries whose evidence this flight's transit would suppress (the destination and the matched leg's origin). */
  affectedCountries: string[]
}

interface ReviewEligibilityFlight extends ConnectionLeg {
  lifecycle_state: EvidenceFlight['lifecycle_state']
  confirmation_source: string | null
  arrival_transit: number | null
}

const isReviewable = (flight: ReviewEligibilityFlight) =>
  flight.lifecycle_state === 'logged' &&
  (flight.confirmation_source === 'legacy' || flight.confirmation_source === 'save') &&
  flight.arrival_transit === null

function eligibleConnections<T extends ReviewEligibilityFlight>(flights: T[]) {
  const decisions = connectionChains(flights)
  const byId = new Map(flights.map((flight) => [flight.id, flight]))
  return flights.flatMap((flight) => {
    const decision = decisions.get(flight.id)
    if (!isReviewable(flight) || !prospectiveTransit(decision)) return []
    return [{ flight, decision, leg: byId.get(decision.toId)! }]
  })
}

/** Small Journal availability read; details, tokens and stamp simulation stay behind the disclosure. */
export async function readTransitReviewAvailability(
  db: D1Database,
  userId: string,
  flights: ReviewEligibilityFlight[],
) {
  const eligible = eligibleConnections(flights)
  if (!eligible.length) return false
  const marker = await db
    .prepare('SELECT candidate_set_digest FROM transit_cleanup_markers WHERE user_id = ?')
    .bind(userId)
    .first<{ candidate_set_digest: string }>()
  return (
    marker?.candidate_set_digest !==
    (await candidateSetDigest(eligible.map(({ flight }) => flight.id)))
  )
}

/** Every candidate in a snapshot, with the countries a transit decision would suppress. */
export async function reviewCandidates(flights: ReviewRow[]): Promise<ReviewCandidate[]> {
  const out: ReviewCandidate[] = []
  for (const { flight, decision, leg } of eligibleConnections(flights)) {
    const affected = new Set<string>()
    if (flight.destination_country) affected.add(flight.destination_country)
    if (leg.origin_country) affected.add(leg.origin_country)
    out.push({
      flightId: flight.id,
      candidate: {
        kind: 'link',
        label: decision.label,
        legId: decision.toId,
        hubCountry: decision.hubCountry,
        thirdCountry: true,
        candidateIds: [],
        leg: {
          id: leg.id,
          date: leg.date,
          origin: leg.origin,
          destination: leg.destination,
          departure_utc: leg.departure_utc,
          arrival_utc: leg.arrival_utc,
        },
      },
      candidateToken: await reviewTokenOf(flight, decision.toId, decision.label, leg),
      affectedCountries: [...affected].sort(),
    })
  }
  return out
}

/** Per flight, like the queue token: another flight changing never invalidates it. */
const reviewTokenOf = (flight: EvidenceFlight, legId: number, label: string, leg: EvidenceFlight) =>
  sha256Hex(
    JSON.stringify([
      'transit-review-v1',
      flight.id,
      flight.lifecycle_state,
      flight.date,
      flight.origin,
      flight.destination,
      [leg.id, leg.date, leg.origin, leg.departure_utc],
      label,
    ]),
  )

const candidateSetDigest = (flightIds: number[]) => digestOf(flightIds.sort((a, b) => a - b))

interface EvidenceInputs {
  claims: string[]
  ground: Array<{ country_code: string; n: number }>
  legacy: LegacyVisitSource[]
}
const evidenceInputsStatements = (db: D1Database, userId: string) => [
  db.prepare('SELECT DISTINCT country_code FROM country_claims WHERE user_id = ?').bind(userId),
  db
    .prepare(
      'SELECT country_code, COUNT(*) AS n FROM ground_visits WHERE user_id = ? GROUP BY country_code',
    )
    .bind(userId),
  legacyEvidenceStatement(db, userId),
]
const evidenceInputsOf = ([claims, ground, legacy]: D1Result[]): EvidenceInputs => ({
  claims: rowsOf<{ country_code: string }>(claims).map((row) => row.country_code),
  ground: rowsOf<{ country_code: string; n: number }>(ground),
  legacy: rowsOf<LegacyVisitSource>(legacy),
})
const pressedOf = (rows: CountryEvidenceRow[]) =>
  new Set(rows.filter((row) => row.status === 'pressed').map((row) => row.country_code))

export type MarkerStatus = 'dismissed' | 'completed'

/** `GET /api/me/transit-review`. Reads only; the response says which stamps applying everything would remove. */
export async function readTransitReview(db: D1Database, userId: string) {
  const [state, flightsRead, page, marker, ...inputs] = await db.batch([
    db.prepare(STATE_SELECT).bind(userId),
    reviewFlightsStatement(db, userId),
    db
      .prepare(
        `SELECT ${FLIGHT_COLUMNS} FROM flights WHERE user_id = ? AND lifecycle_state = 'logged' AND confirmation_source IN ('legacy', 'save') AND arrival_transit IS NULL`,
      )
      .bind(userId),
    db
      .prepare('SELECT status, candidate_set_digest FROM transit_cleanup_markers WHERE user_id = ?')
      .bind(userId),
    ...evidenceInputsStatements(db, userId),
  ])
  const flights = rowsOf<ReviewRow>(flightsRead)
  const candidates = await reviewCandidates(flights)
  const digest = await candidateSetDigest(candidates.map((candidate) => candidate.flightId))
  const flightRows = new Map(rowsOf<FlightRow>(page).map((row) => [row.id, row]))

  // Apply every candidate in memory and compare pressed countries: a country another flight, a claim, a ground
  // visit or archived evidence still supports is not removed.
  const decided = new Map(
    candidates.map((candidate) => [candidate.flightId, candidate.candidate.legId]),
  )
  const inputsOf = evidenceInputsOf(inputs)
  const simulated = flights.map((flight) =>
    decided.has(flight.id)
      ? { ...flight, arrival_transit: 1, arrival_transit_leg_id: decided.get(flight.id)! }
      : flight,
  )
  const before = pressedOf(deriveCountryEvidence({ flights, ...inputsOf }, mergeVisits).rows)
  const after = pressedOf(
    deriveCountryEvidence({ flights: simulated, ...inputsOf }, mergeVisits).rows,
  )
  const affected = [
    ...new Set(candidates.flatMap((candidate) => candidate.affectedCountries)),
  ].sort()
  const markerRow = firstOf<{ status: MarkerStatus; candidate_set_digest: string }>(marker)
  const derived = firstOf<DerivedStateRow>(state)
  return {
    candidates: candidates.map((candidate) => ({
      flight: toOwnFlight(flightRows.get(candidate.flightId)!),
      candidate: candidate.candidate,
      candidateToken: candidate.candidateToken,
      affectedCountries: candidate.affectedCountries,
    })),
    wouldRemoveStamp: Object.fromEntries(
      affected.map((code) => [code, before.has(code) && !after.has(code)]),
    ),
    marker: markerRow
      ? { status: markerRow.status, matchesCandidates: markerRow.candidate_set_digest === digest }
      : null,
    derivedState: derivedLabelOf(derived),
    revision: derived?.revision ?? 0,
  }
}

export type ReviewAction = 'apply' | 'dismiss'
export interface ReviewRequest {
  operationId: string
  action: ReviewAction
  items: Array<{ flightId: number; candidateToken: string }>
}

export interface ReviewOutcome {
  action: ReviewAction
  results: Array<{ flightId: number; arrivalTransit: true; arrivalTransitLegId: number }>
  derivedState: 'ready' | 'pending'
  revision: number
  /** Countries that lost their stamp because of this operation; null while publication is pending or the before-set is unknown. */
  removedCountries: string[] | null
  pendingCountryCount: number | null
}

const invalid = (message = 'Invalid transit review request') =>
  new HttpError(400, message, 'INVALID_REQUEST')

export function parseReviewRequest(body: unknown): ReviewRequest {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw invalid()
  const { operationId, action, items } = body as Record<string, unknown>
  if (typeof operationId !== 'string' || operationId.length < 8 || operationId.length > 128)
    throw invalid('operationId must be 8-128 characters')
  if (action !== 'apply' && action !== 'dismiss')
    throw invalid("action must be 'apply' or 'dismiss'")
  if (action === 'dismiss') {
    if (items !== undefined && !(Array.isArray(items) && items.length === 0))
      throw invalid('dismiss takes no items')
    return { operationId, action, items: [] }
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_REVIEW_ITEMS)
    throw invalid(`items must hold 1-${MAX_REVIEW_ITEMS} entries`)
  const seen = new Set<number>()
  return {
    operationId,
    action,
    items: items.map((entry) => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw invalid()
      const { flightId, candidateToken } = entry as Record<string, unknown>
      if (typeof flightId !== 'number' || !Number.isSafeInteger(flightId) || flightId <= 0)
        throw invalid('flightId must be a positive integer')
      if (
        typeof candidateToken !== 'string' ||
        candidateToken.length === 0 ||
        candidateToken.length > 128
      )
        throw invalid('candidateToken required')
      if (seen.has(flightId)) throw invalid('Duplicate flightId')
      seen.add(flightId)
      return { flightId, candidateToken }
    }),
  }
}

const requestDigest = (request: ReviewRequest) =>
  digestOf({
    kind: 'transit_review',
    action: request.action,
    flightIds: request.items.map((item) => item.flightId).sort((a, b) => a - b),
  })

interface StoredReview {
  action: ReviewAction
  results: ReviewOutcome['results']
  affectedCountries?: string[]
}

async function resolveReceipt(
  db: D1Database,
  userId: string,
  operationId: string,
  receipt: Receipt,
): Promise<ReviewOutcome> {
  const stored = JSON.parse(receipt.result_json ?? '{}') as StoredReview & Partial<ReviewOutcome>
  if (stored.derivedState) return stored as ReviewOutcome
  const pending = (revision: number): ReviewOutcome => ({
    action: stored.action,
    results: stored.results,
    derivedState: 'pending',
    revision,
    removedCountries: null,
    pendingCountryCount: null,
  })
  if (!(await readyState(db, userId))) return pending((await stateOf(db, userId))?.revision ?? 0)
  const [stateNow, evidenceRead] = await db.batch([
    db.prepare(STATE_SELECT).bind(userId),
    db
      .prepare('SELECT country_code, status FROM country_visit_evidence WHERE user_id = ?')
      .bind(userId),
  ])
  const current = firstOf<DerivedStateRow>(stateNow)
  if (!current || !isDerivedReady(current)) return pending(current?.revision ?? 0)
  const evidence = rowsOf<{ country_code: string; status: 'pressed' | 'pending' }>(evidenceRead)
  const pressedNow = new Set(
    evidence.filter((row) => row.status === 'pressed').map((row) => row.country_code),
  )
  const before = receipt.pressed_before_json
    ? (JSON.parse(receipt.pressed_before_json) as string[])
    : null
  // Only countries these flights' decisions could have suppressed: a claim or flight deleted meanwhile is not credited here.
  const affected = new Set(stored.affectedCountries ?? [])
  return freezeResult(db, userId, operationId, {
    action: stored.action,
    results: stored.results,
    derivedState: 'ready',
    revision: current.revision,
    removedCountries: before
      ? before.filter((code) => affected.has(code) && !pressedNow.has(code)).sort()
      : null,
    pendingCountryCount: evidence.filter((row) => row.status === 'pending').length,
  } satisfies ReviewOutcome)
}

async function replay(
  db: D1Database,
  userId: string,
  operationId: string,
  digest: string,
  receipt: Receipt,
) {
  assertReplayable(receipt, 'transit_review', digest)
  return resolveReceipt(db, userId, operationId, receipt)
}

/** `POST /api/me/transit-review`. */
export async function reviewTransit(
  db: D1Database,
  userId: string,
  request: ReviewRequest,
  now: Date = new Date(),
): Promise<ReviewOutcome> {
  const { operationId, action, items } = request
  const digest = await requestDigest(request)
  const instant = now.toISOString()
  let repairTried = false

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const known = await receiptStatement(db, userId, operationId).first<Receipt>()
    if (known) return replay(db, userId, operationId, digest, known)

    await ensureDerivedStateRow(db, userId).run()
    let snapshot = await readSnapshot(db, userId)
    if (action === 'apply' && !snapshot.ready && !repairTried) {
      repairTried = true
      await repairUserDerivedState(db, userId)
      snapshot = await readSnapshot(db, userId)
    }

    const nonce = crypto.randomUUID()
    const candidates = await reviewCandidates(snapshot.flights)
    const setDigest = await candidateSetDigest(candidates.map((candidate) => candidate.flightId))

    if (action === 'dismiss') {
      // No canonical change: the receipt and the marker commit together, there is nothing to publish.
      const outcome: ReviewOutcome = {
        action,
        results: [],
        derivedState: 'ready',
        revision: snapshot.revision,
        removedCountries: [],
        pendingCountryCount: null,
      }
      try {
        await db.batch([
          db
            .prepare(
              `INSERT INTO lifecycle_operation_receipts
               (user_id, operation_id, kind, request_digest, batch_nonce, expected_count, applied_count, complete, result_json, created_at)
             VALUES (?, ?, 'transit_review', ?, ?, 0, 0, 1, ?, ?)`,
            )
            .bind(userId, operationId, digest, nonce, JSON.stringify(outcome), instant),
          markerStatement(db, userId, 'dismissed', setDigest, instant),
        ])
      } catch (error) {
        if (!isConstraintError(error)) throw error
        continue
      }
      return outcome
    }

    let plan: Awaited<ReturnType<typeof planApply>>
    try {
      plan = planApply(items, snapshot.flights, candidates)
    } catch (error) {
      const late = await receiptStatement(db, userId, operationId).first<Receipt>()
      if (late) return replay(db, userId, operationId, digest, late)
      throw error
    }

    const payload = JSON.stringify(plan.decisions)
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO lifecycle_operation_receipts
             (user_id, operation_id, kind, request_digest, batch_nonce, expected_count, applied_count, complete,
              pressed_before_json, result_json, created_at)
           VALUES (?, ?, 'transit_review', ?, ?, ?, 0, 0, ?, ?, ?)`,
          )
          .bind(
            userId,
            operationId,
            digest,
            nonce,
            plan.results.length,
            snapshot.ready ? JSON.stringify(snapshot.pressed) : null,
            JSON.stringify({
              action,
              results: plan.results,
              affectedCountries: plan.affectedCountries,
            } satisfies StoredReview),
            instant,
          ),
        // Lifecycle, provenance and confirmed_at are left alone: only the arrival decision is recorded.
        db
          .prepare(
            `UPDATE flights SET arrival_transit = 1,
             arrival_transit_leg_id = (SELECT json_extract(j.value, '$.leg') FROM json_each(?) j WHERE json_extract(j.value, '$.id') = flights.id)
           WHERE user_id = ? AND lifecycle_state = 'logged' AND confirmation_source IN ('legacy', 'save') AND arrival_transit IS NULL
             AND id IN (SELECT json_extract(value, '$.id') FROM json_each(?))
             AND EXISTS (SELECT 1 FROM user_derived_state WHERE user_id = ? AND revision = ?)`,
          )
          .bind(payload, userId, payload, userId, snapshot.revision),
        db
          .prepare(
            `UPDATE lifecycle_operation_receipts SET applied_count = changes(), complete = 1
           WHERE user_id = ? AND operation_id = ? AND batch_nonce = ?`,
          )
          .bind(userId, operationId, nonce),
        markerStatement(db, userId, 'completed', setDigest, instant),
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

const markerStatement = (
  db: D1Database,
  userId: string,
  status: MarkerStatus,
  digest: string,
  instant: string,
) =>
  db
    .prepare(
      `INSERT INTO transit_cleanup_markers (user_id, status, candidate_set_digest, updated_at) VALUES (?, ?, ?, ?)
   ON CONFLICT (user_id) DO UPDATE SET status = excluded.status, candidate_set_digest = excluded.candidate_set_digest, updated_at = excluded.updated_at`,
    )
    .bind(userId, status, digest, instant)

interface Snapshot {
  flights: ReviewRow[]
  revision: number
  ready: boolean
  pressed: string[]
}

async function readSnapshot(db: D1Database, userId: string): Promise<Snapshot> {
  const [state, flights, pressed] = await db.batch([
    db.prepare(STATE_SELECT).bind(userId),
    reviewFlightsStatement(db, userId),
    db
      .prepare(
        "SELECT country_code FROM country_visit_evidence WHERE user_id = ? AND status = 'pressed' ORDER BY country_code",
      )
      .bind(userId),
  ])
  const row = firstOf<DerivedStateRow>(state)
  return {
    flights: rowsOf<ReviewRow>(flights),
    revision: row?.revision ?? 0,
    ready: !!row && isDerivedReady(row),
    pressed: rowsOf<{ country_code: string }>(pressed).map((entry) => entry.country_code),
  }
}

/** Precedence as in confirmation: unknown or foreign (404), not reviewable (409 with a cause each), changed (409). */
function planApply(
  items: ReviewRequest['items'],
  flights: ReviewRow[],
  candidates: ReviewCandidate[],
) {
  const byId = new Map(flights.map((flight) => [flight.id, flight]))
  if (items.some((item) => !byId.has(item.flightId)))
    throw new HttpError(404, 'Flight not found', 'NOT_FOUND')

  const causeOf = (flight: ReviewRow): string | null => {
    if (flight.lifecycle_state !== 'logged') return flight.lifecycle_state
    if (flight.confirmation_source !== 'legacy' && flight.confirmation_source !== 'save')
      return 'confirmed_by_member'
    if (flight.arrival_transit !== null) return 'already_decided'
    return null
  }
  const blocked = items
    .map((item) => ({ flightId: item.flightId, cause: causeOf(byId.get(item.flightId)!) }))
    .filter((entry) => entry.cause !== null)
  if (blocked.length > 0)
    throw new HttpError(409, 'Some flights cannot be reviewed', 'STATE_CONFLICT', {
      cause: 'not_reviewable',
      items: blocked,
    })

  const candidateOf = new Map(candidates.map((candidate) => [candidate.flightId, candidate]))
  const changed = items.filter(
    (item) => candidateOf.get(item.flightId)?.candidateToken !== item.candidateToken,
  )
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
  const sorted = [...items]
    .sort((a, b) => a.flightId - b.flightId)
    .map((item) => candidateOf.get(item.flightId)!)
  return {
    decisions: sorted.map((candidate) => ({
      id: candidate.flightId,
      leg: candidate.candidate.legId!,
    })),
    results: sorted.map((candidate) => ({
      flightId: candidate.flightId,
      arrivalTransit: true as const,
      arrivalTransitLegId: candidate.candidate.legId!,
    })),
    affectedCountries: [
      ...new Set(sorted.flatMap((candidate) => candidate.affectedCountries)),
    ].sort(),
  }
}
