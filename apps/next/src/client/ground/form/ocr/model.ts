// Pure model of the rail ticket OCR panel: file admission, the per-file row states, editable candidate previews
// and the hand-off to LegDraft. No DOM, no network. Nothing here invents a year, a place or a country.

import { isIsoDate } from '@kuuki/shared/groundTravel'
import { IMPORT_MAX_FILE_BYTES } from '@kuuki/shared/constants'
import type {
  RailCandidateField,
  RailTicketCandidate,
  RailTicketDate,
} from '../../../../../../../functions/api/_services/railTicketOcr'
import { emptyLeg, newId, type LegDraft } from '../model'

export const OCR_MAX_FILES = 10
export const OCR_CONCURRENCY = 2
export const OCR_ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp'

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}
const SUPPORTED = new Set(Object.values(MIME_BY_EXTENSION))

/** Why a file is refused before any request. The server re-checks the real signature either way. */
export function precheckFile(file: {
  name: string
  type: string
  size: number
}): 'unsupported' | 'too-large' | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = file.type.toLowerCase()
  // A declared type that is present and supported wins; an empty one falls back to the extension.
  const supported = type ? SUPPORTED.has(type) : extension in MIME_BY_EXTENSION
  if (!supported) return 'unsupported'
  return file.size > IMPORT_MAX_FILE_BYTES ? 'too-large' : null
}

// ---------------------------------------------------------------------------
// Editable previews
// ---------------------------------------------------------------------------

/** A date as the ticket printed it: whole, partial (month and day only), or absent. */
export interface PreviewDate {
  /** `YYYY-MM-DD` when the ticket stated a year, or once the owner typed one for a partial date. */
  value: string
  partial: { month: number; day: number } | null
  /** What the owner typed for a partial date's missing year. */
  year: string
}

export interface Preview {
  id: string
  fromStation: string
  toStation: string
  /** Cities as printed: shown beside the stations, never turned into a chosen place. */
  fromCity: string
  toCity: string
  trainNumber: string
  operator: string
  departureDate: PreviewDate
  arrivalDate: PreviewDate
  departureTime: string
  arrivalTime: string
  uncertain: readonly RailCandidateField[]
  cancelled: boolean
  otherPassenger: boolean
  /** Part of the next add or replace. Cancelled and other-passenger tickets start unticked. */
  include: boolean
  added: boolean
}

const toPreviewDate = (date: RailTicketDate): PreviewDate =>
  typeof date === 'string'
    ? { value: date, partial: null, year: '' }
    : date
      ? { value: '', partial: { month: date.month, day: date.day }, year: '' }
      : { value: '', partial: null, year: '' }

export function previewFromCandidate(candidate: RailTicketCandidate): Preview {
  const fromCity = candidate.fromCity ?? ''
  const toCity = candidate.toCity ?? ''
  const flagged = candidate.cancelled === true || candidate.otherPassenger === true
  return {
    id: newId(),
    // City text goes in only when the station is absent; the place itself is still chosen by the owner.
    fromStation: candidate.fromStation ?? fromCity,
    toStation: candidate.toStation ?? toCity,
    fromCity,
    toCity,
    trainNumber: candidate.trainNumber ?? '',
    operator: candidate.operator ?? '',
    departureDate: toPreviewDate(candidate.departureDate),
    arrivalDate: toPreviewDate(candidate.arrivalDate),
    departureTime: candidate.departureTime ?? '',
    arrivalTime: candidate.arrivalTime ?? '',
    uncertain: candidate.uncertain,
    cancelled: candidate.cancelled === true,
    otherPassenger: candidate.otherPassenger === true,
    include: !flagged,
    added: false,
  }
}

/** The date to put in the form: the stated or completed ISO date, or '' while a partial date has no valid year. */
export function resolveDate(date: PreviewDate): string {
  if (!date.partial) return date.value
  const year = date.year.trim()
  if (!/^\d{4}$/.test(year)) return ''
  const iso = `${year}-${String(date.partial.month).padStart(2, '0')}-${String(date.partial.day).padStart(2, '0')}`
  return isIsoDate(iso) ? iso : ''
}

/** A partial date whose year is still missing or does not make a real day. */
export const dateNeedsYear = (date: PreviewDate): boolean =>
  date.partial !== null && resolveDate(date) === ''

/** Fields shown with "Check this": what the model marked unclear. A partial date is flagged by its own year prompt. */
export const isUncertain = (preview: Preview, field: RailCandidateField): boolean =>
  preview.uncertain.includes(field)

export function legFromPreview(preview: Preview): LegDraft {
  return {
    ...emptyLeg(),
    fromStation: preview.fromStation.trim(),
    toStation: preview.toStation.trim(),
    trainNumber: preview.trainNumber.trim(),
    operator: preview.operator.trim(),
    departureDate: resolveDate(preview.departureDate),
    arrivalDate: resolveDate(preview.arrivalDate),
    departureTime: preview.departureTime.trim(),
    arrivalTime: preview.arrivalTime.trim(),
  }
}

// ---------------------------------------------------------------------------
// Possible repeats
// ---------------------------------------------------------------------------

type RepeatKey = Pick<LegDraft, 'trainNumber' | 'departureDate' | 'fromStation' | 'toStation'>
const norm = (value: string) => value.trim().toLocaleLowerCase()
function repeatKey(leg: RepeatKey): string | null {
  // Without both stations nothing distinguishes two tickets, so nothing is called a repeat.
  if (norm(leg.fromStation) === '' || norm(leg.toStation) === '') return null
  return [leg.trainNumber, leg.departureDate, leg.fromStation, leg.toStation].map(norm).join('|')
}

/**
 * Ids of previews that look like a leg already in the form or an earlier preview (same train number, date and
 * stations). Marked, never removed: a repeat of one ticket and two similar tickets are the owner's call.
 */
export function findRepeats(
  previews: readonly Preview[],
  formLegs: readonly RepeatKey[],
): Set<string> {
  const seen = new Set<string>()
  for (const leg of formLegs) {
    const key = repeatKey(leg)
    if (key) seen.add(key)
  }
  const repeats = new Set<string>()
  for (const preview of previews) {
    const key = repeatKey(legFromPreview(preview))
    if (!key) continue
    if (seen.has(key)) repeats.add(preview.id)
    else seen.add(key)
  }
  return repeats
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type RowStatus =
  | 'waiting'
  | 'reading'
  | 'found'
  | 'none'
  | 'too-large'
  | 'unsupported'
  | 'failed'
  | 'rate-limited'
  | 'stopped'

export interface OcrRow {
  id: string
  file: File
  status: RowStatus
  previews: Preview[]
  /** Counts attempts so an answer to an older attempt (before Stop or Retry) is recognised and dropped. */
  attempt: number
}

export const isSettled = (status: RowStatus): boolean =>
  status !== 'waiting' && status !== 'reading'
/** Refused before any request; only Remove helps. */
export const isRefused = (status: RowStatus): boolean =>
  status === 'too-large' || status === 'unsupported'
export const canRetry = (status: RowStatus): boolean =>
  status === 'failed' || status === 'rate-limited' || status === 'stopped'

export function newRow(file: File): OcrRow {
  const refused = precheckFile(file)
  return { id: newId(), file, status: refused ?? 'waiting', previews: [], attempt: 0 }
}

/** How a failed request maps to a row status. */
export function statusForFailure(error: unknown): RowStatus {
  const failure = error as { status?: unknown; code?: unknown } | null
  const status = typeof failure?.status === 'number' ? failure.status : 0
  const code = typeof failure?.code === 'string' ? failure.code : ''
  if (status === 429) return 'rate-limited'
  if (status === 413 || code === 'PAYLOAD_TOO_LARGE') return 'too-large'
  if (status === 415 || code === 'UNSUPPORTED_FILE_TYPE') return 'unsupported'
  if (code === 'NO_TRAINS_FOUND') return 'none'
  return 'failed'
}

/** Stop: nothing new starts and whatever is running is let go. Rows that already have an answer stay. */
export const stopRows = (rows: readonly OcrRow[]): OcrRow[] =>
  rows.map((row) =>
    row.status === 'waiting' || row.status === 'reading'
      ? { ...row, status: 'stopped', attempt: row.attempt + 1 }
      : row,
  )

/** Starts a row's request. Returns null when the row is not waiting any more. */
export function startRow(rows: readonly OcrRow[], id: string): OcrRow[] | null {
  const row = rows.find((item) => item.id === id)
  if (!row || row.status !== 'waiting') return null
  return rows.map((item) =>
    item.id === id ? { ...item, status: 'reading', attempt: item.attempt + 1 } : item,
  )
}

/** Applies an answer only if the row is still reading that exact attempt. */
export function settleRow(
  rows: readonly OcrRow[],
  id: string,
  attempt: number,
  outcome: { candidates: RailTicketCandidate[] } | { status: RowStatus },
): OcrRow[] {
  return rows.map((row) => {
    if (row.id !== id || row.status !== 'reading' || row.attempt !== attempt) return row
    if ('status' in outcome) return { ...row, status: outcome.status }
    return outcome.candidates.length === 0
      ? { ...row, status: 'none' }
      : { ...row, status: 'found', previews: outcome.candidates.map(previewFromCandidate) }
  })
}

/** Back to waiting for another request, keeping the file and dropping any earlier previews. */
export const retryRow = (rows: readonly OcrRow[], id: string): OcrRow[] =>
  rows.map((row) =>
    row.id === id && canRetry(row.status)
      ? { ...row, status: 'waiting', previews: [], attempt: row.attempt + 1 }
      : row,
  )

export const hasUnclear = (row: OcrRow): boolean =>
  row.previews.some(
    (preview) =>
      preview.uncertain.length > 0 ||
      dateNeedsYear(preview.departureDate) ||
      dateNeedsYear(preview.arrivalDate),
  )

export function patchPreview(
  rows: readonly OcrRow[],
  previewId: string,
  patch: Partial<Preview>,
): OcrRow[] {
  return rows.map((row) =>
    row.previews.some((preview) => preview.id === previewId)
      ? {
          ...row,
          previews: row.previews.map((preview) =>
            preview.id === previewId ? { ...preview, ...patch } : preview,
          ),
        }
      : row,
  )
}

/** Previews in the order the files were chosen, then in the order each file listed them. */
export const allPreviews = (rows: readonly OcrRow[]): Preview[] =>
  rows.flatMap((row) => row.previews)

export function markAdded(rows: readonly OcrRow[], ids: ReadonlySet<string>): OcrRow[] {
  return rows.map((row) => ({
    ...row,
    previews: row.previews.map((preview) =>
      ids.has(preview.id) ? { ...preview, added: true, include: false } : preview,
    ),
  }))
}

export async function fileToBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let start = 0; start < bytes.length; start += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000))
  return btoa(binary)
}
