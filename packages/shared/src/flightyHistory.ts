// HTTP contract of `/api/import/history` (ADR 0008), shared by the API and the browser.
import {
  FLIGHTY_MAX_CHUNKS,
  type FlightyAnswers,
  type FlightyIssue,
  type FlightyIssueCode,
  type FlightyProjection,
} from './flighty'

export const HISTORY_CHUNK_MAX_BYTES = 256 * 1024
/** Serialized rows one run may store: every chunk the manifest allows, at the request cap. */
export const HISTORY_STORED_MAX_BYTES = FLIGHTY_MAX_CHUNKS * HISTORY_CHUNK_MAX_BYTES
export const HISTORY_PAGE_MAX = 50
export const HISTORY_CONFIRM_MAX = 50
export const HISTORY_OPEN_RUNS_MAX = 3

export type HistoryRunStatus = 'receiving' | 'review' | 'completed' | 'closed'
export type HistoryRowState =
  | 'ready'
  | 'needs_review'
  | 'error'
  | 'created'
  | 'duplicate'
  | 'preserved_only'
  | 'ignored'
  | 'removed'
export const HISTORY_ROW_STATES: readonly HistoryRowState[] = [
  'ready',
  'needs_review',
  'error',
  'created',
  'duplicate',
  'preserved_only',
  'ignored',
  'removed',
]
export type HistoryAction = 'create' | 'preserve_only' | 'link'
export type HistoryIgnoreReason = 'owner' | 'discarded' | 'expired'

/** What the server found when it compared a record with the journal and earlier imports. */
export type HistoryFindingKind =
  /** Identical to a record confirmed in an earlier import: linked, nothing new is written. */
  | 'previous_import'
  /** Identical or same-ID record whose flight the owner deleted: never re-created silently. */
  | 'previous_deleted'
  /** Same Flighty ID or same date/route/number as an earlier import, but the record changed. */
  | 'source_changed'
  /** An owned flight already has this date and route. */
  | 'existing_flight'
  /** Another record in this file has the same date and route. */
  | 'repeated_in_file'
  /** Unmatched while an earlier Flighty import exists: added only on an explicit decision. */
  | 'new_since_import'

export interface HistoryFinding {
  kind: HistoryFindingKind
  /** The flight a `link` would attach to, when there is exactly one. */
  flightId: number | null
  /** The earlier import row, for previous_import / previous_deleted / source_changed. */
  rowId: string | null
}

/** What a row stores: row answers, group answers and the `match` decision. */
export type HistoryStoredAnswers = FlightyAnswers & { match?: 'new' | 'link' }

/** Row-level answers. Group answers are set through `POST …/groups`, never here. */
export type HistoryRowAnswers = Omit<FlightyAnswers, 'groups'> & {
  /** How to settle a finding: add as a new flight, or link to the found one. */
  match?: 'new' | 'link'
}

export interface HistoryGroup {
  /** `airline:<token>`, `airport:<token>`, `canceled:<token>`, `match:new_since_import`, `match:existing_flight`. */
  group: string
  code: FlightyIssueCode | HistoryFindingKind
  token: string
  candidates: string[]
  rows: number
}

export interface HistoryRunSummary {
  id: string
  status: HistoryRunStatus
  profile: string
  createdAt: string
  expiresAt: string
  sourceErased: boolean
  revision: number
  generation: number
  headers: string[]
  unknownHeaders: string[]
  totals: {
    records: number
    received: number
    blankLines: number
    states: Record<HistoryRowState, number>
  }
  chunks: { total: number; missing: number[] }
  groups: HistoryGroup[]
}

export interface HistoryRowView {
  id: string
  ordinal: number
  line: number
  state: HistoryRowState
  version: number
  action: HistoryAction | null
  ignoreReason: HistoryIgnoreReason | null
  flightId: number | null
  issues: FlightyIssue[]
  finding: HistoryFinding | null
  /** Row-level answers; shared group answers are not sent. */
  answers: HistoryRowAnswers
  projection: FlightyProjection
  /** Non-empty source cells by header, owner-only; null once erased. */
  fields: Record<string, string> | null
}

export interface HistoryPage {
  run: HistoryRunSummary
  rows: HistoryRowView[]
  nextCursor: number | null
}

export interface HistoryCreateBody {
  operationId: string
  profile: string
  headers: string[]
  totalRecords: number
  blankLines: number
  chunks: Array<{ count: number; digest: string }>
}

export interface HistoryChunkBody {
  /** `[ordinal, line, cells]` per record, as `flightyChunkPayload` serializes them. */
  records: Array<[number, number, string[]]>
}

export interface HistoryConfirmItem {
  rowId: string
  version: number
  key: string
}

export type HistoryConfirmResult =
  | {
      rowId: string
      key: string
      status: 'created' | 'duplicate' | 'preserved_only' | 'replayed'
      state: HistoryRowState
      flightId: number | null
    }
  | {
      rowId: string
      key: string
      status: 'error'
      http_status: number
      code: string
      error: string
    }

export interface HistoryArchive {
  provider: 'flighty'
  profile: string
  runId: string
  createdAt: string
  sourceErased: boolean
  headers: string[]
  records: Array<{
    ordinal: number
    line: number
    state: HistoryRowState
    /** create = a flight was created; link = an existing flight; preserve_only = kept, never a flight. */
    action: HistoryAction | null
    flightId: number | null
    ignoreReason: HistoryIgnoreReason | null
    cells: string[] | null
  }>
}
