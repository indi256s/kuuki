// POST /api/flights/aircraft-batch — accept up to 20 aircraft suggestions for owned flights.
import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../_lib/auth'
import { parseFlightBody } from '../_lib/flightValidation'
import { toOwnFlight, type FlightRow } from '../_lib/flights'
import { dirtyUserStatement, repairUserDerivedState } from '../_services/derivedState'
import { FLIGHT_COLUMNS } from './index'

const MAX_ITEMS = 20
type ItemResult =
  | { id: number | null; status: 'accepted'; flight: ReturnType<typeof toOwnFlight> }
  | { id: number | null; status: 'error'; http_status: number; code: string; error: string }

function failure(id: number | null, error: HttpError): ItemResult {
  return { id, status: 'error', http_status: error.status, code: error.code ?? 'INVALID_FLIGHT', error: error.message }
}

export const onRequestPost: PagesFunction<Env, string, RequestData> = context =>
  aircraftBatchRequest(context.request, context.env, context.data)

/** Actual Request/Response domain entry, shared by the Pages compatibility transport. */
export function aircraftBatchRequest(request: Request, env: Env, data: RequestData): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const body = await readJson<{ items?: unknown }>(request, { maxBytes: 16 * 1024 })
    const items = body?.items
    if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'items must be a non-empty array', 'INVALID_ITEMS')
    if (items.length > MAX_ITEMS) throw new HttpError(413, `At most ${MAX_ITEMS} flights per request`, 'TOO_MANY_FLIGHTS')

    const ids = items.map(item => item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>).id : null)
    const duplicates = new Set(ids.filter((id, index) => id != null && ids.indexOf(id) !== index))
    const rows = await env.DB.prepare(`SELECT ${FLIGHT_COLUMNS} FROM flights WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))`)
      .bind(user.id, JSON.stringify(ids.filter(id => Number.isSafeInteger(id) && Number(id) > 0))).all<FlightRow>()
    const existing = new Map(rows.results.map(row => [row.id, row]))
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
          const patch = await parseFlightBody(env.DB, { aircraft_icao: raw.aircraft_icao }, 'patch', existing.get(id))
          if (!patch.aircraft_icao) throw new HttpError(400, 'aircraft_icao is required', 'INVALID_AIRCRAFT')
          accepted.push({ index, id })
          statements.push(env.DB.prepare('UPDATE flights SET aircraft_icao = ? WHERE id = ? AND user_id = ?')
            .bind(patch.aircraft_icao, id, user.id))
          results.push(failure(resultId, new HttpError(500, 'Flight update missing', 'UPDATE_MISSING')))
        } catch (error) {
          if (!(error instanceof HttpError)) throw error
          results.push(failure(resultId, error))
        }
      }
    }
    if (accepted.length === 0) return json({ results })

    // D1 batch is atomic. Mark once with the canonical writes, then publish derived state once.
    const updates = await env.DB.batch([...statements, dirtyUserStatement(env.DB, user.id)])
    const updatedRows = await env.DB.prepare(`SELECT ${FLIGHT_COLUMNS} FROM flights WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))`)
      .bind(user.id, JSON.stringify(accepted.map(item => item.id))).all<FlightRow>()
    const updated = new Map(updatedRows.results.map(row => [row.id, row]))
    for (const [position, item] of accepted.entries()) {
      const row = updated.get(item.id)
      results[item.index] = row && (updates[position].meta.changes ?? 0) > 0
        ? { id: item.id, status: 'accepted', flight: toOwnFlight(row) }
        : failure(item.id, new HttpError(404, 'Flight not found', 'NOT_FOUND'))
    }
    return json({ results, ...await repairUserDerivedState(env.DB, user.id) })
  })
}
