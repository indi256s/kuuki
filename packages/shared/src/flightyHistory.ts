import {
  FLIGHTY_MAX_CHUNKS,
  type FlightyAnswers,
  type FlightyIssue,
  type FlightyIssueCode,
  type FlightyProjection,
} from './flighty'

export const HISTORY_CHUNK_MAX_BYTES = 256 * 1024
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

export type HistoryFindingKind =
  | 'previous_import'
  | 'previous_deleted'
  | 'source_changed'
  | 'existing_flight'
  | 'repeated_in_file'
  | 'new_since_import'

export interface HistoryFinding {
  kind: HistoryFindingKind
  flightId: number | null
  rowId: string | null
}

export type HistoryStoredAnswers = FlightyAnswers & { match?: 'new' | 'link' }

export type HistoryRowAnswers = Omit<FlightyAnswers, 'groups'> & {
  match?: 'new' | 'link'
}

export interface HistoryGroup {
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
  answers: HistoryRowAnswers
  projection: FlightyProjection
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
    action: HistoryAction | null
    flightId: number | null
    ignoreReason: HistoryIgnoreReason | null
    cells: string[] | null
  }>
}
