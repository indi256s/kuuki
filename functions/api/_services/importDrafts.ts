// Server-owned import drafts (ADR 0001 §6): batch creation under the owner limits, the fenced draft writer shared
// by the synchronous endpoint and (later) the import job, snapshot reads with full-history duplicate matching, draft
// edits and discard. Conversion lives in `importConversion.ts`.
//
// Never stored: uploaded bytes, base64, pasted text, provider responses, `raw_text`. A draft holds only the
// extracted flight fields and bounded confidence numbers.
import { HttpError } from '../_lib/http'
import { isCalendarDate, validateFlightInput, type FlightInput } from '../../../packages/shared/src/flightValidation'
import { parseFlightBodies } from '../_lib/flightValidation'
import type { EnrichmentStatus, ExtractedFlight } from '../import/_shared'
import { findDuplicateMatches, type DuplicateCandidate } from './duplicates'

export const MAX_DRAFTS_PER_BATCH = 100
/** Open batches (processing, review, partial) an owner may hold; finished ones no longer count. */
export const MAX_OPEN_BATCHES = 10
export const BATCH_TTL_DAYS = 30
/** Provider deadline (90 s) plus validation and the write; past it the maintenance sweep treats the job as dead. */
export const PROCESSING_WINDOW_MS = 120_000
const DAY_MS = 24 * 60 * 60 * 1000

export type BatchStatus = 'processing' | 'review' | 'partial' | 'failed' | 'cancelled' | 'completed'
export type SourceType = 'pdf' | 'image' | 'text'

/** The extracted flight fields a draft persists (`fields_json`). Optional fields are absent, never null or empty. */
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
  enrichment_status?: EnrichmentStatus
}

const OPTIONAL_TEXT = ['flight_number', 'aircraft_icao', 'departure_time', 'arrival_time'] as const
const FIELD_NAMES = ['date', 'origin', 'destination', 'airline_iata', ...OPTIONAL_TEXT] as const
const clamp = (value: unknown, max: number) => typeof value === 'string' && value ? value.slice(0, max) : undefined

/** Project an extracted flight onto the stored fields; strings are bounded so `fields_json` stays far below its CHECK. */
export function draftFieldsOf(flight: ExtractedFlight): DraftFields {
  const fields: DraftFields = {
    date: clamp(flight.date, 10) ?? '',
    origin: clamp(flight.origin, 3) ?? '',
    destination: clamp(flight.destination, 3) ?? '',
    airline_iata: clamp(flight.airline_iata, 2) ?? '',
  }
  const flightNumber = clamp(flight.flight_number, 20)
  const aircraft = clamp(flight.aircraft_icao, 8)
  const departure = clamp(flight.departure_time, 8)
  const arrival = clamp(flight.arrival_time, 8)
  if (flightNumber) fields.flight_number = flightNumber
  if (aircraft) fields.aircraft_icao = aircraft
  if (departure) fields.departure_time = departure
  if (arrival) fields.arrival_time = arrival
  if (flight.airline_was_placeholder === true) fields.airline_was_placeholder = true
  if (flight.enrichment_status) fields.enrichment_status = flight.enrichment_status
  return fields
}

/** The create input a draft converts with. Empty optional fields are left out; validation is the shared one. */
export function draftToFlightInput(fields: DraftFields): FlightInput {
  return {
    date: fields.date,
    origin: fields.origin,
    destination: fields.destination,
    ...(fields.airline_iata ? { airline_iata: fields.airline_iata } : {}),
    ...(fields.flight_number ? { flight_number: fields.flight_number } : {}),
    ...(fields.aircraft_icao ? { aircraft_icao: fields.aircraft_icao } : {}),
    ...(fields.departure_time ? { departure_time: fields.departure_time } : {}),
    ...(fields.arrival_time ? { arrival_time: fields.arrival_time } : {}),
    source: 'ai_import',
    ...(fields.enrichment_status ? { enrichment_status: fields.enrichment_status } : {}),
  }
}

/** Fixed label or the base filename: no path, no control characters, at most 120 characters. Pasted text has no label. */
export function sanitizeSourceLabel(type: SourceType, value: unknown): string | null {
  if (type === 'text' || typeof value !== 'string') return null
  const base = value.split(/[\\/]/).pop() ?? ''
  const clean = base.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120).trim()
  return clean || null
}

export interface BatchRow {
  id: string
  user_id: string
  source_type: SourceType
  source_label: string | null
  status: BatchStatus
  stage: string | null
  sequence: number
  generation: number
  submission_operation_id: string
  error_code: string | null
  retry_after: string | null
  created_at: string
  updated_at: string
  expires_at: string
}

export interface DraftRow {
  id: string
  user_id: string
  batch_id: string
  ordinal: number
  fields_json: string
  confidence: number | null
  field_confidence_json: string | null
  year_explicit: number
  year_confirmed: number
  selected: number
  edited: number
  duplicate_acknowledged: number
  status: 'review' | 'dismissed' | 'converted'
  version: number
  converted_flight_id: number | null
}

const BATCH_COLUMNS = `id, user_id, source_type, source_label, status, stage, sequence, generation, submission_operation_id,
  error_code, retry_after, created_at, updated_at, expires_at`
const DRAFT_COLUMNS = `id, user_id, batch_id, ordinal, fields_json, confidence, field_confidence_json, year_explicit, year_confirmed,
  selected, edited, duplicate_acknowledged, status, version, converted_flight_id`

export const batchNotFound = () => new HttpError(404, 'Import batch not found', 'IMPORT_BATCH_NOT_FOUND')
export const batchExpired = () => new HttpError(410, 'This import has expired', 'IMPORT_BATCH_EXPIRED')

export const isBatchExpired = (batch: Pick<BatchRow, 'expires_at'>, now: Date) => batch.expires_at <= now.toISOString()

export function batchByOperation(db: D1Database, userId: string, operationId: string) {
  return db.prepare(`SELECT ${BATCH_COLUMNS} FROM import_batches WHERE user_id = ? AND submission_operation_id = ?`)
    .bind(userId, operationId).first<BatchRow>()
}

export function ownedBatch(db: D1Database, userId: string, batchId: string) {
  return db.prepare(`SELECT ${BATCH_COLUMNS} FROM import_batches WHERE id = ? AND user_id = ?`).bind(batchId, userId).first<BatchRow>()
}

/**
 * Insert a `processing` batch unless the owner is at a limit, in one statement so two requests cannot both pass.
 * A replayed submission operation id inserts nothing. Returns whether a row was inserted.
 */
export async function createProcessingBatch(
  db: D1Database,
  input: { id: string; userId: string; sourceType: SourceType; sourceLabel: string | null; operationId: string },
  now: Date,
): Promise<boolean> {
  const instant = now.toISOString()
  const result = await db.prepare(
    `INSERT INTO import_batches
       (id, user_id, source_type, source_label, status, stage, sequence, generation, submission_operation_id,
        processing_deadline, created_at, updated_at, expires_at)
     SELECT ?, ?, ?, ?, 'processing', 'accepted', 0, 1, ?, ?, ?, ?, ?
     WHERE (SELECT COUNT(*) FROM import_batches WHERE user_id = ? AND expires_at > ? AND status IN ('processing', 'review', 'partial')) < ${MAX_OPEN_BATCHES}
       AND NOT EXISTS (SELECT 1 FROM import_batches WHERE user_id = ? AND status = 'processing' AND processing_deadline > ?)
     ON CONFLICT (user_id, submission_operation_id) DO NOTHING`,
  ).bind(
    input.id, input.userId, input.sourceType, input.sourceLabel, input.operationId,
    new Date(now.getTime() + PROCESSING_WINDOW_MS).toISOString(), instant, instant, new Date(now.getTime() + BATCH_TTL_DAYS * DAY_MS).toISOString(),
    input.userId, instant, input.userId, instant,
  ).run()
  return (result.meta.changes ?? 0) > 0
}

/** Why a new batch was refused, read after the fact so the answer names the limit that actually applies. */
export async function refusalFor(db: D1Database, userId: string, now: Date): Promise<HttpError> {
  const instant = now.toISOString()
  const live = await db.prepare(
    "SELECT 1 AS found FROM import_batches WHERE user_id = ? AND status = 'processing' AND processing_deadline > ? LIMIT 1",
  ).bind(userId, instant).first()
  if (live) return new HttpError(409, 'Another import is still being processed. Wait for it to finish.', 'IMPORT_IN_PROGRESS')
  return new HttpError(409, `At most ${MAX_OPEN_BATCHES} imports can be open at once. Discard one to start another.`, 'IMPORT_BATCH_LIMIT')
}

export interface DraftRowInput {
  fields: DraftFields
  confidence: number | null
  fieldConfidence: Record<string, number> | null
  yearExplicit: boolean
  selected: boolean
}

export interface BatchFence {
  userId: string
  batchId: string
  /** The generation the writer was started under; cancel, discard, sweep and account deletion all end it. */
  generation: number
}

export interface FinalState {
  status: 'review' | 'partial' | 'failed'
  errorCode: string | null
}

/**
 * Write the drafts and finalize the batch in one D1 batch (ADR 0001 §6 "Deletion fence"). Every statement is
 * `… WHERE EXISTS (the batch, still processing, same generation)`, so after cancel (generation + 1), discard,
 * the maintenance sweep or account deletion a late write matches nothing, and a half-written batch cannot exist.
 */
export async function persistDraftRows(
  db: D1Database, fence: BatchFence, rows: DraftRowInput[], final: FinalState | null, now: Date = new Date(),
  options: { ordinalStart?: number; stage?: 'recognizing' | 'validating' } = {},
): Promise<{ sequence: number; rowIds: string[] } | null> {
  const instant = now.toISOString()
  const live = `EXISTS (SELECT 1 FROM import_batches WHERE id = ? AND user_id = ? AND status = 'processing' AND generation = ?)`
  const fenceBinds = [fence.batchId, fence.userId, fence.generation]
  const ids: string[] = []
  const statements = rows.slice(0, MAX_DRAFTS_PER_BATCH).map((row, ordinal) => {
    const id = crypto.randomUUID()
    ids.push(id)
    return db.prepare(
      `INSERT INTO import_drafts
         (id, user_id, batch_id, ordinal, fields_json, confidence, field_confidence_json, year_explicit, year_confirmed,
          selected, edited, duplicate_acknowledged, status, version, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 0, 'review', 1, ?, ?
       WHERE ${live} ON CONFLICT (batch_id, ordinal) DO NOTHING`,
    ).bind(
      id, fence.userId, fence.batchId, ordinal + (options.ordinalStart ?? 0), JSON.stringify(row.fields), row.confidence,
      row.fieldConfidence ? JSON.stringify(row.fieldConfidence) : null, row.yearExplicit ? 1 : 0, row.selected ? 1 : 0, instant, instant,
      ...fenceBinds,
    )
  })
  statements.push(db.prepare(
    `UPDATE import_batches
     SET status = ?, stage = ?, error_code = ?, sequence = sequence + 1,
         processing_deadline = CASE WHEN ? THEN NULL ELSE processing_deadline END, updated_at = ?
     WHERE id = ? AND user_id = ? AND status = 'processing' AND generation = ?
     RETURNING sequence`,
  ).bind(final?.status ?? 'processing', final ? final.status === 'failed' ? null : 'review_ready' : options.stage ?? 'recognizing',
    final?.errorCode ?? null, final ? 1 : 0, instant, ...fenceBinds))
  const results = await db.batch(statements)
  const sequence = (results.at(-1)?.results as Array<{ sequence: number }>)[0]?.sequence
  if (sequence === undefined) return null
  return { sequence, rowIds: ids.filter((_, index) => (results[index].meta.changes ?? 0) > 0) }
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export interface DraftIssue { code: string; message: string }

export interface DraftView {
  id: string
  ordinal: number
  status: DraftRow['status']
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
  /** An owned flight with the same date, origin and destination (the lowest id), excluding the draft's own flight. */
  duplicateFlightId: number | null
  /** Why the draft cannot convert as it stands, from the same validation conversion uses. Null when it can. */
  issue: DraftIssue | null
}

export interface BatchView {
  id: string
  sourceType: SourceType
  sourceLabel: string | null
  status: BatchStatus
  stage: string | null
  sequence: number
  errorCode: string | null
  retryAfter: string | null
  createdAt: string
  updatedAt: string
  expiresAt: string
  expired: boolean
}

export interface BatchSnapshot { batch: BatchView; drafts: DraftView[] }

const fieldsOf = (row: DraftRow) => JSON.parse(row.fields_json) as DraftFields

/** A draft can match a flight only with a real date and two airport codes; anything else stays a correctable row. */
const isTuple = (fields: DraftFields) => isCalendarDate(fields.date) && /^[A-Z]{3}$/.test(fields.origin) && /^[A-Z]{3}$/.test(fields.destination)

/** Duplicate flight id per draft id over the owner's whole history (`excludeId`: the flight a draft already became). */
export async function duplicatesFor(db: D1Database, userId: string, rows: DraftRow[]): Promise<Map<string, number>> {
  const candidates: DuplicateCandidate[] = []
  const ids: string[] = []
  for (const row of rows) {
    const fields = fieldsOf(row)
    if (!isTuple(fields)) continue
    candidates.push({ date: fields.date, origin: fields.origin, destination: fields.destination,
      ...(row.converted_flight_id == null ? {} : { excludeId: row.converted_flight_id }) })
    ids.push(row.id)
  }
  const matches = await findDuplicateMatches(db, userId, candidates)
  return new Map(matches.map(match => [ids[match.candidateIndex], match.flightId]))
}

/** The shared validation (`parseFlightBodies`) over each draft; a draft past review needs none. */
export async function issuesFor(db: D1Database, rows: DraftRow[]): Promise<Map<string, DraftIssue>> {
  const pending = rows.filter(row => row.status === 'review')
  const parsed = await parseFlightBodies(db, pending.map(row => draftToFlightInput(fieldsOf(row))))
  const issues = new Map<string, DraftIssue>()
  parsed.forEach((result, index) => {
    if (result instanceof HttpError) issues.set(pending[index].id, { code: result.code ?? 'INVALID_FLIGHT', message: result.message })
  })
  return issues
}

export async function viewDrafts(db: D1Database, userId: string, rows: DraftRow[]): Promise<DraftView[]> {
  const [duplicates, issues] = await Promise.all([duplicatesFor(db, userId, rows), issuesFor(db, rows)])
  return rows.map(row => ({
    id: row.id,
    ordinal: row.ordinal,
    status: row.status,
    version: row.version,
    fields: fieldsOf(row),
    confidence: row.confidence,
    fieldConfidence: row.field_confidence_json ? JSON.parse(row.field_confidence_json) as Record<string, number> : null,
    yearExplicit: row.year_explicit === 1,
    yearConfirmed: row.year_confirmed === 1,
    selected: row.selected === 1,
    edited: row.edited === 1,
    duplicateAcknowledged: row.duplicate_acknowledged === 1,
    convertedFlightId: row.converted_flight_id,
    duplicateFlightId: duplicates.get(row.id) ?? null,
    issue: issues.get(row.id) ?? null,
  }))
}

export function batchView(row: BatchRow, now: Date): BatchView {
  return {
    id: row.id, sourceType: row.source_type, sourceLabel: row.source_label, status: row.status, stage: row.stage,
    sequence: row.sequence, errorCode: row.error_code, retryAfter: row.retry_after, createdAt: row.created_at,
    updatedAt: row.updated_at, expiresAt: row.expires_at, expired: isBatchExpired(row, now),
  }
}

/** Owner-scoped snapshot. An expired batch reports `expired` and no drafts: it can neither be reviewed nor converted. */
export async function readBatchSnapshot(db: D1Database, userId: string, batchId: string, now: Date): Promise<BatchSnapshot | null> {
  const [batchResult, draftsResult] = await db.batch([
    db.prepare(`SELECT ${BATCH_COLUMNS} FROM import_batches WHERE id = ? AND user_id = ?`).bind(batchId, userId),
    db.prepare(`SELECT ${DRAFT_COLUMNS} FROM import_drafts WHERE batch_id = ? AND user_id = ? ORDER BY ordinal`).bind(batchId, userId),
  ])
  const batch = (batchResult.results as BatchRow[])[0]
  if (!batch) return null
  const view = batchView(batch, now)
  return { batch: view, drafts: view.expired ? [] : await viewDrafts(db, userId, draftsResult.results as DraftRow[]) }
}

// ---------------------------------------------------------------------------
// Draft edits
// ---------------------------------------------------------------------------

export interface DraftPatch {
  version: number
  fields?: Record<string, unknown>
  selected?: boolean
  yearConfirmed?: boolean
  duplicateAcknowledged?: boolean
  dismissed?: boolean
}

const invalidDraft = (message: string) => new HttpError(400, message, 'INVALID_DRAFT')

export function parseDraftPatch(body: unknown): DraftPatch {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalidDraft('Request body must be an object')
  const input = body as Record<string, unknown>
  const allowed = new Set(['version', 'fields', 'selected', 'yearConfirmed', 'duplicateAcknowledged', 'dismissed'])
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw invalidDraft(`Unknown field: ${key}`)
  if (typeof input.version !== 'number' || !Number.isSafeInteger(input.version) || input.version < 1) throw invalidDraft('version must be a positive integer')
  const patch: DraftPatch = { version: input.version }
  for (const key of ['selected', 'yearConfirmed', 'duplicateAcknowledged', 'dismissed'] as const) {
    if (input[key] === undefined) continue
    if (typeof input[key] !== 'boolean') throw invalidDraft(`${key} must be a boolean`)
    patch[key] = input[key] as boolean
  }
  if (input.fields !== undefined) {
    if (!input.fields || typeof input.fields !== 'object' || Array.isArray(input.fields)) throw invalidDraft('fields must be an object')
    patch.fields = input.fields as Record<string, unknown>
  }
  return patch
}

/**
 * Apply correction fields over the stored ones. Syntax is the flight validator's (`validateFlightInput`), so a draft
 * can only hold what a flight could hold shape-wise, but reference existence is not checked here: an unknown airport
 * stays a correctable draft and is refused by conversion, never bypassed. `null` or `''` clears an optional field.
 */
export function mergeFields(current: DraftFields, patch: Record<string, unknown>): DraftFields {
  const names = new Set<string>(FIELD_NAMES)
  const next: Record<string, unknown> = { ...current }
  const check: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (!names.has(key)) throw invalidDraft(`Unknown draft field: ${key}`)
    if (key === 'date' && value === '') { next.date = ''; continue }
    if (value === null || value === '') {
      if (key === 'origin' || key === 'destination' || key === 'date') throw invalidDraft(`${key} cannot be empty`)
      if (key === 'airline_iata') next.airline_iata = ''
      else delete next[key]
      continue
    }
    check[key] = value
  }
  let normalized: FlightInput
  try { normalized = validateFlightInput(check, 'patch') } catch (error) {
    throw invalidDraft(error instanceof Error ? error.message : 'Invalid draft field')
  }
  Object.assign(next, normalized)
  // A changed airline is no longer the placeholder the extraction applied.
  if (check.airline_iata !== undefined && next.airline_iata !== current.airline_iata) delete next.airline_was_placeholder
  return next as unknown as DraftFields
}

const canonical = (fields: DraftFields) => JSON.stringify(Object.keys(fields).sort().map(key => [key, (fields as unknown as Record<string, unknown>)[key]]))

export async function patchDraft(db: D1Database, userId: string, draftId: string, patch: DraftPatch, now: Date): Promise<DraftView> {
  const instant = now.toISOString()
  const read = () => db.prepare(
    `SELECT ${DRAFT_COLUMNS.split(',').map(column => `d.${column.trim()}`).join(', ')}, b.expires_at
     FROM import_drafts d JOIN import_batches b ON b.id = d.batch_id AND b.user_id = d.user_id
     WHERE d.id = ? AND d.user_id = ?`,
  ).bind(draftId, userId).first<DraftRow & { expires_at: string }>()
  const conflict = async () => {
    const row = await read()
    if (!row) return new HttpError(404, 'Draft not found', 'DRAFT_NOT_FOUND')
    if (isBatchExpired(row, now)) return batchExpired()
    const [draft] = await viewDrafts(db, userId, [row])
    return new HttpError(409, 'This row changed elsewhere. Reload it and try again.', 'DRAFT_VERSION_CONFLICT', { draft })
  }

  const row = await read()
  if (!row) throw new HttpError(404, 'Draft not found', 'DRAFT_NOT_FOUND')
  if (isBatchExpired(row, now)) throw batchExpired()
  if (row.version !== patch.version || row.status === 'converted') throw await conflict()

  const current = fieldsOf(row)
  const fields = patch.fields ? mergeFields(current, patch.fields) : current
  const edited = row.edited === 1 || canonical(fields) !== canonical(current)
  const status = patch.dismissed === undefined ? row.status : patch.dismissed ? 'dismissed' : 'review'
  const results = await db.batch([
    db.prepare(
      `UPDATE import_drafts
       SET fields_json = ?, selected = ?, year_confirmed = ?, duplicate_acknowledged = ?, edited = ?, status = ?,
           version = version + 1, updated_at = ?
       WHERE id = ? AND user_id = ? AND version = ? AND status != 'converted'
         AND EXISTS (SELECT 1 FROM import_batches WHERE id = import_drafts.batch_id AND user_id = ? AND expires_at > ?)`,
    ).bind(
      JSON.stringify(fields), (patch.selected ?? row.selected === 1) ? 1 : 0, (patch.yearConfirmed ?? row.year_confirmed === 1) ? 1 : 0,
      (patch.duplicateAcknowledged ?? row.duplicate_acknowledged === 1) ? 1 : 0, edited ? 1 : 0, status, instant,
      draftId, userId, patch.version, userId, instant,
    ),
    // Same batch as the draft update: a batch with no review row left is completed, and one that gets a review row
    // back (an un-dismiss) is open again. processing, failed and cancelled batches keep their status.
    db.prepare(
      `UPDATE import_batches SET sequence = sequence + 1, updated_at = ?,
         status = CASE
           WHEN status IN ('review', 'partial') AND NOT EXISTS
             (SELECT 1 FROM import_drafts WHERE batch_id = import_batches.id AND user_id = import_batches.user_id AND status = 'review') THEN 'completed'
           WHEN status = 'completed' AND EXISTS
             (SELECT 1 FROM import_drafts WHERE batch_id = import_batches.id AND user_id = import_batches.user_id AND status = 'review') THEN 'review'
           ELSE status END
       WHERE id = ? AND user_id = ? AND expires_at > ? AND changes() = 1`,
    ).bind(instant, row.batch_id, userId, instant),
  ])
  if ((results[0].meta.changes ?? 0) === 0) throw await conflict()
  const updated = await read()
  const [view] = await viewDrafts(db, userId, [updated!])
  return view
}

// ---------------------------------------------------------------------------
// Discard
// ---------------------------------------------------------------------------

/** Explicitly delete the drafts, then the batch, in one D1 batch; never rely on the FK cascade (0001_init.sql:13-14). */
export async function discardBatch(db: D1Database, userId: string, batchId: string): Promise<boolean> {
  if (!await ownedBatch(db, userId, batchId)) return false
  await db.batch([
    db.prepare('DELETE FROM import_drafts WHERE batch_id = ? AND user_id = ?').bind(batchId, userId),
    db.prepare('DELETE FROM import_batches WHERE id = ? AND user_id = ?').bind(batchId, userId),
  ])
  return true
}

/** Cancel is a durable fence even when the live worker cannot be reached. */
export async function cancelBatch(db: D1Database, userId: string, batchId: string, now = new Date()) {
  const changed = await db.prepare(`UPDATE import_batches SET status = 'cancelled', stage = NULL, generation = generation + 1,
    sequence = sequence + 1, processing_deadline = NULL, updated_at = ?
    WHERE id = ? AND user_id = ? AND status = 'processing' RETURNING status`)
    .bind(now.toISOString(), batchId, userId).first<{ status: BatchRow['status'] }>()
  if (changed) return { cancelled: true, status: changed.status }
  const batch = await ownedBatch(db, userId, batchId)
  if (!batch) throw batchNotFound()
  return { cancelled: false, status: batch.status }
}

/** Restart/deadline recovery retains review work and never attempts to recover the source. */
export async function interruptBatch(db: D1Database, fence: BatchFence) {
  const result = await db.prepare(`UPDATE import_batches SET
    status = CASE WHEN EXISTS (SELECT 1 FROM import_drafts WHERE batch_id = ? AND user_id = ?) THEN 'partial' ELSE 'failed' END,
    stage = NULL, error_code = 'JOB_INTERRUPTED', generation = generation + 1, sequence = sequence + 1,
    processing_deadline = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND status = 'processing' AND generation = ?
    RETURNING sequence`).bind(fence.batchId, fence.userId, new Date().toISOString(), fence.batchId, fence.userId, fence.generation)
    .first<{ sequence: number }>()
  return result ? { sequence: result.sequence, rowIds: [] } : null
}
