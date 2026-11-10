// Flighty CSV history runs (ADR 0008): opening a run, admitting chunks, classifying a complete run against the
// journal and earlier imports, owner reads, the private archive, discard and source erasure.
//
// Every write is owner-scoped and fenced on the run's status and generation, so a late chunk after a discard, an
// erasure or an expiry inserts nothing. Cell values are never logged or put into error messages.
import {
  FLIGHTY_CHUNK_RECORDS,
  FLIGHTY_MAPPER_VERSION,
  FLIGHTY_MAX_CHUNKS,
  FLIGHTY_MAX_HEADER_LENGTH,
  FLIGHTY_MAX_HEADERS,
  FLIGHTY_MAX_RECORD_BYTES,
  FLIGHTY_MAX_RECORDS,
  FLIGHTY_OBSERVED_HEADERS,
  FLIGHTY_PROFILE,
  FLIGHTY_REQUIRED_HEADERS,
  flightyChunkPayload,
  flightyManifestDigest,
  flightyRecordDigest,
  type FlightyIssue,
} from '../../../packages/shared/src/flighty'
import {
  HISTORY_OPEN_RUNS_MAX,
  HISTORY_PAGE_MAX,
  HISTORY_ROW_STATES,
  HISTORY_STORED_MAX_BYTES,
  type HistoryArchive,
  type HistoryFinding,
  type HistoryGroup,
  type HistoryPage,
  type HistoryRowState,
  type HistoryRowView,
  type HistoryRunSummary,
  type HistoryStoredAnswers,
} from '../../../packages/shared/src/flightyHistory'
import { newId, sha256Hex } from '../_lib/crypto'
import { HttpError } from '../_lib/http'
import { isoPlusSeconds, nowIso } from '../_lib/time'
import { isIdempotencyKey, isRecord } from './flightCreate'
import { evaluateRow } from './historyImportEvaluate'
import { OPEN_ROW_STATE_LIST, OPEN_ROW_STATES } from './historyImportRetention'

export const STAGING_SECONDS = 30 * 24 * 3600
/** Rows per `UPDATE … FROM json_each` statement, under D1's bound-parameter size. */
export const WRITE_SLICE = 400
const encoder = new TextEncoder()

/** Consecutive slices of at most `WRITE_SLICE` items, one per bulk-update statement. */
export function writeSlices<T>(items: T[]): T[][] {
  const slices: T[][] = []
  for (let start = 0; start < items.length; start += WRITE_SLICE)
    slices.push(items.slice(start, start + WRITE_SLICE))
  return slices
}

const RECEIVING_STATUSES = "('receiving')"
const DECIDING_STATUSES = "('review','completed')"

/**
 * The run's status follows its open rows, and every change bumps the revision that group answers fence on. The
 * fence is the run's generation plus its status (`receiving` for a seal, else `review`/`completed`), optionally the
 * revision the owner saw, and optionally that the preceding statement of the batch changed a row.
 */
export function runStatusStatement(
  db: D1Database,
  run: Pick<RunRecord, 'id' | 'user_id' | 'generation'>,
  now: string,
  fence: { receiving?: boolean; revision?: number; guardChanges?: boolean } = {},
) {
  return db
    .prepare(
      `UPDATE history_import_runs SET status = CASE WHEN EXISTS
           (SELECT 1 FROM history_import_rows WHERE run_id = ? AND state IN ${OPEN_ROW_STATES}) THEN 'review' ELSE 'completed' END,
         revision = revision + 1, updated_at = ?
       WHERE id = ? AND user_id = ? AND generation = ? AND status IN ${fence.receiving ? RECEIVING_STATUSES : DECIDING_STATUSES}${fence.revision === undefined ? '' : ' AND revision = ?'}${fence.guardChanges ? ' AND changes() > 0' : ''}`,
    )
    .bind(
      run.id,
      now,
      run.id,
      run.user_id,
      run.generation,
      ...(fence.revision === undefined ? [] : [fence.revision]),
    )
}

export interface RunRecord {
  id: string
  user_id: string
  submission_operation_id: string
  profile: string
  mapper_version: number
  headers_json: string
  manifest_json: string
  manifest_digest: string
  total_records: number
  total_chunks: number
  blank_lines: number
  stored_bytes: number
  status: HistoryRunSummary['status']
  generation: number
  revision: number
  source_erased_at: string | null
  created_at: string
  updated_at: string
  expires_at: string
}

export interface RowRecord {
  id: string
  run_id: string
  ordinal: number
  line: number
  chunk_index: number
  cells_json: string | null
  record_digest: string
  flighty_flight_id: string | null
  match_key: string | null
  match_date: string | null
  match_origin: string | null
  match_destination: string | null
  answers_json: string
  issues_json: string
  finding_json: string | null
  action: HistoryRowView['action']
  state: HistoryRowState
  ignore_reason: HistoryRowView['ignoreReason']
  version: number
  flight_id: number | null
  operation_key: string | null
  request_digest: string | null
  committed_at: string | null
}

export const ROW_COLUMNS =
  'id, run_id, ordinal, line, chunk_index, cells_json, record_digest, flighty_flight_id, match_key, match_date, ' +
  'match_origin, match_destination, answers_json, issues_json, finding_json, action, state, ignore_reason, version, ' +
  'flight_id, operation_key, request_digest, committed_at'

const COMMITTED = "('created','duplicate','preserved_only','removed')"

// ---------------------------------------------------------------------------------------------------------------
// Validation

const invalid = (message: string, code = 'INVALID_HISTORY_REQUEST') =>
  new HttpError(400, message, code)

function parseHeaders(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > FLIGHTY_MAX_HEADERS)
    throw invalid('Headers are invalid')
  const seen = new Set<string>()
  for (const header of value) {
    if (
      typeof header !== 'string' ||
      header !== header.trim() ||
      !header ||
      header.length > FLIGHTY_MAX_HEADER_LENGTH ||
      seen.has(header)
    )
      throw invalid('Headers are invalid')
    seen.add(header)
  }
  for (const required of FLIGHTY_REQUIRED_HEADERS)
    if (!seen.has(required)) throw invalid('A required Flighty column is missing', 'MISSING_HEADER')
  return value as string[]
}

export interface CreateRunRequest {
  operationId: string
  headers: string[]
  totalRecords: number
  blankLines: number
  chunks: Array<{ count: number; digest: string }>
}

export function parseCreateRun(body: unknown): CreateRunRequest {
  if (!isRecord(body)) throw invalid('Body must be an object')
  if (!isIdempotencyKey(body.operationId)) throw invalid('Valid operation id required')
  if (body.profile !== FLIGHTY_PROFILE)
    throw new HttpError(400, 'Unsupported CSV profile', 'UNSUPPORTED_PROFILE')
  const headers = parseHeaders(body.headers)
  const { totalRecords, blankLines, chunks } = body
  if (!Number.isInteger(totalRecords) || (totalRecords as number) > FLIGHTY_MAX_RECORDS)
    throw new HttpError(
      413,
      'The file has more records than one import accepts',
      'TOO_MANY_RECORDS',
    )
  if ((totalRecords as number) < 1)
    throw new HttpError(400, 'The file has no records', 'HISTORY_EMPTY')
  if (!Number.isInteger(blankLines) || (blankLines as number) < 0)
    throw invalid('Blank line count is invalid')
  if (!Array.isArray(chunks) || chunks.length === 0 || chunks.length > FLIGHTY_MAX_CHUNKS)
    throw invalid('Chunk manifest is invalid')
  let sum = 0
  for (const chunk of chunks) {
    if (
      !isRecord(chunk) ||
      !Number.isInteger(chunk.count) ||
      (chunk.count as number) < 1 ||
      (chunk.count as number) > FLIGHTY_CHUNK_RECORDS ||
      typeof chunk.digest !== 'string' ||
      !/^[0-9a-f]{64}$/.test(chunk.digest)
    )
      throw invalid('Chunk manifest is invalid')
    sum += chunk.count as number
  }
  if (sum !== totalRecords) throw invalid('Chunk manifest does not add up to the record total')
  return {
    operationId: body.operationId as string,
    headers,
    totalRecords: totalRecords as number,
    blankLines: blankLines as number,
    chunks: (chunks as Array<{ count: number; digest: string }>).map(({ count, digest }) => ({
      count,
      digest,
    })),
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Reads

export async function loadRun(db: D1Database, userId: string, runId: string): Promise<RunRecord> {
  const run = await db
    .prepare('SELECT * FROM history_import_runs WHERE id = ? AND user_id = ?')
    .bind(runId, userId)
    .first<RunRecord>()
  if (!run) throw new HttpError(404, 'Import not found', 'NOT_FOUND')
  return run
}

const parseJson = <T>(text: string | null, fallback: T): T => {
  if (text === null) return fallback
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

export const runHeaders = (run: Pick<RunRecord, 'headers_json'>) =>
  parseJson<string[]>(run.headers_json, [])
export const rowAnswers = (row: Pick<RowRecord, 'answers_json'>) =>
  parseJson<HistoryStoredAnswers>(row.answers_json, {})
export const rowFinding = (row: Pick<RowRecord, 'finding_json'>) =>
  parseJson<HistoryFinding | null>(row.finding_json, null)
export const rowCells = (row: Pick<RowRecord, 'cells_json'>) =>
  parseJson<string[] | null>(row.cells_json, null)

/** `headers` is the run's, parsed once by the caller. Group answers stay server-side. */
export function rowView(headers: string[], row: RowRecord): HistoryRowView {
  const cells = rowCells(row)
  const answers = rowAnswers(row)
  const { groups: _groups, ...visible }: HistoryStoredAnswers = answers
  const finding = rowFinding(row)
  const evaluation = evaluateRow(
    headers,
    { ordinal: row.ordinal, line: row.line, cells: cells ?? headers.map(() => '') },
    answers,
    finding,
  )
  return {
    id: row.id,
    ordinal: row.ordinal,
    line: row.line,
    state: row.state,
    version: row.version,
    action: row.action,
    ignoreReason: row.ignore_reason,
    flightId: row.flight_id,
    issues: cells ? evaluation.candidate.issues : parseJson<FlightyIssue[]>(row.issues_json, []),
    finding,
    answers: visible,
    projection: evaluation.candidate.projection,
    fields: cells
      ? Object.fromEntries(
          headers.flatMap((header, index) =>
            cells[index]?.trim() ? [[header, cells[index]]] : [],
          ),
        )
      : null,
  }
}

/** Shared questions of a run: one per group key over its open rows, plus the two answerable match groups. */
async function openGroups(db: D1Database, run: RunRecord): Promise<HistoryGroup[]> {
  const { results } = await db
    .prepare(
      `SELECT issues_json, finding_json FROM history_import_rows WHERE run_id = ? AND user_id = ? AND state = 'needs_review'`,
    )
    .bind(run.id, run.user_id)
    .all<{ issues_json: string; finding_json: string | null }>()
  const groups = new Map<string, HistoryGroup>()
  const add = (key: string, entry: Omit<HistoryGroup, 'rows'>) => {
    const existing = groups.get(key)
    if (existing) existing.rows += 1
    else groups.set(key, { ...entry, rows: 1 })
  }
  for (const row of results) {
    const issues = parseJson<FlightyIssue[]>(row.issues_json, [])
    const seen = new Set<string>()
    for (const issue of issues) {
      if (!issue.group || seen.has(issue.group)) continue
      seen.add(issue.group)
      add(issue.group, {
        group: issue.group,
        code: issue.code,
        token: issue.token ?? '',
        candidates: issue.candidates ?? [],
      })
    }
    // Only a clean row waits on its finding alone; a group answer then settles it.
    const finding = parseJson<HistoryFinding | null>(row.finding_json, null)
    if (issues.length === 0 && finding) {
      if (finding.kind === 'new_since_import')
        add('match:new_since_import', {
          group: 'match:new_since_import',
          code: finding.kind,
          token: '',
          candidates: [],
        })
      if (finding.kind === 'existing_flight' && finding.flightId !== null)
        add('match:existing_flight', {
          group: 'match:existing_flight',
          code: finding.kind,
          token: '',
          candidates: [],
        })
    }
  }
  return [...groups.values()].sort((a, b) => b.rows - a.rows || a.group.localeCompare(b.group))
}

/** `withGroups` reads the open rows for the shared questions; only the review page needs them. */
export async function runSummary(
  db: D1Database,
  run: RunRecord,
  withGroups = false,
): Promise<HistoryRunSummary> {
  const [counts, chunks] = await db.batch([
    db
      .prepare(
        'SELECT state, COUNT(*) AS n FROM history_import_rows WHERE run_id = ? AND user_id = ? GROUP BY state',
      )
      .bind(run.id, run.user_id),
    db
      .prepare(
        'SELECT DISTINCT chunk_index FROM history_import_rows WHERE run_id = ? AND user_id = ?',
      )
      .bind(run.id, run.user_id),
  ])
  const states = Object.fromEntries(HISTORY_ROW_STATES.map((state) => [state, 0])) as Record<
    HistoryRowState,
    number
  >
  for (const row of counts.results as Array<{ state: HistoryRowState; n: number }>)
    states[row.state] = row.n
  const received = new Set(
    (chunks.results as Array<{ chunk_index: number }>).map((row) => row.chunk_index),
  )
  const headers = runHeaders(run)
  const observed = new Set<string>(FLIGHTY_OBSERVED_HEADERS)
  return {
    id: run.id,
    status: run.status,
    profile: run.profile,
    createdAt: run.created_at,
    expiresAt: run.expires_at,
    sourceErased: run.source_erased_at !== null,
    revision: run.revision,
    generation: run.generation,
    headers,
    unknownHeaders: headers.filter((header) => !observed.has(header)),
    totals: {
      records: run.total_records,
      received: Object.values(states).reduce((sum, n) => sum + n, 0),
      blankLines: run.blank_lines,
      states,
    },
    chunks: {
      total: run.total_chunks,
      missing:
        run.status === 'receiving'
          ? Array.from({ length: run.total_chunks }, (_, index) => index).filter(
              (index) => !received.has(index),
            )
          : [],
    },
    groups: withGroups && run.status === 'review' ? await openGroups(db, run) : [],
  }
}

export async function listRuns(db: D1Database, userId: string) {
  const { results } = await db
    .prepare(
      'SELECT * FROM history_import_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
    )
    .bind(userId)
    .all<RunRecord>()
  const runs = []
  for (const run of results) runs.push(await runSummary(db, run))
  return runs
}

const STATE_FILTERS: Record<string, readonly HistoryRowState[]> = {
  open: OPEN_ROW_STATE_LIST,
  review: ['needs_review', 'error'],
  done: ['created', 'duplicate', 'preserved_only', 'ignored', 'removed'],
  ...Object.fromEntries(HISTORY_ROW_STATES.map((state) => [state, [state]])),
}

export async function readRunPage(
  db: D1Database,
  userId: string,
  runId: string,
  query: URLSearchParams,
): Promise<HistoryPage> {
  const run = await loadRun(db, userId, runId)
  const filter = query.get('state') ?? 'open'
  const states = STATE_FILTERS[filter]
  if (!states) throw invalid('Unknown state filter')
  const cursor = Number(query.get('cursor') ?? -1)
  const limit = Number(query.get('limit') ?? HISTORY_PAGE_MAX)
  if (
    !Number.isInteger(cursor) ||
    cursor < -1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > HISTORY_PAGE_MAX
  )
    throw invalid('Page cursor or limit is invalid')
  const group = query.get('group')
  const headers = runHeaders(run)
  const { results } = await db
    .prepare(
      `SELECT ${ROW_COLUMNS} FROM history_import_rows
       WHERE run_id = ? AND user_id = ? AND state IN (SELECT value FROM json_each(?)) AND ordinal > ?
         AND (? IS NULL OR EXISTS (SELECT 1 FROM json_each(issues_json) WHERE json_extract(value, '$.group') = ?)
           OR (? = 'match:new_since_import' AND json_extract(finding_json, '$.kind') = 'new_since_import')
           OR (? = 'match:existing_flight' AND json_extract(finding_json, '$.kind') = 'existing_flight'))
       ORDER BY ordinal LIMIT ?`,
    )
    .bind(run.id, userId, JSON.stringify(states), cursor, group, group, group, group, limit + 1)
    .all<RowRecord>()
  const rows = results.slice(0, limit)
  return {
    run: await runSummary(db, run, filter === 'open' || filter === 'review'),
    rows: rows.map((row) => rowView(headers, row)),
    nextCursor: results.length > limit ? rows[rows.length - 1].ordinal : null,
  }
}

/** Every record of the run with its outcome and, unless erased, its verbatim cells. Owner-only. */
export async function readArchive(
  db: D1Database,
  userId: string,
  runId: string,
): Promise<HistoryArchive> {
  const run = await loadRun(db, userId, runId)
  const { results } = await db
    .prepare(
      `SELECT ordinal, line, state, action, flight_id, ignore_reason, cells_json FROM history_import_rows
       WHERE run_id = ? AND user_id = ? ORDER BY ordinal`,
    )
    .bind(run.id, userId)
    .all<
      Pick<
        RowRecord,
        'ordinal' | 'line' | 'state' | 'action' | 'flight_id' | 'ignore_reason' | 'cells_json'
      >
    >()
  return {
    provider: 'flighty',
    profile: run.profile,
    runId: run.id,
    createdAt: run.created_at,
    sourceErased: run.source_erased_at !== null,
    headers: runHeaders(run),
    records: results.map((row) => ({
      ordinal: row.ordinal,
      line: row.line,
      state: row.state,
      action: row.action,
      flightId: row.flight_id,
      ignoreReason: row.ignore_reason,
      cells: rowCells(row),
    })),
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Opening a run

export async function createRun(
  db: D1Database,
  userId: string,
  request: CreateRunRequest,
): Promise<{ run: HistoryRunSummary; replayed: boolean }> {
  const manifestDigest = await flightyManifestDigest(request.headers, request.chunks)
  const findRun = () =>
    db
      .prepare(
        'SELECT * FROM history_import_runs WHERE user_id = ? AND submission_operation_id = ?',
      )
      .bind(userId, request.operationId)
      .first<RunRecord>()
  // The same operation id and manifest answers the run already opened, however the earlier call ended.
  const replayOf = async (existing: RunRecord | null) => {
    if (!existing) return null
    if (existing.manifest_digest !== manifestDigest)
      throw new HttpError(409, 'Operation id already used for another file', 'IDEMPOTENCY_CONFLICT')
    return { run: await runSummary(db, existing), replayed: true }
  }
  const existing = await replayOf(await findRun())
  if (existing) return existing
  const now = nowIso()
  const id = newId()
  const inserted = await db
    .prepare(
      `INSERT INTO history_import_runs (id, user_id, submission_operation_id, provider, profile, mapper_version,
         headers_json, manifest_json, manifest_digest, total_records, total_chunks, blank_lines, status, created_at,
         updated_at, expires_at)
       SELECT ?, ?, ?, 'flighty', ?, ?, ?, ?, ?, ?, ?, ?, 'receiving', ?, ?, ?
       WHERE (SELECT COUNT(*) FROM history_import_runs
              WHERE user_id = ? AND status IN ('receiving','review') AND expires_at > ?) < ?
       ON CONFLICT (user_id, submission_operation_id) DO NOTHING`,
    )
    .bind(
      id,
      userId,
      request.operationId,
      FLIGHTY_PROFILE,
      FLIGHTY_MAPPER_VERSION,
      JSON.stringify(request.headers),
      JSON.stringify(request.chunks),
      manifestDigest,
      request.totalRecords,
      request.chunks.length,
      request.blankLines,
      now,
      now,
      isoPlusSeconds(STAGING_SECONDS, now),
      userId,
      now,
      HISTORY_OPEN_RUNS_MAX,
    )
    .run()
  if (!inserted.meta.changes) {
    const raced = await replayOf(await findRun())
    if (raced) return raced
    throw new HttpError(409, 'Finish or discard an open import first', 'HISTORY_RUN_LIMIT')
  }
  return { run: await runSummary(db, await loadRun(db, userId, id)), replayed: false }
}

// ---------------------------------------------------------------------------------------------------------------
// Chunks

export function parseChunkBody(body: unknown): Array<[number, number, string[]]> {
  if (!isRecord(body) || !Array.isArray(body.records)) throw invalid('Chunk records are required')
  for (const record of body.records)
    if (
      !Array.isArray(record) ||
      record.length !== 3 ||
      !Number.isInteger(record[0]) ||
      !Number.isInteger(record[1]) ||
      (record[1] as number) < 1 ||
      !Array.isArray(record[2]) ||
      !(record[2] as unknown[]).every((cell) => typeof cell === 'string')
    )
      throw invalid('Chunk records are invalid')
  return body.records as Array<[number, number, string[]]>
}

export async function admitChunk(
  db: D1Database,
  userId: string,
  runId: string,
  rawIndex: string,
  records: Array<[number, number, string[]]>,
): Promise<{ run: HistoryRunSummary; inserted: number }> {
  const run = await loadRun(db, userId, runId)
  const index = Number(rawIndex)
  const manifest = parseJson<Array<{ count: number; digest: string }>>(run.manifest_json, [])
  if (!Number.isInteger(index) || index < 0 || index >= manifest.length)
    throw new HttpError(404, 'Chunk not found', 'NOT_FOUND')
  const headers = runHeaders(run)
  const entry = manifest[index]
  const start = manifest.slice(0, index).reduce((sum, chunk) => sum + chunk.count, 0)
  if (records.length !== entry.count) throw invalid('Chunk record count differs from the manifest')
  records.forEach(([ordinal, , cells], position) => {
    if (ordinal !== start + position) throw invalid('Chunk ordinals differ from the manifest')
    if (cells.length !== headers.length) throw invalid('A record has the wrong number of cells')
    if (encoder.encode(JSON.stringify(cells)).length > FLIGHTY_MAX_RECORD_BYTES)
      throw new HttpError(413, 'A record is too large', 'RECORD_TOO_LARGE')
  })
  const typed = records.map(([ordinal, line, cells]) => ({ ordinal, line, cells }))
  if ((await sha256Hex(flightyChunkPayload(typed))) !== entry.digest)
    throw new HttpError(409, 'Chunk content differs from the manifest', 'CHUNK_DIGEST_MISMATCH')

  // A replay of an admitted chunk inserts nothing and answers the same run. When it completes a run that an
  // interrupted seal left `receiving`, the replay finishes the seal.
  const present = await db
    .prepare(
      'SELECT COUNT(*) AS n FROM history_import_rows WHERE run_id = ? AND user_id = ? AND chunk_index = ?',
    )
    .bind(run.id, userId, index)
    .first<{ n: number }>()
  if ((present?.n ?? 0) > 0) {
    await sealIfComplete(db, run)
    return { run: await runSummary(db, await loadRun(db, userId, run.id)), inserted: 0 }
  }
  if (run.status !== 'receiving')
    throw new HttpError(409, 'This import no longer accepts records', 'HISTORY_RUN_CLOSED')

  const now = nowIso()
  const rows = await Promise.all(
    typed.map(async (record) => {
      const evaluation = evaluateRow(headers, record, {}, null)
      const { projection, identity, issues } = evaluation.candidate
      return {
        id: newId(),
        ordinal: record.ordinal,
        line: record.line,
        cells: record.cells,
        digest: await flightyRecordDigest(headers, record.cells),
        fid:
          identity.flightyFlightId && identity.flightyFlightId.length <= 128
            ? identity.flightyFlightId
            : null,
        mk: identity.matchKey && identity.matchKey.length <= 256 ? identity.matchKey : null,
        md: projection.date,
        mo: projection.origin,
        mdst: projection.destination,
        issues,
        action: evaluation.action,
        state: evaluation.state,
      }
    }),
  )
  const payload = JSON.stringify(rows)
  const payloadBytes = encoder.encode(payload).length
  if (run.stored_bytes + payloadBytes > HISTORY_STORED_MAX_BYTES)
    throw new HttpError(413, 'The file is larger than one import accepts', 'FILE_TOO_LARGE')
  const fence = `EXISTS (SELECT 1 FROM history_import_runs WHERE id = ? AND user_id = ? AND status = 'receiving' AND generation = ?)`
  const [insert] = await db.batch([
    db
      .prepare(
        `INSERT INTO history_import_rows (id, user_id, run_id, ordinal, line, chunk_index, cells_json, record_digest,
           flighty_flight_id, match_key, match_date, match_origin, match_destination, issues_json, action, state,
           created_at, updated_at)
         SELECT json_extract(value, '$.id'), ?, ?, json_extract(value, '$.ordinal'), json_extract(value, '$.line'), ?,
           json_extract(value, '$.cells'), json_extract(value, '$.digest'), json_extract(value, '$.fid'),
           json_extract(value, '$.mk'), json_extract(value, '$.md'), json_extract(value, '$.mo'),
           json_extract(value, '$.mdst'), json_extract(value, '$.issues'), json_extract(value, '$.action'),
           json_extract(value, '$.state'), ?, ?
         FROM json_each(?) WHERE ${fence}
         ON CONFLICT (run_id, ordinal) DO NOTHING`,
      )
      .bind(userId, run.id, index, now, now, payload, run.id, userId, run.generation),
    db
      .prepare(
        `UPDATE history_import_runs SET revision = revision + 1, updated_at = ?,
           stored_bytes = stored_bytes + ?
         WHERE id = ? AND user_id = ? AND status = 'receiving' AND generation = ? AND changes() > 0`,
      )
      .bind(now, payloadBytes, run.id, userId, run.generation),
  ])
  await sealIfComplete(db, await loadRun(db, userId, run.id))
  return {
    run: await runSummary(db, await loadRun(db, userId, run.id)),
    inserted: insert.meta.changes ?? 0,
  }
}

/** Seal a `receiving` run once every record is in. Racing seals are harmless: each write is fenced on `receiving`. */
async function sealIfComplete(db: D1Database, run: RunRecord): Promise<void> {
  if (run.status !== 'receiving') return
  const count = await db
    .prepare('SELECT COUNT(*) AS n FROM history_import_rows WHERE run_id = ? AND user_id = ?')
    .bind(run.id, run.user_id)
    .first<{ n: number }>()
  if ((count?.n ?? 0) === run.total_records) await sealRun(db, run)
}

// ---------------------------------------------------------------------------------------------------------------
// Classification (ADR 0008 "Matching")

interface PriorRow {
  id: string
  record_digest: string
  flighty_flight_id: string | null
  match_key: string | null
  flight_id: number | null
  state: HistoryRowState
  action: HistoryRowView['action']
}

/** Push onto the entry for `key`, creating it first. */
function append<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const entries = map.get(key)
  if (entries) entries.push(value)
  else map.set(key, [value])
}

/**
 * Compare a complete run with the owner's journal and earlier imports, then open it for review. One D1 batch: every
 * row update and the status flip are fenced on the run still `receiving` at this generation, so a concurrent seal of
 * the same run, or a discard, leaves nothing half-classified.
 */
async function sealRun(db: D1Database, run: RunRecord): Promise<void> {
  const [own, prior, flights] = await db.batch([
    db
      .prepare(
        `SELECT id, ordinal, record_digest, flighty_flight_id, match_key, match_date, match_origin, match_destination,
           state, action FROM history_import_rows WHERE run_id = ? AND user_id = ? ORDER BY ordinal`,
      )
      .bind(run.id, run.user_id),
    db
      .prepare(
        `SELECT id, record_digest, flighty_flight_id, match_key, flight_id, state, action FROM history_import_rows
         WHERE user_id = ? AND run_id <> ? AND state IN ${COMMITTED} ORDER BY committed_at, run_id, ordinal`,
      )
      .bind(run.user_id, run.id),
    db
      .prepare('SELECT id, date, origin, destination FROM flights WHERE user_id = ?')
      .bind(run.user_id),
  ])
  type OwnRow = Pick<
    RowRecord,
    | 'id'
    | 'ordinal'
    | 'record_digest'
    | 'flighty_flight_id'
    | 'match_key'
    | 'match_date'
    | 'match_origin'
    | 'match_destination'
    | 'state'
    | 'action'
  >
  const rows = own.results as OwnRow[]
  const priorRows = prior.results as PriorRow[]
  const route = (date: string | null, origin: string | null, destination: string | null) =>
    date && origin && destination ? `${date}|${origin}|${destination}` : null

  // Only records an export actually accepted count toward matching: a `link` receipt (a repeat) never adds an
  // occurrence, so re-importing a file cannot multiply what an earlier file said once.
  const accepted = priorRows.filter(
    (row) => row.action === 'create' || row.action === 'preserve_only',
  )
  const priorByDigest = new Map<string, PriorRow[]>()
  const priorByFlightyId = new Map<string, PriorRow[]>()
  const priorByKey = new Map<string, PriorRow[]>()
  for (const row of accepted) {
    append(priorByDigest, row.record_digest, row)
    if (row.flighty_flight_id) append(priorByFlightyId, row.flighty_flight_id, row)
    if (row.match_key) append(priorByKey, row.match_key, row)
  }
  // 1. Exact repeats, paired one to one in order.
  const consumed = new Set<string>()
  const findings = new Map<string, HistoryFinding>()
  for (const row of rows) {
    const match = priorByDigest.get(row.record_digest)?.shift()
    if (!match) continue
    consumed.add(match.id)
    findings.set(row.id, {
      kind: match.state === 'removed' ? 'previous_deleted' : 'previous_import',
      flightId: match.flight_id,
      rowId: match.id,
    })
  }
  // 2. Same Flighty ID or match key, changed content.
  const unconsumed = (entries: PriorRow[] | undefined) =>
    entries?.find((prior) => !consumed.has(prior.id))
  for (const row of rows) {
    if (findings.has(row.id)) continue
    const match =
      (row.flighty_flight_id && unconsumed(priorByFlightyId.get(row.flighty_flight_id))) ||
      (row.match_key && unconsumed(priorByKey.get(row.match_key))) ||
      null
    if (match)
      findings.set(row.id, {
        kind: match.state === 'removed' ? 'previous_deleted' : 'source_changed',
        flightId: match.state === 'removed' ? null : match.flight_id,
        rowId: match.id,
      })
  }
  // 2b. A record whose only trace is a link receipt to a flight the owner deleted is still a deleted record: the
  // receipt adds no occurrence (step 1), but its tombstone keeps the identity so it is never offered as new.
  const deletedLinks = new Map<string, PriorRow>()
  for (const row of priorRows)
    if (row.action === 'link' && row.state === 'removed')
      for (const key of [row.record_digest, row.flighty_flight_id, row.match_key])
        if (key && !deletedLinks.has(key)) deletedLinks.set(key, row)
  for (const row of rows) {
    if (findings.has(row.id)) continue
    const match = [row.record_digest, row.flighty_flight_id, row.match_key]
      .map((key) => (key ? deletedLinks.get(key) : undefined))
      .find(Boolean)
    if (match) findings.set(row.id, { kind: 'previous_deleted', flightId: null, rowId: match.id })
  }
  // 3. Owned flights on the same date and route.
  const flightsByRoute = new Map<string, number[]>()
  for (const flight of flights.results as Array<{
    id: number
    date: string
    origin: string
    destination: string
  }>)
    append(flightsByRoute, route(flight.date, flight.origin, flight.destination)!, flight.id)
  const routeCount = new Map<string, number>()
  for (const row of rows) {
    const key = route(row.match_date, row.match_origin, row.match_destination)
    if (key && row.action === 'create') routeCount.set(key, (routeCount.get(key) ?? 0) + 1)
  }
  const hasPriorImport = priorRows.length > 0
  for (const row of rows) {
    if (findings.has(row.id) || row.action !== 'create') continue
    const key = route(row.match_date, row.match_origin, row.match_destination)
    const owned = key ? (flightsByRoute.get(key) ?? []) : []
    if (owned.length)
      findings.set(row.id, {
        kind: 'existing_flight',
        flightId: owned.length === 1 ? owned[0] : null,
        rowId: null,
      })
    // 4. Repeated date and route inside this file.
    else if (key && (routeCount.get(key) ?? 0) > 1)
      findings.set(row.id, { kind: 'repeated_in_file', flightId: null, rowId: null })
    // 5. Anything else, once an earlier Flighty import exists.
    else if (hasPriorImport)
      findings.set(row.id, { kind: 'new_since_import', flightId: null, rowId: null })
  }

  const updates = rows.flatMap((row) => {
    const finding = findings.get(row.id)
    if (!finding) return []
    let state = row.state
    let action = row.action
    if (row.state !== 'error') {
      if (finding.kind === 'previous_import') {
        state = 'ready'
        action = 'link'
      } else if (row.state === 'ready' && row.action === 'create') state = 'needs_review'
    }
    return [{ id: row.id, finding, state, action }]
  })
  const now = nowIso()
  const fence = `EXISTS (SELECT 1 FROM history_import_runs WHERE id = ? AND user_id = ? AND status = 'receiving' AND generation = ?)`
  const statements = writeSlices(updates).map((slice) =>
    db
      .prepare(
        `UPDATE history_import_rows SET finding_json = json(j.finding), state = j.state, action = j.action,
           updated_at = ?
         FROM (SELECT json_extract(value, '$.id') AS id, json_extract(value, '$.finding') AS finding,
                 json_extract(value, '$.state') AS state, json_extract(value, '$.action') AS action
               FROM json_each(?)) AS j
         WHERE history_import_rows.id = j.id AND history_import_rows.run_id = ? AND ${fence}`,
      )
      .bind(now, JSON.stringify(slice), run.id, run.id, run.user_id, run.generation),
  )
  statements.push(runStatusStatement(db, run, now, { receiving: true }))
  await db.batch(statements)
}

// ---------------------------------------------------------------------------------------------------------------
// Discard and erasure

/**
 * Discard: a run with nothing committed disappears; otherwise its unconfirmed rows become `ignored`/`discarded` and
 * lose their cells, the run closes and its generation fences late writes. Created flights stay.
 */
export async function discardRun(db: D1Database, userId: string, runId: string) {
  const run = await loadRun(db, userId, runId)
  const now = nowIso()
  const committed = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM history_import_rows WHERE run_id = ? AND user_id = ? AND state IN ${COMMITTED}`,
    )
    .bind(run.id, userId)
    .first<{ n: number }>()
  if (!committed?.n) {
    const [, deleted] = await db.batch([
      db
        .prepare(
          `DELETE FROM history_import_rows WHERE run_id = ? AND user_id = ?
             AND NOT EXISTS (SELECT 1 FROM history_import_rows c WHERE c.run_id = ? AND c.state IN ${COMMITTED})`,
        )
        .bind(run.id, userId, run.id),
      db
        .prepare(
          `DELETE FROM history_import_runs WHERE id = ? AND user_id = ?
             AND NOT EXISTS (SELECT 1 FROM history_import_rows WHERE run_id = ?)`,
        )
        .bind(run.id, userId, run.id),
    ])
    if (deleted.meta.changes) return { discarded: true, kept: 0 }
  }
  await db.batch(closeStatements(db, userId, run.id, now, false))
  return { discarded: true, kept: committed?.n ?? 0 }
}

function closeStatements(
  db: D1Database,
  userId: string,
  runId: string,
  now: string,
  erase: boolean,
): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `UPDATE history_import_rows SET state = 'ignored', ignore_reason = 'discarded', cells_json = NULL,
           version = version + 1, updated_at = ? WHERE run_id = ? AND user_id = ? AND state IN ${OPEN_ROW_STATES}`,
      )
      .bind(now, runId, userId),
    db
      .prepare(
        `UPDATE history_import_rows SET cells_json = NULL, updated_at = ?${erase ? ', source_erased_at = ?' : ''}
         WHERE run_id = ? AND user_id = ? AND cells_json IS NOT NULL ${erase ? '' : "AND state = 'ignored'"}`,
      )
      .bind(...(erase ? [now, now] : [now]), runId, userId),
    db
      .prepare(
        `UPDATE history_import_runs SET status = 'closed', generation = generation + 1, revision = revision + 1,
           updated_at = ?${erase ? ', source_erased_at = ?' : ''} WHERE id = ? AND user_id = ?`,
      )
      .bind(...(erase ? [now, now] : [now]), runId, userId),
  ]
}

/** Erase every stored cell of the run (PNR and notes included). Flights and minimal tombstones stay. */
export async function eraseRunSource(db: D1Database, userId: string, runId: string) {
  const run = await loadRun(db, userId, runId)
  await db.batch(closeStatements(db, userId, run.id, nowIso(), true))
  return { erased: true }
}
