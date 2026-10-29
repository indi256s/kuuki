import { AIRCRAFT_BATCH_SIZE } from '@kuuki/shared/constants'
// Aircraft review after a save: suggestions come from `/api/enrich/aircraft`, accepting goes through
// `/api/flights/aircraft-batch`. Only suggestions at or above 0.7 are offered; older responses without a basis
// start selected. Select-all doubles as deselect-all. Every flight keeps its own outcome, and the requests run
// one after another (no parallel fan-out).
import { formatNumber, type Locale } from '../../lib/format'
import { AIRCRAFT_RESULT as S } from './aircraft-result-copy'
import { classifyRequestFailure } from './import-errors'

export const AIRCRAFT_BATCH = AIRCRAFT_BATCH_SIZE
export const RELIABLE = 0.7

export interface AircraftTarget {
  id: number
  flight_number: string | null
  airline_iata: string | null
  date: string
  origin: string
  destination: string
}
export interface EnrichResult {
  flight_id: string
  aircraft_icao: string | null
  aircraft_name: string | null
  confidence: number
  evidence?: string | null
  uncertainty?: string | null
  sources?: Array<{ url: string; title: string }>
  equipment_basis?: 'actual' | 'scheduled' | 'unknown'
  evidence_date?: string | null
  registration?: string | null
  operating_airline?: string | null
}
export interface Suggested {
  flightId: number
  icao: string
  name: string | null
  confidence: number
  evidence: string | null
  uncertainty: string | null
  sources: Array<{ url: string; title: string }>
  equipmentBasis?: 'actual' | 'scheduled' | 'unknown'
  evidenceDate: string | null
  registration: string | null
  operatingAirline: string | null
}
/** Why a flight has no offer: the service named nothing, named something it was not sure of, or did not answer for it. */
export interface Unidentified {
  flightId: number
  reason: 'none' | 'low' | 'missing'
  confidence: number | null
  icao: string | null
}

export function diagnose(
  flightIds: number[],
  results: EnrichResult[],
): { suggested: Suggested[]; unidentified: Unidentified[] } {
  const byId = new Map(results.map((result) => [Number(result.flight_id), result]))
  const suggested: Suggested[] = []
  const unidentified: Unidentified[] = []
  for (const flightId of flightIds) {
    const result = byId.get(flightId)
    if (!result) unidentified.push({ flightId, reason: 'missing', confidence: null, icao: null })
    else if (!result.aircraft_icao)
      unidentified.push({ flightId, reason: 'none', confidence: result.confidence, icao: null })
    else if (result.confidence < RELIABLE)
      unidentified.push({
        flightId,
        reason: 'low',
        confidence: result.confidence,
        icao: result.aircraft_icao,
      })
    else
      suggested.push({
        flightId,
        icao: result.aircraft_icao,
        name: result.aircraft_name,
        confidence: result.confidence,
        evidence: result.evidence ?? null,
        uncertainty: result.uncertainty ?? null,
        sources: result.sources ?? [],
        equipmentBasis: result.equipment_basis,
        evidenceDate: result.evidence_date ?? null,
        registration: result.registration ?? null,
        operatingAirline: result.operating_airline ?? null,
      })
  }
  return { suggested, unidentified }
}

/** Everything selected becomes nothing; anything less becomes everything. */
export const toggleAll = (selected: Set<number>, ids: number[]): Set<number> =>
  ids.length > 0 && ids.every((id) => selected.has(id)) ? new Set() : new Set(ids)

export type AircraftBatchItem =
  | { id: number; status: 'accepted'; flight: { id: number; aircraft_icao: string | null } }
  | { id: number | null; status: 'error'; http_status: number; code: string; error: string }
export interface AircraftAccept {
  results: AircraftBatchItem[]
  derived_state?: 'ready' | 'pending'
  revision?: number
}

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
  [...run.rows]
    .filter(
      ([, row]) =>
        row.status === 'uncertain' ||
        row.status === 'unsent' ||
        (row.status === 'failed' && row.retryable),
    )
    .map(([id]) => id)

export async function acceptAircraft(
  items: Array<{ id: number; aircraft_icao: string }>,
  send: (chunk: Array<{ id: number; aircraft_icao: string }>) => Promise<AircraftAccept>,
): Promise<AircraftRun> {
  const run: AircraftRun = {
    rows: new Map(items.map((item) => [item.id, { status: 'unsent' } as AircraftOutcome])),
    acks: [],
    uncertain: false,
  }
  for (let start = 0; start < items.length; start += AIRCRAFT_BATCH) {
    const chunk = items.slice(start, start + AIRCRAFT_BATCH)
    let answer: AircraftAccept
    try {
      answer = await send(chunk)
    } catch (error) {
      const { status, code } = classifyRequestFailure(error)
      const maybeCommitted = status === null || status >= 500
      for (const item of chunk)
        run.rows.set(
          item.id,
          maybeCommitted
            ? { status: 'uncertain' }
            : { status: 'failed', code: code ?? 'REQUEST_FAILED', message: '', retryable: false },
        )
      if (maybeCommitted) run.uncertain = true
      break
    }
    run.acks.push({ derived_state: answer.derived_state, revision: answer.revision })
    const answered = new Set<number>()
    for (const result of answer.results) {
      if (result.id === null) continue
      answered.add(result.id)
      run.rows.set(
        result.id,
        result.status === 'accepted'
          ? { status: 'saved', icao: result.flight.aircraft_icao }
          : {
              status: 'failed',
              code: result.code,
              message: result.error,
              retryable: result.http_status >= 500,
            },
      )
    }
    for (const item of chunk)
      if (!answered.has(item.id)) {
        run.rows.set(item.id, { status: 'uncertain' })
        run.uncertain = true
      }
  }
  return run
}

export interface AircraftRunCounts {
  saved: number
  failed: number
  uncertain: number
}

export const countAircraftRun = (rows: Iterable<AircraftOutcome>): AircraftRunCounts => {
  const counts = { saved: 0, failed: 0, uncertain: 0 }
  for (const row of rows)
    if (row.status === 'saved' || row.status === 'failed' || row.status === 'uncertain')
      counts[row.status] += 1
  return counts
}

/** One sentence for a finished submission. Nothing saved is a problem, so callers send it to an assertive region; anything saved goes to a polite one. */
export const summarizeAircraftRun = (locale: Locale, counts: AircraftRunCounts | null): string =>
  !counts
    ? ''
    : [
        counts.saved > 0 && `${S.aircraftSavedTag[locale]}: ${formatNumber(locale, counts.saved)}`,
        counts.failed > 0 &&
          `${S.aircraftFailedTag[locale]}: ${formatNumber(locale, counts.failed)}`,
        counts.uncertain > 0 &&
          `${S.aircraftUncertainTag[locale]}: ${formatNumber(locale, counts.uncertain)}`,
      ]
        .filter(Boolean)
        .join(' · ') + (counts.uncertain > 0 ? `. ${S.aircraftUncertainNote[locale]}` : '')
