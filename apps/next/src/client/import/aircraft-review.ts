// Aircraft review after a save: suggestions come from `/api/enrich/aircraft`, accepting goes through
// `/api/flights/aircraft-batch`. The legacy rules are kept: only suggestions at or above 0.7 are offered, all of them
// start selected, and select-all doubles as deselect-all. Every flight keeps its own outcome, and the requests run
// one after another (no parallel fan-out).
import { classifyRequestFailure } from './import-errors'

export const AIRCRAFT_BATCH = 20
export const RELIABLE = 0.7

export interface AircraftTarget { id: number; flight_number: string | null; airline_iata: string | null; date: string; origin: string; destination: string }
export interface EnrichResult { flight_id: string; aircraft_icao: string | null; aircraft_name: string | null; confidence: number; evidence?: string | null; uncertainty?: string | null }
export interface Suggested { flightId: number; icao: string; name: string | null; confidence: number; evidence: string | null; uncertainty: string | null }
/** Why a flight has no offer: the service named nothing, named something it was not sure of, or did not answer for it. */
export interface Unidentified { flightId: number; reason: 'none' | 'low' | 'missing'; confidence: number | null; icao: string | null }

export function diagnose(flightIds: number[], results: EnrichResult[]): { suggested: Suggested[]; unidentified: Unidentified[] } {
  const byId = new Map(results.map(result => [Number(result.flight_id), result]))
  const suggested: Suggested[] = []
  const unidentified: Unidentified[] = []
  for (const flightId of flightIds) {
    const result = byId.get(flightId)
    if (!result) unidentified.push({ flightId, reason: 'missing', confidence: null, icao: null })
    else if (!result.aircraft_icao) unidentified.push({ flightId, reason: 'none', confidence: result.confidence, icao: null })
    else if (result.confidence < RELIABLE) unidentified.push({ flightId, reason: 'low', confidence: result.confidence, icao: result.aircraft_icao })
    else suggested.push({ flightId, icao: result.aircraft_icao, name: result.aircraft_name, confidence: result.confidence, evidence: result.evidence ?? null, uncertainty: result.uncertainty ?? null })
  }
  return { suggested, unidentified }
}

/** Everything selected becomes nothing; anything less becomes everything. */
export const toggleAll = (selected: Set<number>, ids: number[]): Set<number> =>
  ids.length > 0 && ids.every(id => selected.has(id)) ? new Set() : new Set(ids)

export type AircraftBatchItem =
  | { id: number; status: 'accepted'; flight: { id: number; aircraft_icao: string | null } }
  | { id: number | null; status: 'error'; http_status: number; code: string; error: string }
export interface AircraftAccept { results: AircraftBatchItem[]; derived_state?: 'ready' | 'pending'; revision?: number }

export type AircraftOutcome =
  | { status: 'saved'; icao: string | null }
  | { status: 'failed'; code: string; message: string; retryable: boolean }
  /** The answer was lost: the aircraft may or may not have been written. */
  | { status: 'uncertain' }
  | { status: 'unsent' }

export interface AircraftRun {
  rows: Map<number, AircraftOutcome>
  acks: Array<Pick<AircraftAccept, 'derived_state' | 'revision'>>
  uncertain: boolean
}

export const retryableAircraft = (run: AircraftRun): number[] =>
  [...run.rows].filter(([, row]) => row.status === 'uncertain' || row.status === 'unsent' || (row.status === 'failed' && row.retryable)).map(([id]) => id)

export async function acceptAircraft(
  items: Array<{ id: number; aircraft_icao: string }>,
  send: (chunk: Array<{ id: number; aircraft_icao: string }>) => Promise<AircraftAccept>,
): Promise<AircraftRun> {
  const run: AircraftRun = { rows: new Map(items.map(item => [item.id, { status: 'unsent' } as AircraftOutcome])), acks: [], uncertain: false }
  for (let start = 0; start < items.length; start += AIRCRAFT_BATCH) {
    const chunk = items.slice(start, start + AIRCRAFT_BATCH)
    let answer: AircraftAccept
    try { answer = await send(chunk) } catch (error) {
      const { status, code } = classifyRequestFailure(error)
      const maybeCommitted = status === null || status >= 500
      for (const item of chunk) run.rows.set(item.id, maybeCommitted ? { status: 'uncertain' } : { status: 'failed', code: code ?? 'REQUEST_FAILED', message: '', retryable: false })
      if (maybeCommitted) run.uncertain = true
      break
    }
    run.acks.push({ derived_state: answer.derived_state, revision: answer.revision })
    const answered = new Set<number>()
    for (const result of answer.results) {
      if (result.id === null) continue
      answered.add(result.id)
      run.rows.set(result.id, result.status === 'accepted'
        ? { status: 'saved', icao: result.flight.aircraft_icao }
        : { status: 'failed', code: result.code, message: result.error, retryable: result.http_status >= 500 })
    }
    for (const item of chunk) if (!answered.has(item.id)) { run.rows.set(item.id, { status: 'uncertain' }); run.uncertain = true }
  }
  return run
}
