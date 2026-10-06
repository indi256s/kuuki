// The awaiting queue (ADR 0001 §5, C4): the member's completed-but-unconfirmed flights with the connection
// candidate and effective default each one would get, and a candidate token that pins what the member saw.
//
// Everything here is derived from `connectionChains` and `effectiveArrivalPolicies` over one evidence snapshot,
// the same calculation the repair publishes, so the queue, Passport and Overview cannot disagree about a default.
import { sha256Hex } from '../_lib/crypto'
import { toOwnFlight, FLIGHT_COLUMNS, type FlightRow } from '../_lib/flights'
import { connectionChains, type ConnectionDecision } from './connections'
import { effectiveArrivalPolicies, evidenceFlightsStatement, type ArrivalPolicy, type EvidenceFlight } from './countryEvidence'
import { isDerivedReady, type DerivedStateRow } from './derivedState'
import { firstOf, rowsOf } from './stats'

/** The queue shows this many awaiting flights at once; the counts are exact. A confirmation takes at most the same. */
export const QUEUE_PAGE_LIMIT = 100
export const DRAFT_SUMMARY_LIMIT = 20

export interface CandidateView {
  kind: ConnectionDecision['kind']
  label: 'precise' | 'estimated' | 'ambiguous' | null
  legId: number | null
  hubCountry: string | null
  thirdCountry: boolean
  /** Competing outgoing legs when the connection is ambiguous (review only: never suppresses a country). */
  candidateIds: number[]
  leg: { id: number; date: string; origin: string; destination: string; departure_utc: string | null; arrival_utc: string | null } | null
}

export interface AwaitingView {
  decision: ConnectionDecision | undefined
  candidate: CandidateView
  effectiveDefault: ArrivalPolicy
}

/** Candidate and default of every awaiting flight in an evidence snapshot (all states, so upcoming legs can connect). */
export function describeAwaiting(flights: EvidenceFlight[]): Map<number, AwaitingView> {
  const decisions = connectionChains(flights)
  const policies = effectiveArrivalPolicies(flights, decisions)
  const byId = new Map(flights.map(flight => [flight.id, flight]))
  const views = new Map<number, AwaitingView>()
  for (const flight of flights) {
    if (flight.lifecycle_state !== 'awaiting') continue
    const decision = decisions.get(flight.id)
    const leg = decision?.kind === 'link' ? byId.get(decision.toId) : undefined
    views.set(flight.id, {
      decision,
      candidate: {
        kind: decision?.kind ?? 'none',
        label: decision?.kind === 'link' ? decision.label : decision?.kind === 'ambiguous' ? 'ambiguous' : null,
        legId: decision?.kind === 'link' ? decision.toId : null,
        hubCountry: decision?.kind === 'link' ? decision.hubCountry : null,
        thirdCountry: decision?.kind === 'link' ? decision.thirdCountry : false,
        candidateIds: decision?.kind === 'ambiguous' ? decision.candidateIds : [],
        leg: leg ? { id: leg.id, date: leg.date, origin: leg.origin, destination: leg.destination, departure_utc: leg.departure_utc, arrival_utc: leg.arrival_utc } : null,
      },
      effectiveDefault: policies.get(flight.id) ?? { transit: false, source: 'existing', legId: null, label: null },
    })
  }
  return views
}

/**
 * Pins what the member saw for one flight: its own route and connection decision, the matched leg's route and
 * the default that follows. Another flight changing never invalidates it; a change to this connection does.
 */
export function candidateTokenOf(flight: EvidenceFlight, view: AwaitingView): Promise<string> {
  const { decision, candidate, effectiveDefault } = view
  return sha256Hex(JSON.stringify([
    'candidate-v1', flight.id, flight.lifecycle_state, flight.date, flight.origin, flight.destination,
    candidate.kind, candidate.label, candidate.legId, candidate.hubCountry, candidate.thirdCountry, candidate.candidateIds,
    candidate.leg ? [candidate.leg.id, candidate.leg.date, candidate.leg.origin, candidate.leg.destination, candidate.leg.departure_utc] : null,
    decision?.kind === 'link' ? [decision.startCountry, decision.finalCountry] : null,
    effectiveDefault.transit, effectiveDefault.legId, effectiveDefault.source,
  ]))
}

export type DerivedStateLabel = 'ready' | 'pending' | 'error'
export const derivedLabelOf = (state: DerivedStateRow | null | undefined): DerivedStateLabel =>
  !state || isDerivedReady(state) ? 'ready' : state.last_error ? 'error' : 'pending'

export interface DraftSummary {
  batchId: string
  sourceType: string
  sourceLabel: string | null
  status: string
  reviewRowCount: number
  expiresAt: string
}

/** Everything `GET /api/me/awaiting` returns. Reads only: no write, no repair, no due transition. */
export async function readAwaitingQueue(db: D1Database, userId: string, now = new Date()) {
  const instant = now.toISOString()
  const [state, evidenceFlights, page, awaitingCount, batches, draftCount] = await db.batch([
    db.prepare('SELECT revision, published_revision, evidence_revision, last_error FROM user_derived_state WHERE user_id = ?').bind(userId),
    evidenceFlightsStatement(db, userId),
    db.prepare(
      `SELECT ${FLIGHT_COLUMNS} FROM flights WHERE user_id = ? AND lifecycle_state = 'awaiting' ORDER BY date DESC, id DESC LIMIT ?`,
    ).bind(userId, QUEUE_PAGE_LIMIT),
    db.prepare("SELECT COUNT(*) AS n FROM flights WHERE user_id = ? AND lifecycle_state = 'awaiting'").bind(userId),
    db.prepare(
      `SELECT b.id, b.source_type, b.source_label, b.status, b.expires_at,
              (SELECT COUNT(*) FROM import_drafts d WHERE d.batch_id = b.id AND d.user_id = b.user_id AND d.status = 'review') AS review_rows
       FROM import_batches b
       WHERE b.user_id = ? AND b.expires_at > ? AND b.status IN ('processing', 'review', 'partial', 'cancelled')
         AND (b.status = 'processing' OR EXISTS (SELECT 1 FROM import_drafts d WHERE d.batch_id = b.id AND d.user_id = b.user_id AND d.status = 'review'))
       ORDER BY b.created_at DESC, b.id LIMIT ?`,
    ).bind(userId, instant, DRAFT_SUMMARY_LIMIT),
    db.prepare(
      `SELECT COUNT(*) AS n FROM import_drafts d JOIN import_batches b ON b.id = d.batch_id AND b.user_id = d.user_id
       WHERE d.user_id = ? AND d.status = 'review' AND b.expires_at > ?`,
    ).bind(userId, instant),
  ])
  const derived = firstOf<DerivedStateRow>(state)
  const views = describeAwaiting(rowsOf<EvidenceFlight>(evidenceFlights))
  const evidenceById = new Map(rowsOf<EvidenceFlight>(evidenceFlights).map(flight => [flight.id, flight]))
  const awaitingFlights = await Promise.all(rowsOf<FlightRow>(page).map(async row => {
    const flight = evidenceById.get(row.id)!
    const view = views.get(row.id)!
    return { flight: toOwnFlight(row), candidate: view.candidate, effectiveDefault: view.effectiveDefault, candidateToken: await candidateTokenOf(flight, view) }
  }))
  const awaitingFlightCount = firstOf<{ n: number }>(awaitingCount)?.n ?? 0
  const draftRowCount = firstOf<{ n: number }>(draftCount)?.n ?? 0
  return {
    awaitingFlights,
    drafts: rowsOf<{ id: string; source_type: string; source_label: string | null; status: string; expires_at: string; review_rows: number }>(batches)
      .map<DraftSummary>(row => ({ batchId: row.id, sourceType: row.source_type, sourceLabel: row.source_label, status: row.status, reviewRowCount: row.review_rows, expiresAt: row.expires_at })),
    awaitingFlightCount,
    draftRowCount,
    actionableCount: awaitingFlightCount + draftRowCount,
    derivedState: derivedLabelOf(derived),
    revision: derived?.revision ?? 0,
  }
}
