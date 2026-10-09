import { AIRCRAFT_BATCH_SIZE } from '../../../packages/shared/src/constants'
// POST /api/flights/aircraft-batch — accept up to 20 aircraft suggestions for owned flights.
//
// Outcome contract (replay-safe absolute set):
// - Each item gets its own result: `accepted` (with the resulting flight) or `error` (http_status, code, message).
//   Valid items are written in one atomic D1 batch together with the derived-state dirty marker.
// - Missing-only is the default; replaceAll: true explicitly permits overwriting an existing aircraft.
//   The request sets an absolute aircraft value, it never increments anything. Replaying an identical request, for
//   example after a lost response, returns `accepted` with the same flight state and leaves the flight rows unchanged.
//   Invalid items (NOT_FOUND, UNKNOWN_AIRCRAFT, ...) fail the same way on every replay.
// - Derived state is marked dirty and republished on every call that writes, so a replay yields the same totals
//   at a later revision; nothing is counted twice. There is no server receipt or idempotency key: the client
//   treats a lost answer as `uncertain` and resends the same items.
import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../_lib/auth'
import { parseFlightBody } from '../_lib/flightValidation'
import { toOwnFlight, type FlightRow } from '../_lib/flights'
import { dirtyUserStatement, repairUserDerivedState } from '../_services/derivedState'
import { FLIGHT_COLUMNS } from './index'

const MAX_ITEMS = AIRCRAFT_BATCH_SIZE
type ItemResult =
  | { id: number | null; status: 'accepted'; flight: ReturnType<typeof toOwnFlight> }
  | { id: number | null; status: 'error'; http_status: number; code: string; error: string }

function failure(id: number | null, error: HttpError): ItemResult {
  return {
    id,
    status: 'error',
    http_status: error.status,
    code: error.code ?? 'INVALID_FLIGHT',
    error: error.message,
  }
}

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  aircraftBatchRequest(context.request, context.env, context.data)

/** Actual Request/Response domain entry, shared by the Pages compatibility transport. */
export function aircraftBatchRequest(
  request: Request,
  env: Env,
  data: RequestData,
): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const body = await readJson<{ items?: unknown; replaceAll?: unknown }>(request, {
      maxBytes: 16 * 1024,
    })
    if (body?.replaceAll !== undefined && typeof body.replaceAll !== 'boolean')
      throw new HttpError(400, 'replaceAll must be a boolean', 'INVALID_ITEMS')
    const replaceAll = body?.replaceAll === true
    const items = body?.items
    if (!Array.isArray(items) || items.length === 0)
      throw new HttpError(400, 'items must be a non-empty array', 'INVALID_ITEMS')
    if (items.length > MAX_ITEMS)
      throw new HttpError(413, `At most ${MAX_ITEMS} flights per request`, 'TOO_MANY_FLIGHTS')

    const ids = items.map((item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>).id
        : null,
    )
    const duplicates = new Set(ids.filter((id, index) => id != null && ids.indexOf(id) !== index))
    const rows = await env.DB.prepare(
      `SELECT ${FLIGHT_COLUMNS} FROM flights WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))`,
    )
      .bind(user.id, JSON.stringify(ids.filter((id) => Number.isSafeInteger(id) && Number(id) > 0)))
      .all<FlightRow>()
    const existing = new Map(rows.results.map((row) => [row.id, row]))
    const results: ItemResult[] = []
    const accepted: Array<{ index: number; id: number }> = []
    const statements: D1PreparedStatement[] = []
    for (const [index, item] of items.entries()) {
      const id = ids[index]
      const validId = typeof id === 'number' && Number.isSafeInteger(id) && id > 0
      const resultId = validId ? id : null
      if (!validId) {
        results.push(failure(null, new HttpError(400, 'Valid flight ID required', 'INVALID_ID')))
      } else if (duplicates.has(id)) {
        results.push(failure(id, new HttpError(400, 'Flight ID repeated', 'DUPLICATE_ID')))
      } else if (!existing.has(id)) {
        results.push(failure(id, new HttpError(404, 'Flight not found', 'NOT_FOUND')))
      } else {
        try {
          const raw = item as Record<string, unknown>
          // The ordinary PATCH validator enforces both code shape and aircraft reference membership.
          const patch = await parseFlightBody(
            env.DB,
            { aircraft_icao: raw.aircraft_icao },
            'patch',
            existing.get(id),
          )
          if (!patch.aircraft_icao)
            throw new HttpError(400, 'aircraft_icao is required', 'INVALID_AIRCRAFT')
          accepted.push({ index, id })
          statements.push(
            env.DB.prepare(
              "UPDATE flights SET aircraft_icao = ? WHERE id = ? AND user_id = ? AND (? = 1 OR aircraft_icao IS NULL OR aircraft_icao = '' OR aircraft_icao = ?)",
            ).bind(patch.aircraft_icao, id, user.id, replaceAll ? 1 : 0, patch.aircraft_icao),
          )
          results.push(
            failure(resultId, new HttpError(500, 'Flight update missing', 'UPDATE_MISSING')),
          )
        } catch (error) {
          if (!(error instanceof HttpError)) throw error
          results.push(failure(resultId, error))
        }
      }
    }
    if (accepted.length === 0) return json({ results })

    // D1 batch is atomic. Mark once with the canonical writes, then publish derived state once.
    const updates = await env.DB.batch([...statements, dirtyUserStatement(env.DB, user.id)])
    const updatedRows = await env.DB.prepare(
      `SELECT ${FLIGHT_COLUMNS} FROM flights WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))`,
    )
      .bind(user.id, JSON.stringify(accepted.map((item) => item.id)))
      .all<FlightRow>()
    const updated = new Map(updatedRows.results.map((row) => [row.id, row]))
    for (const [position, item] of accepted.entries()) {
      const row = updated.get(item.id)
      results[item.index] =
        row && (updates[position].meta.changes ?? 0) > 0
          ? { id: item.id, status: 'accepted', flight: toOwnFlight(row) }
          : failure(
              item.id,
              row
                ? new HttpError(
                    409,
                    'Aircraft changed elsewhere; reload before replacing it',
                    'STATE_CONFLICT',
                  )
                : new HttpError(404, 'Flight not found', 'NOT_FOUND'),
            )
    }
    return json({ results, ...(await repairUserDerivedState(env.DB, user.id)) })
  })
}
