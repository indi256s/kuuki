// GET /api/reference/aircraft — public aircraft reference table (may be empty until seeded).

import { runHandler, json } from '../_lib/http'
import type { RequestData } from '../_lib/auth'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { results } = await context.env.DB.prepare(
      'SELECT icao, iata, name, manufacturer, model, type, engine_type, engine_count FROM aircraft_reference ORDER BY icao',
    ).all()
    return json(results ?? [])
  })
