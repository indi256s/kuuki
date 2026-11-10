// Owner decisions on Flighty history rows (ADR 0008): row answers, group answers and confirmation.
//
// Every write re-maps the row on the server from its verbatim cells and the answers, and is fenced on the row version
// and the run generation (group answers also on the run revision the owner saw). Confirmation creates flights only
// through the shared `bulkCreate` chain with a history guard; links and preserved records update only their row.
import { isCalendarDate } from '../../../packages/shared/src/flightValidation'
import {
  HISTORY_CONFIRM_MAX,
  type HistoryConfirmItem,
  type HistoryConfirmResult,
  type HistoryRowAnswers,
  type HistoryRowView,
  type HistoryStoredAnswers,
} from '../../../packages/shared/src/flightyHistory'
import { canonicalTimeZone } from '../../../packages/shared/src/calendar'
import type { FlightInput } from '../../../packages/shared/src/flightValidation'
import { sha256Hex } from '../_lib/crypto'
import { HttpError } from '../_lib/http'
import { nowIso } from '../_lib/time'
import type { DerivedRepairResult } from './derivedState'
import { bulkCreate, isIdempotencyKey, isRecord, type HistoryTarget } from './flightCreate'
import { catalogFlightyRefs } from './flightyRefs'
import {
  ROW_COLUMNS,
  loadRun,
  rowAnswers,
  rowCells,
  rowFinding,
  rowView,
  runHeaders,
  runStatusStatement,
  runSummary,
  writeSlices,
  type RowRecord,
  type RunRecord,
} from './historyImport'
import { evaluateRow, type Evaluation } from './historyImportEvaluate'
import { OPEN_ROW_STATE_LIST } from './historyImportRetention'

const invalid = (message: string) => new HttpError(400, message, 'INVALID_HISTORY_REQUEST')
const iata = (value: unknown) =>
  typeof value === 'string' && /^[A-Z]{3}$/.test(value) && !!catalogFlightyRefs.airport(value)

function parseRowAnswers(value: unknown): HistoryRowAnswers {
  if (!isRecord(value)) throw invalid('Answers must be an object')
  const answers: HistoryRowAnswers = {}
  for (const [key, raw] of Object.entries(value)) {
    switch (key) {
      case 'date':
        if (typeof raw !== 'string' || !isCalendarDate(raw)) throw invalid('Date answer is invalid')
        answers.date = raw
        break
      case 'origin':
      case 'destination':
        if (!iata(raw)) throw invalid('Airport answer is not a known airport')
        answers[key] = raw as string
        break
      case 'diversion':
        if (raw !== null && !iata(raw)) throw invalid('Diversion answer is not a known airport')
        answers.diversion = raw as string | null
        break
      case 'airline':
        if (raw !== null && !(typeof raw === 'string' && catalogFlightyRefs.airlineExists(raw)))
          throw invalid('Airline answer is not a known airline')
        answers.airline = raw as string | null
        break
      case 'flightNumber':
        if (raw !== null && !(typeof raw === 'string' && raw.trim() && raw.length <= 20))
          throw invalid('Flight number answer is invalid')
        answers.flightNumber = raw === null ? null : (raw as string).trim()
        break
      case 'canceled':
        if (typeof raw !== 'boolean') throw invalid('Cancellation answer is invalid')
        answers.canceled = raw
        break
      case 'times':
        if (raw === 'drop') answers.times = 'drop'
        else if (
          isRecord(raw) &&
          isRecord(raw.offsets) &&
          Object.entries(raw.offsets).every(
            ([header, offset]) =>
              header.length <= 80 && Number.isInteger(offset) && Math.abs(offset as number) <= 900,
          )
        )
          answers.times = { offsets: raw.offsets as Record<string, number> }
        else throw invalid('Times answer is invalid')
        break
      case 'match':
        if (raw !== 'new' && raw !== 'link') throw invalid('Match answer is invalid')
        answers.match = raw
        break
      default:
        throw invalid('Unknown answer')
    }
  }
  return answers
}

export interface PatchRowRequest {
  version: number
  answers?: HistoryRowAnswers
  ignore?: boolean
}

export function parsePatchRow(body: unknown): PatchRowRequest {
  if (!isRecord(body) || !Number.isInteger(body.version)) throw invalid('Row version required')
  if (body.ignore !== undefined && typeof body.ignore !== 'boolean')
    throw invalid('ignore must be a boolean')
  if (body.answers === undefined && body.ignore === undefined) throw invalid('Nothing to change')
  return {
    version: body.version as number,
    ...(body.answers === undefined ? {} : { answers: parseRowAnswers(body.answers) }),
    ...(body.ignore === undefined ? {} : { ignore: body.ignore }),
  }
}

async function loadRow(
  db: D1Database,
  userId: string,
  runId: string,
  rowId: string,
): Promise<RowRecord> {
  const row = await db
    .prepare(
      `SELECT ${ROW_COLUMNS} FROM history_import_rows WHERE id = ? AND run_id = ? AND user_id = ?`,
    )
    .bind(rowId, runId, userId)
    .first<RowRecord>()
  if (!row) throw new HttpError(404, 'Record not found', 'NOT_FOUND')
  return row
}

function evaluateStored(
  headers: string[],
  row: RowRecord,
  answers: HistoryStoredAnswers,
): Evaluation {
  const cells = rowCells(row)
  if (!cells)
    throw new HttpError(409, 'The source of this record was erased', 'HISTORY_SOURCE_ERASED')
  return evaluateRow(
    headers,
    { ordinal: row.ordinal, line: row.line, cells },
    answers,
    rowFinding(row),
  )
}

function requireOpenRun(run: RunRecord) {
  if (run.status === 'receiving')
    throw new HttpError(409, 'This import is still receiving records', 'HISTORY_RUN_RECEIVING')
  if (run.status === 'closed')
    throw new HttpError(409, 'This import is closed', 'HISTORY_RUN_CLOSED')
}

const rowUpdate = (evaluation: Evaluation) => ({
  state: evaluation.state,
  action: evaluation.action,
  issues: evaluation.candidate.issues,
  md: evaluation.candidate.projection.date,
  mo: evaluation.candidate.projection.origin,
  mdst: evaluation.candidate.projection.destination,
})

export async function patchRow(
  db: D1Database,
  userId: string,
  runId: string,
  rowId: string,
  request: PatchRowRequest,
): Promise<HistoryRowView> {
  const run = await loadRun(db, userId, runId)
  requireOpenRun(run)
  const row = await loadRow(db, userId, runId, rowId)
  if (row.version !== request.version)
    throw new HttpError(409, 'This record changed; reload it', 'HISTORY_ROW_VERSION_CONFLICT')
  const open = (OPEN_ROW_STATE_LIST as readonly string[]).includes(row.state)
  const restorable = row.state === 'ignored' && row.ignore_reason === 'owner'
  if (!open && !restorable)
    throw new HttpError(409, 'This record is already settled', 'HISTORY_ROW_SETTLED')
  const previous = rowAnswers(row)
  // Row answers replace the row-level set; group answers stay.
  const answers: HistoryStoredAnswers = request.answers
    ? { ...(previous.groups ? { groups: previous.groups } : {}), ...request.answers }
    : previous
  const now = nowIso()
  const headers = runHeaders(run)
  if (!open && request.ignore !== true && request.ignore !== false)
    throw new HttpError(409, 'Restore this record before answering', 'HISTORY_ROW_SETTLED')
  const set = {
    ...rowUpdate(evaluateStored(headers, row, answers)),
    ...(request.ignore === true ? { state: 'ignored', ignore: 'owner' } : { ignore: null }),
  }
  const [update] = await db.batch([
    db
      .prepare(
        `UPDATE history_import_rows SET answers_json = ?, state = ?, action = ?, ignore_reason = ?, issues_json = ?,
           match_date = ?, match_origin = ?, match_destination = ?, version = version + 1, updated_at = ?
         WHERE id = ? AND run_id = ? AND user_id = ? AND version = ?
           AND EXISTS (SELECT 1 FROM history_import_runs WHERE id = ? AND generation = ? AND status IN ('review','completed'))`,
      )
      .bind(
        JSON.stringify(answers),
        set.state,
        set.action,
        set.ignore,
        JSON.stringify(set.issues),
        set.md,
        set.mo,
        set.mdst,
        now,
        row.id,
        run.id,
        userId,
        row.version,
        run.id,
        run.generation,
      ),
    runStatusStatement(db, run, now, { guardChanges: true }),
  ])
  if (!update.meta.changes)
    throw new HttpError(409, 'This record changed; reload it', 'HISTORY_ROW_VERSION_CONFLICT')
  return rowView(headers, await loadRow(db, userId, runId, rowId))
}

// ---------------------------------------------------------------------------------------------------------------
// Group answers

export interface GroupAnswerRequest {
  group: string
  answer: string | boolean | null
  revision: number
}

export function parseGroupAnswer(body: unknown): GroupAnswerRequest {
  if (
    !isRecord(body) ||
    typeof body.group !== 'string' ||
    body.group.length > 64 ||
    !Number.isInteger(body.revision)
  )
    throw invalid('Group, answer and revision required')
  const [prefix] = body.group.split(':')
  const answer = body.answer
  const valid =
    prefix === 'airline'
      ? answer === null || (typeof answer === 'string' && catalogFlightyRefs.airlineExists(answer))
      : prefix === 'airport'
        ? iata(answer)
        : prefix === 'canceled'
          ? typeof answer === 'boolean'
          : body.group === 'match:new_since_import'
            ? answer === 'new'
            : body.group === 'match:existing_flight'
              ? answer === 'link' || answer === 'new'
              : false
  if (!valid) throw invalid('Answer does not fit this question')
  return {
    group: body.group,
    answer: answer as GroupAnswerRequest['answer'],
    revision: body.revision as number,
  }
}

/**
 * Apply one answer to every open row of a group, at the run revision the owner saw. All rows change in one D1 batch
 * or none do; a decision made elsewhere in the meantime is a revision conflict, never a partial application.
 */
export async function answerGroup(
  db: D1Database,
  userId: string,
  runId: string,
  request: GroupAnswerRequest,
): Promise<{ updated: number }> {
  const run = await loadRun(db, userId, runId)
  requireOpenRun(run)
  if (run.revision !== request.revision)
    throw new HttpError(409, 'This import changed; reload it', 'HISTORY_REVISION_CONFLICT')
  const isMatch = request.group.startsWith('match:')
  const headers = runHeaders(run)
  const { results } = await db
    .prepare(
      `SELECT ${ROW_COLUMNS} FROM history_import_rows WHERE run_id = ? AND user_id = ? AND state = 'needs_review'
         AND (EXISTS (SELECT 1 FROM json_each(issues_json) WHERE json_extract(value, '$.group') = ?)
           OR (? = 1 AND json_extract(finding_json, '$.kind') = ?))`,
    )
    .bind(run.id, userId, request.group, isMatch ? 1 : 0, request.group.slice('match:'.length))
    .all<RowRecord>()
  const updates = results.flatMap((row) => {
    const previous = rowAnswers(row)
    const finding = rowFinding(row)
    if (isMatch) {
      // A match group settles only rows whose mapping is clean; `link` needs exactly one found flight.
      if (JSON.parse(row.issues_json).length) return []
      if (request.answer === 'link' && finding?.flightId == null) return []
    }
    const answers: HistoryStoredAnswers = isMatch
      ? { ...previous, match: request.answer as 'new' | 'link' }
      : { ...previous, groups: { ...previous.groups, [request.group]: request.answer } }
    return [
      {
        id: row.id,
        version: row.version,
        answers,
        ...rowUpdate(evaluateStored(headers, row, answers)),
      },
    ]
  })
  if (updates.length === 0)
    throw new HttpError(409, 'Nothing is waiting on this answer', 'HISTORY_GROUP_EMPTY')
  const now = nowIso()
  const statements = writeSlices(updates).map((slice) =>
    db
      .prepare(
        `UPDATE history_import_rows SET answers_json = json(j.answers), state = j.state, action = j.action,
           issues_json = json(j.issues), match_date = j.md, match_origin = j.mo, match_destination = j.mdst,
           version = history_import_rows.version + 1, updated_at = ?
         FROM (SELECT json_extract(value, '$.id') AS id, json_extract(value, '$.version') AS version,
                 json_extract(value, '$.answers') AS answers, json_extract(value, '$.state') AS state,
                 json_extract(value, '$.action') AS action, json_extract(value, '$.issues') AS issues,
                 json_extract(value, '$.md') AS md, json_extract(value, '$.mo') AS mo,
                 json_extract(value, '$.mdst') AS mdst
               FROM json_each(?)) AS j
         WHERE history_import_rows.id = j.id AND history_import_rows.version = j.version
           AND history_import_rows.run_id = ? AND history_import_rows.user_id = ?
           AND EXISTS (SELECT 1 FROM history_import_runs WHERE id = ? AND revision = ? AND generation = ?)`,
      )
      .bind(now, JSON.stringify(slice), run.id, userId, run.id, run.revision, run.generation),
  )
  statements.push(runStatusStatement(db, run, now, { revision: run.revision }))
  const results2 = await db.batch(statements)
  if (!results2[results2.length - 1].meta.changes)
    throw new HttpError(409, 'This import changed; reload it', 'HISTORY_REVISION_CONFLICT')
  return {
    updated: results2.slice(0, -1).reduce((sum, result) => sum + (result.meta.changes ?? 0), 0),
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Confirmation

export function parseConfirm(body: unknown): {
  items: HistoryConfirmItem[]
  timezone: string | null
} {
  if (!isRecord(body) || !Array.isArray(body.items) || body.items.length === 0)
    throw invalid('Items required')
  if (body.items.length > HISTORY_CONFIRM_MAX)
    throw new HttpError(400, `At most ${HISTORY_CONFIRM_MAX} records per request`, 'TOO_MANY_ITEMS')
  const seen = new Set<string>()
  const items = body.items.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.rowId !== 'string' ||
      item.rowId.length > 64 ||
      !Number.isInteger(item.version) ||
      !isIdempotencyKey(item.key) ||
      seen.has(item.rowId) ||
      seen.has(`key:${item.key}`)
    )
      throw invalid('Items are invalid')
    seen.add(item.rowId)
    seen.add(`key:${item.key}`)
    return { rowId: item.rowId, version: item.version as number, key: item.key as string }
  })
  const timezone = body.timezone
  if (timezone !== undefined && timezone !== null && canonicalTimeZone(timezone) === null)
    throw invalid('Timezone is invalid')
  return { items, timezone: (timezone as string | null | undefined) ?? null }
}

export const confirmDigest = (rowId: string, version: number) =>
  sha256Hex(JSON.stringify({ kind: 'history_confirm', rowId, version }))

const failure = (
  item: HistoryConfirmItem,
  status: number,
  code: string,
  error: string,
): HistoryConfirmResult => ({
  rowId: item.rowId,
  key: item.key,
  status: 'error',
  http_status: status,
  code,
  error,
})

function toFlightInput(evaluation: Evaluation): FlightInput {
  const p = evaluation.candidate.projection
  return {
    date: p.date!,
    origin: p.origin!,
    destination: p.destination!,
    airline_iata: p.airline,
    flight_number: p.flightNumber,
    aircraft_icao: p.aircraftIcao,
    departure_time: p.departureTime,
    arrival_time: p.arrivalTime,
    source: 'ai_import',
  }
}

export async function confirmRows(
  db: D1Database,
  userId: string,
  runId: string,
  { items, timezone }: { items: HistoryConfirmItem[]; timezone: string | null },
): Promise<{
  results: HistoryConfirmResult[]
  run: Awaited<ReturnType<typeof runSummary>>
  derived: DerivedRepairResult | null
}> {
  const run = await loadRun(db, userId, runId)
  const headers = runHeaders(run)
  const readRows = async () => {
    const { results } = await db
      .prepare(
        `SELECT ${ROW_COLUMNS} FROM history_import_rows WHERE user_id = ? AND run_id = ?
           AND (id IN (SELECT value FROM json_each(?)) OR operation_key IN (SELECT value FROM json_each(?)))`,
      )
      .bind(
        userId,
        run.id,
        JSON.stringify(items.map((item) => item.rowId)),
        JSON.stringify(items.map((item) => item.key)),
      )
      .all<RowRecord>()
    return results
  }
  const before = await readRows()
  const byId = new Map(before.map((row) => [row.id, row]))
  const byKey = new Map(
    before.filter((row) => row.operation_key).map((row) => [row.operation_key!, row]),
  )

  // Receipt first: an answered key replays whatever happened since, even after a discard or erasure.
  const results: Array<HistoryConfirmResult | null> = items.map((item) => {
    const owner = byKey.get(item.key)
    if (owner && owner.id !== item.rowId)
      return failure(item, 409, 'IDEMPOTENCY_CONFLICT', 'Key already used for another record')
    const row = byId.get(item.rowId)
    if (!row) return failure(item, 404, 'NOT_FOUND', 'Record not found')
    if (row.operation_key === item.key)
      return {
        rowId: row.id,
        key: item.key,
        status: 'replayed',
        state: row.state,
        flightId: row.flight_id,
      }
    if (row.operation_key)
      return failure(item, 409, 'HISTORY_ROW_CONFIRMED', 'Record already confirmed')
    return null
  })
  if (results.some((result) => result === null)) {
    if (run.status === 'receiving' || run.status === 'closed')
      for (const [index, item] of items.entries())
        results[index] ??= failure(
          item,
          409,
          'HISTORY_RUN_CLOSED',
          'This import no longer accepts decisions',
        )
  }

  const now = nowIso()
  const creates: Array<{
    index: number
    item: HistoryConfirmItem
    target: HistoryTarget
    input: FlightInput
  }> = []
  const others: D1PreparedStatement[] = []
  const reopen: Array<{ row: RowRecord; evaluation: Evaluation }> = []
  /** Link items by row id: the flight the link needs. A refused link whose flight is gone sends its row back. */
  const linkTargets = new Map<string, number>()
  for (const [index, item] of items.entries()) {
    if (results[index]) continue
    const row = byId.get(item.rowId)!
    if (row.version !== item.version) {
      results[index] = failure(
        item,
        409,
        'HISTORY_ROW_VERSION_CONFLICT',
        'This record changed; reload it',
      )
      continue
    }
    if (row.state !== 'ready') {
      results[index] = failure(
        item,
        409,
        'HISTORY_ROW_NOT_READY',
        'This record still needs a decision',
      )
      continue
    }
    const evaluation = evaluateStored(headers, row, rowAnswers(row))
    if (evaluation.state !== 'ready' || evaluation.action !== row.action) {
      reopen.push({ row, evaluation })
      results[index] = failure(
        item,
        409,
        'HISTORY_ROW_NEEDS_REVIEW',
        'This record needs a decision',
      )
      continue
    }
    const requestDigest = await confirmDigest(row.id, row.version)
    if (evaluation.action === 'create') {
      const p = evaluation.candidate.projection
      creates.push({
        index,
        item,
        input: toFlightInput(evaluation),
        target: {
          rowId: row.id,
          version: row.version,
          runId: run.id,
          generation: run.generation,
          acknowledged: evaluation.acknowledged,
          requestDigest,
          timing:
            p.departureUtc && p.arrivalUtc
              ? {
                  departureUtc: p.departureUtc,
                  arrivalUtc: p.arrivalUtc,
                  fromSchedule: p.timesFrom === 'scheduled_gate',
                }
              : null,
        },
      })
    } else {
      const state = evaluation.action === 'link' ? 'duplicate' : 'preserved_only'
      const flightId = evaluation.action === 'link' ? evaluation.linkFlightId : null
      if (flightId !== null) linkTargets.set(row.id, flightId)
      others.push(
        db
          .prepare(
            `UPDATE history_import_rows SET state = ?, flight_id = ?, version = version + 1, operation_key = ?,
               request_digest = ?, committed_at = ?, updated_at = ?
             WHERE id = ? AND run_id = ? AND user_id = ? AND version = ? AND state = 'ready' AND action = ?
               AND (? IS NULL OR EXISTS (SELECT 1 FROM flights WHERE id = ? AND user_id = ?))
               AND EXISTS (SELECT 1 FROM history_import_runs WHERE id = ? AND generation = ? AND status IN ('review','completed'))
               AND NOT EXISTS (SELECT 1 FROM history_import_rows k WHERE k.user_id = ? AND k.operation_key = ?)`,
          )
          .bind(
            state,
            flightId,
            item.key,
            requestDigest,
            now,
            now,
            row.id,
            run.id,
            userId,
            row.version,
            evaluation.action,
            flightId,
            flightId,
            userId,
            run.id,
            run.generation,
            userId,
            item.key,
          ),
      )
    }
  }
  // A row whose mapping no longer yields `ready` (catalog change, or a rule fix) goes back to review.
  for (const { row, evaluation } of reopen)
    others.push(
      db
        .prepare(
          `UPDATE history_import_rows SET state = ?, action = ?, issues_json = ?, version = version + 1, updated_at = ?
           WHERE id = ? AND user_id = ? AND version = ? AND state = 'ready'`,
        )
        .bind(
          evaluation.state,
          evaluation.action,
          JSON.stringify(evaluation.candidate.issues),
          now,
          row.id,
          userId,
          row.version,
        ),
    )

  // Links and preserved records touch only their rows; they commit before, and independently of, the creates.
  if (others.length) await db.batch([...others, runStatusStatement(db, run, now)])
  let derived: DerivedRepairResult | null = null
  if (creates.length) {
    const created = await bulkCreate(
      db,
      userId,
      creates.map(({ item, input }) => ({ key: item.key, flight: input })),
      {
        timezone,
        history: creates.map(({ target }) => target),
        trailing: [runStatusStatement(db, run, now)],
      },
    )
    derived = created.derived
    for (const [position, { index, item }] of creates.entries()) {
      const result = created.results[position]
      if (
        result.status === 'error' &&
        result.code !== 'RECEIPT_MISSING' &&
        result.code !== 'IDEMPOTENCY_GONE'
      )
        results[index] = failure(item, result.http_status, result.code, result.error)
    }
  }

  // Classify every item still unanswered from the rows as they are now.
  const after = new Map((await readRows()).map((row) => [row.id, row]))
  const duplicateRows: RowRecord[] = []
  const staleLinks: Array<{ index: number; row: RowRecord; flightId: number }> = []
  let currentGeneration: number | undefined
  const generationNow = async () =>
    (currentGeneration ??= (await loadRun(db, userId, run.id)).generation)
  for (const [index, item] of items.entries()) {
    if (results[index]) continue
    const row = after.get(item.rowId)
    if (row?.operation_key === item.key) {
      results[index] = {
        rowId: row.id,
        key: item.key,
        status:
          row.state === 'created'
            ? 'created'
            : row.state === 'duplicate'
              ? 'duplicate'
              : 'preserved_only',
        state: row.state,
        flightId: row.flight_id,
      }
      continue
    }
    if (!row || row.version !== item.version || row.state !== 'ready')
      results[index] = failure(
        item,
        409,
        'HISTORY_ROW_VERSION_CONFLICT',
        'This record changed; reload it',
      )
    else if ((await generationNow()) !== run.generation)
      results[index] = failure(
        item,
        409,
        'HISTORY_RUN_CLOSED',
        'This import no longer accepts decisions',
      )
    else if (creates.some((create) => create.item.rowId === row.id)) {
      // The guard refused: an owned flight now has this date and route.
      duplicateRows.push(row)
      results[index] = failure(
        item,
        409,
        'HISTORY_DUPLICATE',
        'A flight with this date and route exists',
      )
    } else {
      if (linkTargets.has(row.id))
        staleLinks.push({ index, row, flightId: linkTargets.get(row.id)! })
      results[index] = failure(
        item,
        409,
        'HISTORY_ROW_VERSION_CONFLICT',
        'This record changed; reload it',
      )
    }
  }
  // A link guard refuses when its target flight was deleted after the review. The row would stay `ready` with a
  // finding that links to nothing, so it goes back to review as a deleted record the owner must re-confirm.
  if (staleLinks.length) {
    const later = nowIso()
    const reopened = await db.batch([
      ...staleLinks.map(({ row, flightId }) =>
        db
          .prepare(
            `UPDATE history_import_rows SET finding_json = ?, state = 'needs_review', version = version + 1,
               updated_at = ?
             WHERE id = ? AND user_id = ? AND version = ? AND state = 'ready'
               AND NOT EXISTS (SELECT 1 FROM flights WHERE id = ? AND user_id = ?)
               AND EXISTS (SELECT 1 FROM history_import_runs WHERE id = ? AND generation = ? AND status IN ('review','completed'))`,
          )
          .bind(
            JSON.stringify({
              kind: 'previous_deleted',
              flightId: null,
              rowId: rowFinding(row)?.rowId ?? null,
            }),
            later,
            row.id,
            userId,
            row.version,
            flightId,
            userId,
            run.id,
            run.generation,
          ),
      ),
      runStatusStatement(db, run, later),
    ])
    for (const [position, { index }] of staleLinks.entries())
      if (reopened[position].meta.changes)
        results[index] = failure(
          items[index],
          409,
          'HISTORY_ROW_NEEDS_REVIEW',
          'This record needs a decision',
        )
  }
  if (duplicateRows.length) {
    const flights = await db
      .prepare(
        `SELECT r.id AS row_id, f.id AS flight_id FROM history_import_rows r
         JOIN flights f ON f.user_id = r.user_id AND f.date = r.match_date AND f.origin = r.match_origin
           AND f.destination = r.match_destination
         WHERE r.user_id = ? AND r.id IN (SELECT value FROM json_each(?))`,
      )
      .bind(userId, JSON.stringify(duplicateRows.map((row) => row.id)))
      .all<{ row_id: string; flight_id: number }>()
    const later = nowIso()
    await db.batch([
      ...duplicateRows.map((row) => {
        const matches = flights.results.filter((match) => match.row_id === row.id)
        const finding = {
          kind: 'existing_flight',
          flightId: matches.length === 1 ? matches[0].flight_id : null,
          rowId: null,
        }
        return db
          .prepare(
            `UPDATE history_import_rows SET finding_json = ?, state = 'needs_review', version = version + 1, updated_at = ?
             WHERE id = ? AND user_id = ? AND version = ? AND state = 'ready'`,
          )
          .bind(JSON.stringify(finding), later, row.id, userId, row.version)
      }),
      runStatusStatement(db, run, later),
    ])
  }
  return {
    results: results as HistoryConfirmResult[],
    run: await runSummary(db, await loadRun(db, userId, run.id)),
    derived,
  }
}
