// Wire types of the server-owned import batch (ADR 0001 §6/§9). They mirror `functions/api/_services/importDrafts.ts`
// and `importConversion.ts`; the client keeps its own copy so the Next bundle never imports Worker code.

export type BatchStatus = 'processing' | 'review' | 'partial' | 'failed' | 'cancelled' | 'completed'
export type BatchStage = 'accepted' | 'recognizing' | 'validating' | 'review_ready'
export type DraftStatus = 'review' | 'dismissed' | 'converted'

export interface DraftFields {
  date: string
  origin: string
  destination: string
  airline_iata: string
  flight_number?: string
  aircraft_icao?: string
  departure_time?: string
  arrival_time?: string
  airline_was_placeholder?: boolean
}

export interface Draft {
  id: string
  ordinal: number
  status: DraftStatus
  version: number
  fields: DraftFields
  confidence: number | null
  fieldConfidence: Record<string, number> | null
  yearExplicit: boolean
  yearConfirmed: boolean
  selected: boolean
  edited: boolean
  duplicateAcknowledged: boolean
  convertedFlightId: number | null
  duplicateFlightId: number | null
  issue: { code: string; message: string } | null
  /** Only rendered when the server actually supplies a verified source snippet (none does today). */
  snippet?: string | null
}

export interface Batch {
  id: string
  sourceType: 'pdf' | 'image' | 'text'
  sourceLabel: string | null
  status: BatchStatus
  stage: BatchStage | null
  sequence: number
  errorCode: string | null
  retryAfter: string | null
  createdAt: string
  updatedAt: string
  expiresAt: string
  expired: boolean
}

export interface Snapshot { batch: Batch; drafts: Draft[] }

/** `{sequence,rowIds}` rows event, `snapshot` instruction (optionally `reupload`), or the terminal `end` event. */
export interface ImportEvent {
  name: string
  sequence: number
  rowIds: string[]
  snapshot: boolean
  reupload: boolean
  status?: string
}

export interface DraftPatchBody {
  version: number
  fields?: Record<string, string | null>
  selected?: boolean
  yearConfirmed?: boolean
  duplicateAcknowledged?: boolean
  dismissed?: boolean
}

export type ConfirmItemResult =
  | { draftId: string; key: string; status: 'created' | 'replayed'; flight: { id: number; aircraft_icao: string | null; origin: string; destination: string; date: string; airline_iata?: string | null; flight_number?: string | null } }
  | { draftId: string; key: string; status: 'error'; http_status: number; code: string; error: string; flightId?: number }

export interface ConfirmResponse {
  results: ConfirmItemResult[]
  batch: { id: string; status: BatchStatus | 'deleted'; sequence: number; reviewRowCount: number }
  derived_state?: 'ready' | 'pending'
  revision?: number
}

export interface UnfinishedImport {
  batchId: string
  sourceType: string
  sourceLabel: string | null
  status: string
  reviewRowCount: number
  expiresAt: string
}
