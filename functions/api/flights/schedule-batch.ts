import { AIRCRAFT_BATCH_SIZE } from '../../../packages/shared/src/constants'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { parseFlightBody } from '../_lib/flightValidation'
import { toOwnFlight, type FlightRow } from '../_lib/flights'
import { HttpError, json, readJson, runHandler } from '../_lib/http'
import { dirtyUserStatement, repairUserDerivedState } from '../_services/derivedState'
import { resolveFlightMetrics } from '../_services/flightMetrics'
import { FLIGHT_COLUMNS } from './index'

type Result = { id: number | null; status: 'accepted'; flight: ReturnType<typeof toOwnFlight> }
  | { id: number | null; status: 'error'; http_status: number; code: string; error: string }
const failure = (id: number | null, error: HttpError): Result => ({ id, status: 'error', http_status: error.status,
  code: error.code ?? 'INVALID_FLIGHT', error: error.message })

export const onRequestPost: PagesFunction<Env, string, RequestData> = context => runHandler(async () => {
  requireCsrf(context.request)
  const user = requireUser(context.data), db = context.env.DB
  const body = await readJson<{ items?: unknown }>(context.request, { maxBytes: 16 * 1024 })
  const items = body?.items
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'items must be a non-empty array', 'INVALID_ITEMS')
  if (items.length > AIRCRAFT_BATCH_SIZE) throw new HttpError(413, `At most ${AIRCRAFT_BATCH_SIZE} flights per request`, 'TOO_MANY_FLIGHTS')
  const ids = items.map(item => item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>).id : null)
  const duplicates = new Set(ids.filter((id, index) => id != null && ids.indexOf(id) !== index))
  const rows = await db.prepare(`SELECT ${FLIGHT_COLUMNS} FROM flights WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))`)
    .bind(user.id, JSON.stringify(ids.filter(id => Number.isSafeInteger(id) && Number(id) > 0))).all<FlightRow>()
  const existing = new Map(rows.results.map(row => [row.id, row]))
  const results: Result[] = [], accepted: Array<{ index: number; id: number }> = [], statements: D1PreparedStatement[] = []
  for (const [index, raw] of items.entries()) {
    const id = ids[index]
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) results.push(failure(null, new HttpError(400, 'Valid flight ID required', 'INVALID_ID')))
    else if (duplicates.has(id)) results.push(failure(id, new HttpError(400, 'Flight ID repeated', 'DUPLICATE_ID')))
    else if (!existing.has(id)) results.push(failure(id, new HttpError(404, 'Flight not found', 'NOT_FOUND')))
    else {
      try {
        const row = existing.get(id)!, item = raw as Record<string, unknown>
        if (Object.keys(item).some(key => !['id', 'departure_time', 'arrival_time'].includes(key))) {
          throw new HttpError(400, 'Unknown schedule field', 'INVALID_FLIGHT')
        }
        const input = await parseFlightBody(db, { departure_time: item.departure_time, arrival_time: item.arrival_time }, 'patch', row)
        if (!input.departure_time || !input.arrival_time) throw new HttpError(400, 'Both schedule times are required', 'INVALID_FLIGHT')
        const metrics = await resolveFlightMetrics(db, { date: row.date, origin: row.origin, destination: row.destination,
          airlineIata: row.airline_iata, flightNumber: row.flight_number, departureTime: input.departure_time, arrivalTime: input.arrival_time,
          originTz: row.origin_tz, destTz: row.dest_tz, clientDistanceKm: row.distance_km, timesFromSchedule: true, excludeFlightId: id })
        if (metrics.departureUtc === null || metrics.arrivalUtc === null) throw new HttpError(400, 'Schedule times need known time zones', 'INVALID_TIMES')
        statements.push(db.prepare(`UPDATE flights SET departure_time=?,arrival_time=?,origin_tz=?,dest_tz=?,
          departure_utc=?,arrival_utc=?,distance_km=?,duration_minutes=?,duration_source=?,zones_overflown=?
          WHERE id=? AND user_id=? AND date=? AND origin=? AND destination=? AND airline_iata IS ? AND flight_number IS ?
          AND departure_time IS ? AND arrival_time IS ? AND origin_tz IS ? AND dest_tz IS ? AND distance_km IS ?
          AND duration_minutes IS ? AND duration_source IS ? AND departure_utc IS ? AND arrival_utc IS ? AND zones_overflown IS ?`)
          .bind(input.departure_time, input.arrival_time, metrics.originTz, metrics.destTz, metrics.departureUtc, metrics.arrivalUtc,
            metrics.distanceKm, metrics.durationMinutes, metrics.durationSource, metrics.zonesOverflown,
            id, user.id, row.date, row.origin, row.destination, row.airline_iata, row.flight_number, row.departure_time,
            row.arrival_time, row.origin_tz, row.dest_tz, row.distance_km, row.duration_minutes, row.duration_source,
            row.departure_utc, row.arrival_utc, row.zones_overflown),
          dirtyUserStatement(db, user.id, true))
        accepted.push({ index, id })
        results.push(failure(id, new HttpError(409, 'Flight changed; reload and retry', 'STATE_CONFLICT')))
      } catch (error) {
        if (!(error instanceof HttpError)) throw error
        results.push(failure(id, error))
      }
    }
  }
  if (!accepted.length) return json({ results })
  // Each guarded update and its conditional dirty marker commit in the same atomic batch.
  const updates = await db.batch(statements)
  const updatedRows = await db.prepare(`SELECT ${FLIGHT_COLUMNS} FROM flights WHERE user_id=? AND id IN (SELECT value FROM json_each(?))`)
    .bind(user.id, JSON.stringify(accepted.map(item => item.id))).all<FlightRow>()
  const updated = new Map(updatedRows.results.map(row => [row.id, row]))
  let changed = false
  for (const [position, item] of accepted.entries()) {
    const row = updated.get(item.id)
    if (!row) results[item.index] = failure(item.id, new HttpError(404, 'Flight not found', 'NOT_FOUND'))
    else if ((updates[position * 2].meta.changes ?? 0) > 0) {
      changed = true
      results[item.index] = { id: item.id, status: 'accepted', flight: toOwnFlight(row) }
    }
  }
  return json({ results, ...(changed ? await repairUserDerivedState(db, user.id) : {}) })
})
