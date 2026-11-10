// One rule for a history row's state (ADR 0008): the server maps the verbatim cells with the owner's answers, then
// applies the match finding. Admission, answers, group answers and confirmation all call this, so a row can never be
// `ready` on one path and not on another.
import { mapFlightyRecord, type FlightyCandidate } from '../../../packages/shared/src/flighty'
import type {
  HistoryAction,
  HistoryFinding,
  HistoryRowState,
  HistoryStoredAnswers,
} from '../../../packages/shared/src/flightyHistory'
import { catalogFlightyRefs } from './flightyRefs'

export interface Evaluation {
  candidate: FlightyCandidate
  state: Extract<HistoryRowState, 'ready' | 'needs_review' | 'error'>
  action: HistoryAction | null
  /** For `link`: the flight to attach to (null for a repeat of a preserved-only record). */
  linkFlightId: number | null
  /** For `create`: the owner said this differs from the specific flight or record the finding names. */
  acknowledged: boolean
}

/** A finding that blocks until the owner answers `match`. */
const DECIDE: ReadonlySet<HistoryFinding['kind']> = new Set([
  'previous_deleted',
  'source_changed',
  'existing_flight',
  'repeated_in_file',
  'new_since_import',
])

/** Findings that name a reviewed conflict: answering `new` waives the SQL same-date-and-route guard for them only. */
const NAMES_CONFLICT: ReadonlySet<HistoryFinding['kind']> = new Set([
  'previous_deleted',
  'source_changed',
  'existing_flight',
  'repeated_in_file',
])

export function evaluateRow(
  headers: string[],
  record: { ordinal: number; line: number; cells: string[] },
  answers: HistoryStoredAnswers,
  finding: HistoryFinding | null,
): Evaluation {
  const candidate = mapFlightyRecord(record, headers, catalogFlightyRefs, answers)
  const base = { candidate, linkFlightId: null, acknowledged: false }
  if (candidate.issues.some((issue) => issue.code === 'EMPTY_RECORD'))
    return { ...base, state: 'error', action: null }
  // An exact repeat of an earlier confirmed record is already accounted for, whatever this mapping still asks.
  if (finding?.kind === 'previous_import')
    return { ...base, state: 'ready', action: 'link', linkFlightId: finding.flightId }
  if (candidate.action === 'preserve_only')
    return { ...base, state: 'ready', action: 'preserve_only' }
  if (candidate.issues.length) return { ...base, state: 'needs_review', action: 'create' }
  if (finding && DECIDE.has(finding.kind)) {
    if (answers.match === 'new')
      return {
        ...base,
        state: 'ready',
        action: 'create',
        acknowledged: NAMES_CONFLICT.has(finding.kind),
      }
    if (
      answers.match === 'link' &&
      finding.flightId !== null &&
      finding.kind !== 'previous_deleted'
    )
      return { ...base, state: 'ready', action: 'link', linkFlightId: finding.flightId }
    return { ...base, state: 'needs_review', action: 'create' }
  }
  return { ...base, state: 'ready', action: 'create' }
}
