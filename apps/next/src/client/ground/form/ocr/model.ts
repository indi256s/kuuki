import { isIsoDate } from '@kuuki/shared/groundTravel'
import { IMPORT_MAX_FILE_BYTES } from '@kuuki/shared/constants'
import type {
  RailCandidateField,
  RailTicketCandidate,
  RailTicketDate,
} from '@kuuki/shared/railTicketOcr'
import { emptyLeg, newId, type LegDraft } from '../model'
import type { StoredOcrRow } from '../rail-editor'

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

export function precheckFile(file: {
  name: string
  type: string
  size: number
}): 'unsupported' | 'too-large' | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = file.type.toLowerCase()
  const supported = type ? SUPPORTED.has(type) : extension in MIME_BY_EXTENSION
  if (!supported) return 'unsupported'
  return file.size > IMPORT_MAX_FILE_BYTES ? 'too-large' : null
}

export interface PreviewDate {
  value: string
  partial: { month: number; day: number } | null
  year: string
}

export interface Preview {
  id: string
  fromStation: string
  toStation: string
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
    fromStation: candidate.fromStation ?? '',
    toStation: candidate.toStation ?? '',
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

export function resolveDate(date: PreviewDate): string {
  if (!date.partial) return date.value
  const year = date.year.trim()
  if (!/^\d{4}$/.test(year)) return ''
  const iso = `${year}-${String(date.partial.month).padStart(2, '0')}-${String(date.partial.day).padStart(2, '0')}`
  return isIsoDate(iso) ? iso : ''
}

export const dateNeedsYear = (date: PreviewDate): boolean =>
  date.partial !== null && resolveDate(date) === ''

export const isUncertain = (preview: Preview, field: RailCandidateField): boolean =>
  preview.uncertain.includes(field)

export function legFromPreview(preview: Preview, base: LegDraft = emptyLeg()): LegDraft {
  const stated = (value: string, old: string) => value.trim() || old
  const city = (printed: string, place: LegDraft['from'], old: string | undefined) =>
    place ? undefined : printed.trim() || old
  return {
    ...base,
    fromCity: city(preview.fromCity, base.from, base.fromCity),
    toCity: city(preview.toCity, base.to, base.toCity),
    fromStation: stated(preview.fromStation, base.fromStation),
    toStation: stated(preview.toStation, base.toStation),
    trainNumber: stated(preview.trainNumber, base.trainNumber),
    operator: stated(preview.operator, base.operator),
    departureDate: resolveDate(preview.departureDate) || base.departureDate,
    arrivalDate: resolveDate(preview.arrivalDate) || base.arrivalDate,
    departureTime: stated(preview.departureTime, base.departureTime),
    arrivalTime: stated(preview.arrivalTime, base.arrivalTime),
  }
}

type RepeatKey = Pick<LegDraft, 'trainNumber' | 'departureDate' | 'fromStation' | 'toStation'>
const norm = (value: string) => value.trim().toLocaleLowerCase()
function repeatKey(leg: RepeatKey): string | null {
  if (norm(leg.fromStation) === '' || norm(leg.toStation) === '') return null
  return [leg.trainNumber, leg.departureDate, leg.fromStation, leg.toStation].map(norm).join('|')
}

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
  file: File | null
  fileName: string
  fileSize: number | null
  status: RowStatus
  previews: Preview[]
  attempt: number
}

export const isSettled = (status: RowStatus): boolean =>
  status !== 'waiting' && status !== 'reading'
export const isRefused = (status: RowStatus): boolean =>
  status === 'too-large' || status === 'unsupported'
export const canRetry = (status: RowStatus): boolean =>
  status === 'failed' || status === 'rate-limited' || status === 'stopped'

export function newRow(file: File): OcrRow {
  const refused = precheckFile(file)
  return {
    id: newId(),
    file,
    fileName: file.name,
    fileSize: file.size,
    status: refused ?? 'waiting',
    previews: [],
    attempt: 0,
  }
}

export const rowFromStored = (stored: StoredOcrRow): OcrRow => ({
  id: stored.id,
  file: null,
  fileName: stored.fileName,
  fileSize: stored.fileSize,
  status: 'found',
  previews: stored.previews,
  attempt: 0,
})

export function unaddedRows(rows: readonly OcrRow[]): StoredOcrRow[] {
  const kept: StoredOcrRow[] = []
  for (const row of rows) {
    const previews = row.previews.filter((preview) => !preview.added)
    if (row.status === 'found' && previews.length > 0)
      kept.push({ id: row.id, fileName: row.fileName, fileSize: row.fileSize, previews })
  }
  return kept
}

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

export const stopRows = (rows: readonly OcrRow[]): OcrRow[] =>
  rows.map((row) =>
    row.status === 'waiting' || row.status === 'reading'
      ? { ...row, status: 'stopped', attempt: row.attempt + 1 }
      : row,
  )

export function startRow(rows: readonly OcrRow[], id: string): OcrRow[] | null {
  const row = rows.find((item) => item.id === id)
  if (!row || row.status !== 'waiting') return null
  return rows.map((item) =>
    item.id === id ? { ...item, status: 'reading', attempt: item.attempt + 1 } : item,
  )
}

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
