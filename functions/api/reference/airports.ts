// GET /api/reference/airports — public airports reference table.

import { runHandler, json } from '../_lib/http'
import type { RequestData } from '../_lib/auth'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { results } = await context.env.DB.prepare(
      'SELECT iata, icao, name, city, country, country_code, latitude, longitude FROM airports_reference ORDER BY iata',
    ).all()
    return json(results ?? [])
  })
