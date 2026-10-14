// Ground journey mutations (.scratch/ground-travel/storage-contract.md): receipt-first, one D1 batch each.
//
// Order of work: session + CSRF, static command shape and digest (no resource reads), the owner's receipt for the
// operation key, and only for a new command the current state (owner, mode, status, version, manual places).
// One batch holds
//   1. INSERT receipt (complete 0, applied 0, fresh nonce)       - a duplicate key aborts the batch
//   2. parent CAS (insert / update / tombstone)
//   3. UPDATE receipt SET applied = changes()                    - right after the CAS, never carried further
//   4. child DELETE / INSERT ... guarded by "receipt of this nonce is applied and open" (+ parent live)
//   5. dirty increment guarded the same way
//   6. UPDATE receipt SET complete = 1 ...                       - CHECK (complete = 0 OR applied = 1) aborts the
//                                                                  whole batch when the CAS matched nothing
// so a lost CAS, even on a journey without children, commits nothing: no receipt, no dirty revision.
import { HttpError } from '../_lib/http'
import { sha256Hex } from '../_lib/crypto'
import {
  GROUND_LIMITS,
  isIsoDate,
  isLocalTime,
  isUuid,
  parsePlaceSnapshot,
  railLegDuration,
  type GroundCommand,
  type GroundJourneyDto,
  type GroundJourneyInput,
  type GroundMutationResult,
  type GroundPlaceSnapshot,
  type RailLegInput,
  type RoadPointInput,
} from '../../../packages/shared/src/groundTravel'
import { repairUserDerivedState, stateOf } from './derivedState'
import { MAX_ATTEMPTS, isConstraintError } from './receipts'
import {
  publicationOf,
  readOwnerJourney,
  receiptStatement,
  type ReceiptRow,
} from './groundJourneyRead'
import { firstOf, rowsOf } from './stats'

const invalid = (message: string) => new HttpError(400, message, 'VALIDATION')
const notFound = () => new HttpError(404, 'Journey not found', 'NOT_FOUND')
const gone = () => new HttpError(410, 'Journey was deleted', 'GONE')
const stateConflict = (message: string, cause: string) =>
  new HttpError(409, message, 'STATE_CONFLICT', { cause })

// ---------------------------------------------------------------------------
// Static command shape
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function text(value: unknown, max: number, field: string): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw invalid(`${field} must be text`)
  const trimmed = value.trim()
  // SQLite length() counts characters, so count code points rather than UTF-16 units.
  if ([...trimmed].length > max) throw invalid(`${field} is too long`)
  return trimmed.length === 0 ? null : trimmed
}

function date(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null
  if (!isIsoDate(value)) throw invalid(`${field} must be YYYY-MM-DD`)
  return value
}

function time(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null
  if (!isLocalTime(value)) throw invalid(`${field} must be HH:MM`)
  return value
}

function integer(value: unknown, min: number, max: number, field: string): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    throw invalid(`${field} must be an integer ${min}-${max}`)
  return value
}

function place(value: unknown, field: string): GroundPlaceSnapshot {
  const parsed = parsePlaceSnapshot(value)
  if (!parsed) throw invalid(`${field} is not a valid place`)
  return parsed
}

/** Dates only: times sit in the place's own zone, which may be unknown. ISO dates compare as text. */
function assertDatesInOrder(from: string | null, to: string | null, message: string) {
  if (from && to && to < from) throw invalid(message)
}

function parseLeg(value: unknown): RailLegInput {
  if (!isRecord(value)) throw invalid('leg must be an object')
  if (!isUuid(value.id)) throw invalid('leg id must be a UUID')
  const leg = {
    id: value.id.toLowerCase(),
    from: place(value.from, 'leg from'),
    to: place(value.to, 'leg to'),
    fromStation: text(value.fromStation, GROUND_LIMITS.station, 'fromStation'),
    toStation: text(value.toStation, GROUND_LIMITS.station, 'toStation'),
    trainNumber: text(value.trainNumber, GROUND_LIMITS.trainNumber, 'trainNumber'),
    operator: text(value.operator, GROUND_LIMITS.operator, 'operator'),
    departureDate: date(value.departureDate, 'departureDate'),
    departureTime: time(value.departureTime, 'departureTime'),
    arrivalDate: date(value.arrivalDate, 'arrivalDate'),
    arrivalTime: time(value.arrivalTime, 'arrivalTime'),
    durationMinutes: integer(value.durationMinutes, 1, 20_160, 'durationMinutes'),
  }
  assertDatesInOrder(leg.departureDate, leg.arrivalDate, 'arrivalDate is before departureDate')
  return leg
}

function parsePoint(value: unknown): RoadPointInput {
  if (!isRecord(value)) throw invalid('point must be an object')
  if (!isUuid(value.id)) throw invalid('point id must be a UUID')
  const point = {
    id: value.id.toLowerCase(),
    place: place(value.place, 'point place'),
    arrivalDate: date(value.arrivalDate, 'arrivalDate'),
    departureDate: date(value.departureDate, 'departureDate'),
    nights: integer(value.nights, 0, 3650, 'nights'),
    note: text(value.note, GROUND_LIMITS.note, 'point note'),
  }
  assertDatesInOrder(point.arrivalDate, point.departureDate, 'departureDate is before arrivalDate')
  return point
}

function parseJourney(value: unknown): GroundJourneyInput {
  if (!isRecord(value)) throw invalid('journey must be an object')
  const title = text(value.title, GROUND_LIMITS.title, 'title')
  const note = text(value.note, GROUND_LIMITS.note, 'note')
  const startDate = date(value.startDate, 'startDate')
  const endDate = date(value.endDate, 'endDate')
  if (startDate && endDate && startDate > endDate) throw invalid('startDate is after endDate')
  const fields = { title, note, startDate, endDate }
  const children = (key: 'legs' | 'points', min: number) => {
    const list = value[key]
    if (!Array.isArray(list) || list.length < min || list.length > GROUND_LIMITS.children)
      throw invalid(`${key} must hold ${min}-${GROUND_LIMITS.children} entries`)
    return list
  }
  if (value.mode === 'rail') {
    if (value.points !== undefined) throw invalid('rail journeys have no points')
    const legs = children('legs', 1).map(parseLeg)
    assertUnique(legs.map((leg) => leg.id))
    return { mode: 'rail', ...fields, legs }
  }
  if (value.mode === 'road') {
    if (value.legs !== undefined) throw invalid('road journeys have no legs')
    const points = children('points', 2).map(parsePoint)
    assertUnique(points.map((point) => point.id))
    return { mode: 'road', ...fields, points }
  }
  throw invalid('mode must be rail or road')
}

function assertUnique(ids: string[]) {
  if (new Set(ids).size !== ids.length) throw invalid('child ids must be unique')
}

function parseCountries(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (
    !Array.isArray(value) ||
    value.length > 300 ||
    value.some((code) => typeof code !== 'string' || !/^[A-Z]{2}$/.test(code)) ||
    new Set(value).size !== value.length
  )
    throw invalid('countries must be a unique list of uppercase ISO-2 codes')
  return value as string[]
}

// ASCII only, so JS length and the receipt table's SQL length() CHECK count the same thing.
const OPERATION_KEY = /^[A-Za-z0-9._:-]{8,128}$/

const CONTENT_ACTIONS = new Set(['create', 'update', 'complete'])
const PATCH_ACTIONS = new Set(['update', 'complete', 'reopen', 'cancel', 'restore'])

/**
 * Validates one request body into a GroundCommand. `route` carries what the path fixes: POST creates, DELETE
 * deletes, PATCH takes the action from the body; the journey id of PATCH/DELETE comes from the path.
 */
export function parseGroundCommand(
  body: unknown,
  route: { method: 'POST' | 'PATCH' | 'DELETE'; journeyId?: string },
): GroundCommand {
  if (!isRecord(body)) throw invalid('Body must be a JSON object')
  const action =
    route.method === 'POST' ? 'create' : route.method === 'DELETE' ? 'delete' : body.action
  if (route.method === 'POST' && body.action !== undefined && body.action !== 'create')
    throw invalid('action must be create')
  if (typeof action !== 'string' || (route.method === 'PATCH' && !PATCH_ACTIONS.has(action)))
    throw invalid('Unknown action')
  const { operationKey } = body
  if (typeof operationKey !== 'string' || !OPERATION_KEY.test(operationKey))
    throw invalid('operationKey must be 8-128 characters of A-Z a-z 0-9 . _ : -')
  const journeyId = route.journeyId ?? body.journeyId
  if (!isUuid(journeyId)) throw invalid('journeyId must be a UUID')
  if (route.journeyId && body.journeyId !== undefined && body.journeyId !== route.journeyId)
    throw invalid('journeyId does not match the path')
  const id = journeyId.toLowerCase()

  const hasContent = CONTENT_ACTIONS.has(action)
  if (!hasContent && (body.journey !== undefined || body.countries !== undefined))
    throw invalid(`${action} carries no journey or countries`)

  if (action === 'create') {
    if (body.status !== 'planned' && body.status !== 'completed')
      throw invalid('status must be planned or completed')
    const countries = parseCountries(body.countries)
    if (body.status === 'completed' && !countries) throw invalid('countries are required')
    if (body.status === 'planned' && countries) throw invalid('countries only belong to completed')
    return {
      action,
      operationKey,
      journeyId: id,
      status: body.status,
      journey: parseJourney(body.journey),
      ...(countries ? { countries } : {}),
    }
  }

  const { expectedVersion } = body
  if (!Number.isSafeInteger(expectedVersion) || (expectedVersion as number) < 1)
    throw invalid('expectedVersion must be a positive integer')
  const version = expectedVersion as number
  if (action === 'update' || action === 'complete') {
    const countries = parseCountries(body.countries)
    if (action === 'complete' && !countries) throw invalid('countries are required')
    const journey = parseJourney(body.journey)
    return action === 'complete'
      ? {
          action,
          operationKey,
          journeyId: id,
          expectedVersion: version,
          journey,
          countries: countries!,
        }
      : {
          action,
          operationKey,
          journeyId: id,
          expectedVersion: version,
          journey,
          ...(countries ? { countries } : {}),
        }
  }
  return {
    action: action as 'reopen' | 'cancel' | 'restore' | 'delete',
    operationKey,
    journeyId: id,
    expectedVersion: version,
  }
}

/** JSON with recursively sorted object keys; arrays keep their order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** The request identity: the normalized command without the operation key itself. */
export function commandDigest(command: GroundCommand): Promise<string> {
  const { operationKey: _key, ...rest } = command
  return sha256Hex(canonicalJson(rest))
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

interface ParentRow {
  user_id: string
  mode: 'rail' | 'road'
  status: 'planned' | 'completed' | 'cancelled' | null
  version: number
  deleted_at: string | null
}

const parentOf = (db: D1Database, journeyId: string) =>
  db
    .prepare('SELECT user_id, mode, status, version, deleted_at FROM ground_journeys WHERE id = ?')
    .bind(journeyId)

const operationReused = () =>
  new HttpError(409, 'Operation key already used for a different request', 'IDEMPOTENCY_CONFLICT', {
    cause: 'operation_reused',
  })

/**
 * Largest documented request, at 4 UTF-8 bytes per character (supplementary-plane text):
 *   place snapshot  name, nameRu, nameEn, region 4 x 200 x 4 = 3 200 + ids/timezone/version/keys ~800 = 4 000
 *   road point      note 10 000 x 4 = 40 000 + snapshot 4 000 + id/dates/nights/keys 200       = 44 200
 *   rail leg        2 snapshots 8 000 + stations 2 x 200 x 4 + operator 200 x 4 + train 40 x 4 + keys ~500 = 11 000
 *   journey         title 200 x 4 + note 10 000 x 4 + 300 countries x 5 + envelope ~500          = 42 800
 *   100 road points 4 420 000 + 42 800 = 4 462 800 bytes
 * 5 MiB (5 242 880) leaves ~17% headroom. The 128 KB JSON default is far below it.
 */
export const GROUND_BODY_MAX_BYTES = 5 * 1024 * 1024

/** D1 caps one bound string at 2 MB, so child rows go in several INSERTs; 20 x 44 200 bytes stays under 1 MB. */
const CHILD_CHUNK = 20

export interface GroundMutationResponse {
  status: 200 | 201
  result: GroundMutationResult
}

/** Applies a validated command for the session owner; the owner id never comes from the request. */
export async function applyGroundCommand(
  db: D1Database,
  userId: string,
  command: GroundCommand,
  now: Date = new Date(),
): Promise<GroundMutationResponse> {
  const digest = await commandDigest(command)
  const instant = now.toISOString()
  const readReceipt = () =>
    receiptStatement(db, userId, command.operationKey, instant).first<ReceiptRow>()

  const replay = async (receipt: ReceiptRow): Promise<GroundMutationResponse> => {
    if (receipt.request_digest !== digest) throw operationReused()
    const result = await resultOf(db, userId, receipt, true)
    // The journey is gone: an old save has nothing left to show, a repeated delete only acknowledges.
    if (receipt.outcome === 'saved' && result.current === null) throw gone()
    return { status: 200, result }
  }
  /** A same command may have committed meanwhile: look again before reporting a state-dependent error. */
  const fail = async (error: HttpError): Promise<never> => {
    const late = await readReceipt()
    if (late) throw new Replay(await replay(late))
    throw error
  }

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const known = await readReceipt()
      if (known) return await replay(known)

      await classify(db, userId, command, fail)

      const nonce = crypto.randomUUID()
      try {
        await db.batch(mutationStatements(db, userId, command, digest, nonce, now))
      } catch (error) {
        // Duplicate key, lost CAS (finalize CHECK), or a colliding child id: rolled back whole. Look again.
        if (!isConstraintError(error)) throw error
        continue
      }
      // Publication failure is not a save failure: the receipt is committed, readiness is reported honestly.
      await repairUserDerivedState(db, userId).catch(() => undefined)
      const receipt = await readReceipt()
      if (!receipt) throw new Error('Committed ground receipt is missing')
      return {
        status: command.action === 'create' ? 201 : 200,
        result: await resultOf(db, userId, receipt, false),
      }
    }
    throw stateConflict('Your journeys are changing right now. Try again.', 'concurrent_update')
  } catch (error) {
    if (error instanceof Replay) return error.response
    throw error
  }
}

class Replay extends Error {
  constructor(readonly response: GroundMutationResponse) {
    super('replay')
  }
}

async function resultOf(
  db: D1Database,
  userId: string,
  receipt: ReceiptRow,
  replayed: boolean,
): Promise<GroundMutationResult> {
  const [current, state] = await Promise.all([
    readOwnerJourney(db, userId, receipt.journey_id),
    stateOf(db, userId),
  ])
  return {
    outcome: receipt.outcome,
    journeyId: receipt.journey_id,
    action: receipt.kind as GroundMutationResult['action'],
    savedVersion: receipt.result_version,
    accountRevision: receipt.account_revision,
    derivedState: publicationOf(state, receipt.account_revision),
    replayed,
    current,
  }
}

const FROM_STATUS = {
  complete: 'planned',
  reopen: 'completed',
  cancel: 'planned',
  restore: 'cancelled',
} as const

/** Reads the target and decides whether a new command may run; every refusal re-checks the receipt first. */
async function classify(
  db: D1Database,
  userId: string,
  command: GroundCommand,
  fail: (error: HttpError) => Promise<never>,
): Promise<void> {
  const parent = firstOf<ParentRow>((await db.batch([parentOf(db, command.journeyId)]))[0])

  if (command.action === 'create') {
    if (parent) {
      // A tombstone or any existing id, another owner's included, is never reused.
      if (parent.user_id === userId && parent.deleted_at) await fail(gone())
      await fail(stateConflict('Journey id is already in use', 'id_in_use'))
    }
  } else {
    if (!parent || parent.user_id !== userId) await fail(notFound())
    if (parent!.deleted_at) await fail(gone())
    if (parent!.version !== command.expectedVersion) {
      const current = await readOwnerJourney(db, userId, command.journeyId)
      await fail(
        new HttpError(409, 'Journey changed since you loaded it', 'VERSION_CONFLICT', { current }),
      )
    }
    const required =
      command.action in FROM_STATUS ? FROM_STATUS[command.action as keyof typeof FROM_STATUS] : null
    if (required && parent!.status !== required)
      await fail(
        stateConflict(`Cannot ${command.action} a ${parent!.status} journey`, 'illegal_transition'),
      )
    if ('journey' in command && command.journey.mode !== parent!.mode)
      await fail(stateConflict('Journey mode cannot change', 'mode_mismatch'))
    if (command.action === 'update') {
      const completed = parent!.status === 'completed'
      if (completed && !command.countries)
        throw invalid('countries are required for a completed journey')
      if (!completed && command.countries) throw invalid('countries only belong to completed')
    }
  }

  if ('journey' in command) await assertChildrenUsable(db, userId, command, fail)
}

/** Manual places must be the owner's; child ids must not belong to another journey (primary keys are global). */
async function assertChildrenUsable(
  db: D1Database,
  userId: string,
  command: Extract<GroundCommand, { journey: GroundJourneyInput }>,
  fail: (error: HttpError) => Promise<never>,
) {
  const journey = command.journey
  const places =
    journey.mode === 'rail'
      ? journey.legs.flatMap((leg) => [leg.from, leg.to])
      : journey.points.map((p) => p.place)
  const manual = [...new Set(places.filter((p) => p.source === 'manual').map((p) => p.id))]
  const ids =
    journey.mode === 'rail' ? journey.legs.map((leg) => leg.id) : journey.points.map((p) => p.id)
  const table = journey.mode === 'rail' ? 'ground_rail_legs' : 'ground_road_points'
  const [owned, taken] = await db.batch([
    db
      .prepare(
        'SELECT id FROM ground_manual_places WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))',
      )
      .bind(userId, JSON.stringify(manual)),
    db
      .prepare(
        `SELECT id FROM ${table} WHERE journey_id != ? AND id IN (SELECT value FROM json_each(?)) LIMIT 1`,
      )
      .bind(command.journeyId, JSON.stringify(ids)),
  ])
  if (rowsOf(owned).length !== manual.length) await fail(invalid('A manual place is unknown'))
  if (rowsOf(taken).length > 0)
    await fail(stateConflict('A child id is already in use', 'id_in_use'))
}

function chunked<T>(rows: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += CHILD_CHUNK) out.push(rows.slice(i, i + CHILD_CHUNK))
  return out
}

function guardSql() {
  return `EXISTS (SELECT 1 FROM ground_operation_receipts
            WHERE user_id = ? AND operation_key = ? AND batch_nonce = ? AND applied = 1 AND complete = 0)`
}

function mutationStatements(
  db: D1Database,
  userId: string,
  command: GroundCommand,
  digest: string,
  nonce: string,
  now: Date,
): D1PreparedStatement[] {
  const instant = now.toISOString()
  const expires = new Date(now.getTime() + GROUND_LIMITS.receiptDays * 86_400_000).toISOString()
  const { operationKey: key, journeyId: id } = command
  const guard = [userId, key, nonce]
  const expected = 'expectedVersion' in command ? command.expectedVersion : null
  const parentLive = () =>
    `EXISTS (SELECT 1 FROM ground_journeys WHERE id = ? AND user_id = ? AND mode = ? AND deleted_at IS NULL)`
  const statements: D1PreparedStatement[] = [
    // An expired receipt under this key no longer counts; free the key for the new command.
    db
      .prepare(
        'DELETE FROM ground_operation_receipts WHERE user_id = ? AND operation_key = ? AND expires_at <= ?',
      )
      .bind(userId, key, instant),
    db
      .prepare(
        `INSERT INTO ground_operation_receipts
         (user_id, operation_key, request_digest, journey_id, kind, expected_version, batch_nonce, applied, complete, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      )
      .bind(userId, key, digest, id, command.action, expected, nonce, instant, expires),
  ]

  // Parent CAS; the next statement records whether it matched.
  const fields = 'journey' in command ? command.journey : null
  const bindFields = fields ? [fields.startDate, fields.endDate, fields.title, fields.note] : []
  switch (command.action) {
    case 'create':
      statements.push(
        db
          .prepare(
            `INSERT INTO ground_journeys
             (id, user_id, mode, status, version, start_date, end_date, title, note, created_at, updated_at, confirmed_at)
             SELECT ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM ground_journeys WHERE id = ?)`,
          )
          .bind(
            id,
            userId,
            command.journey.mode,
            command.status,
            ...bindFields,
            instant,
            instant,
            command.status === 'completed' ? instant : null,
            id,
          ),
      )
      break
    case 'update':
      statements.push(
        db
          .prepare(
            `UPDATE ground_journeys SET version = version + 1, updated_at = ?, start_date = ?, end_date = ?, title = ?, note = ?,
               confirmed_at = CASE WHEN status = 'completed' THEN ? ELSE NULL END
             WHERE id = ? AND user_id = ? AND mode = ? AND version = ? AND deleted_at IS NULL`,
          )
          .bind(
            instant,
            ...bindFields,
            instant,
            id,
            userId,
            command.journey.mode,
            command.expectedVersion,
          ),
      )
      break
    case 'complete':
      statements.push(
        db
          .prepare(
            `UPDATE ground_journeys SET version = version + 1, updated_at = ?, start_date = ?, end_date = ?, title = ?, note = ?,
               status = 'completed', confirmed_at = ?
             WHERE id = ? AND user_id = ? AND mode = ? AND version = ? AND deleted_at IS NULL AND status = 'planned'`,
          )
          .bind(
            instant,
            ...bindFields,
            instant,
            id,
            userId,
            command.journey.mode,
            command.expectedVersion,
          ),
      )
      break
    case 'delete':
      statements.push(
        db
          .prepare(
            `UPDATE ground_journeys SET version = version + 1, deleted_at = ?, status = NULL, created_at = NULL,
               updated_at = NULL, confirmed_at = NULL, start_date = NULL, end_date = NULL, title = NULL, note = NULL
             WHERE id = ? AND user_id = ? AND version = ? AND deleted_at IS NULL`,
          )
          .bind(instant, id, userId, command.expectedVersion),
      )
      break
    default: {
      const [to, from] = {
        reopen: ['planned', 'completed'],
        cancel: ['cancelled', 'planned'],
        restore: ['planned', 'cancelled'],
      }[command.action]
      statements.push(
        db
          .prepare(
            `UPDATE ground_journeys SET version = version + 1, updated_at = ?, status = ?, confirmed_at = NULL
             WHERE id = ? AND user_id = ? AND version = ? AND deleted_at IS NULL AND status = ?`,
          )
          .bind(instant, to, id, userId, command.expectedVersion, from),
      )
    }
  }
  statements.push(
    db
      .prepare(
        'UPDATE ground_operation_receipts SET applied = changes() WHERE user_id = ? AND operation_key = ? AND batch_nonce = ?',
      )
      .bind(...guard),
  )

  // Children: each statement checks its own receipt guard (and the parent), never changes().
  const deleteChildren = (table: string) =>
    db
      .prepare(`DELETE FROM ${table} WHERE journey_id = ? AND user_id = ? AND ${guardSql()}`)
      .bind(id, userId, ...guard)
  if (command.action === 'delete') {
    for (const table of ['ground_rail_legs', 'ground_road_points', 'ground_journey_countries'])
      statements.push(deleteChildren(table))
  } else if (command.action === 'reopen') {
    statements.push(deleteChildren('ground_journey_countries'))
  } else if (fields) {
    const live = parentLive()
    if (command.action !== 'create') {
      statements.push(
        deleteChildren(fields.mode === 'rail' ? 'ground_rail_legs' : 'ground_road_points'),
      )
      statements.push(deleteChildren('ground_journey_countries'))
    }
    if (fields.mode === 'rail') {
      const legs = fields.legs.map((leg, ordinal) => {
        const duration = railLegDuration(leg)
        return {
          id: leg.id,
          ordinal,
          from: JSON.stringify(leg.from),
          to: JSON.stringify(leg.to),
          fromStation: leg.fromStation,
          toStation: leg.toStation,
          trainNumber: leg.trainNumber,
          operator: leg.operator,
          departureDate: leg.departureDate,
          departureTime: leg.departureTime,
          arrivalDate: leg.arrivalDate,
          arrivalTime: leg.arrivalTime,
          minutes: duration.minutes,
          source: duration.source,
        }
      })
      for (const chunk of chunked(legs))
        statements.push(
          db
            .prepare(
              `INSERT INTO ground_rail_legs
             (id, journey_id, user_id, ordinal, from_place, to_place, from_station, to_station, train_number, operator,
              departure_date, departure_time, arrival_date, arrival_time, duration_minutes, duration_source)
             SELECT json_extract(value, '$.id'), ?, ?, json_extract(value, '$.ordinal'), json_extract(value, '$.from'),
                    json_extract(value, '$.to'), json_extract(value, '$.fromStation'), json_extract(value, '$.toStation'),
                    json_extract(value, '$.trainNumber'), json_extract(value, '$.operator'),
                    json_extract(value, '$.departureDate'), json_extract(value, '$.departureTime'),
                    json_extract(value, '$.arrivalDate'), json_extract(value, '$.arrivalTime'),
                    json_extract(value, '$.minutes'), json_extract(value, '$.source')
             FROM json_each(?) WHERE ${guardSql()} AND ${live}`,
            )
            .bind(id, userId, JSON.stringify(chunk), ...guard, id, userId, fields.mode),
        )
    } else {
      const points = fields.points.map((point, ordinal) => ({
        id: point.id,
        ordinal,
        place: JSON.stringify(point.place),
        arrivalDate: point.arrivalDate,
        departureDate: point.departureDate,
        nights: point.nights,
        note: point.note,
      }))
      for (const chunk of chunked(points))
        statements.push(
          db
            .prepare(
              `INSERT INTO ground_road_points
             (id, journey_id, user_id, ordinal, place, arrival_date, departure_date, nights, note)
             SELECT json_extract(value, '$.id'), ?, ?, json_extract(value, '$.ordinal'), json_extract(value, '$.place'),
                    json_extract(value, '$.arrivalDate'), json_extract(value, '$.departureDate'),
                    json_extract(value, '$.nights'), json_extract(value, '$.note')
             FROM json_each(?) WHERE ${guardSql()} AND ${live}`,
            )
            .bind(id, userId, JSON.stringify(chunk), ...guard, id, userId, fields.mode),
        )
    }
    const countries = 'countries' in command ? command.countries : undefined
    if (countries && countries.length > 0) {
      statements.push(
        db
          .prepare(
            `INSERT INTO ground_journey_countries (journey_id, user_id, country_code)
             SELECT ?, ?, value FROM json_each(?) WHERE ${guardSql()} AND ${live}`,
          )
          .bind(id, userId, JSON.stringify(countries), ...guard, id, userId, fields.mode),
      )
    }
  }

  statements.push(
    // Upsert form of the dirty mark, guarded by this batch's own applied receipt.
    db
      .prepare(
        `INSERT INTO user_derived_state (user_id, revision, published_revision, last_error, updated_at)
         SELECT ?, 1, 0, NULL, ? WHERE ${guardSql()}
         ON CONFLICT(user_id) DO UPDATE SET
           revision = user_derived_state.revision + 1, last_error = NULL, updated_at = excluded.updated_at`,
      )
      .bind(userId, instant, ...guard),
    // The CHECK fails here when the CAS matched nothing (applied = 0) and rolls the whole batch back.
    db
      .prepare(
        `UPDATE ground_operation_receipts SET complete = 1, outcome = ?,
           result_version = (SELECT version FROM ground_journeys WHERE id = ? AND user_id = ?),
           account_revision = (SELECT revision FROM user_derived_state WHERE user_id = ?)
         WHERE user_id = ? AND operation_key = ? AND batch_nonce = ?`,
      )
      .bind(command.action === 'delete' ? 'deleted' : 'saved', id, userId, userId, ...guard),
  )
  return statements
}

export type { GroundJourneyDto }
