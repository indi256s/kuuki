// GET /api/flights/check-duplicate?date=&origin=&destination=&excludeId= — same date+route flight, or null.

import { runHandler, json, HttpError } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { toOwnFlight, type FlightRow } from '../_lib/flights'
import { FLIGHT_COLUMNS } from './index'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const params = new URL(context.request.url).searchParams
    const date = params.get('date')
    const origin = params.get('origin')
    const destination = params.get('destination')
    if (!date || !origin || !destination) {
      throw new HttpError(400, 'date, origin and destination are required', 'MISSING_PARAMS')
    }
    const excludeId = params.get('excludeId')

    let sql = `SELECT ${FLIGHT_COLUMNS} FROM flights WHERE user_id = ? AND date = ? AND origin = ? AND destination = ?`
    const binds: (string | number)[] = [user.id, date, origin, destination]
    if (excludeId) {
      sql += ' AND id != ?'
      binds.push(Number(excludeId))
    }
    sql += ' LIMIT 1'

    const row = await context.env.DB
      .prepare(sql)
      .bind(...binds)
      .first<FlightRow>()
    return json(row ? toOwnFlight(row) : null)
  })
