import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'

interface Candidate { date: string; origin: string; destination: string; excludeId?: number }

// Bounded candidate keys query the entire owned history, independently of list paging.
export const onRequestPost: PagesFunction<Env, string, RequestData> = context =>
  runHandler(async () => {
    const user = requireUser(context.data)
    requireCsrf(context.request)
    const body = await readJson<{ candidates?: unknown }>(context.request, { maxBytes: 24_000 })
    if (!Array.isArray(body?.candidates) || body.candidates.length > 100) throw new HttpError(400, 'At most 100 candidates are required', 'INVALID_CANDIDATES')
    const candidates: Candidate[] = body.candidates.map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new HttpError(400, 'Invalid candidate', 'INVALID_CANDIDATES')
      const value = item as Partial<Candidate>
      if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
          !Number.isFinite(Date.parse(value.date)) || new Date(value.date).toISOString().slice(0, 10) !== value.date ||
          typeof value.origin !== 'string' || !/^[A-Z]{3}$/.test(value.origin) ||
          typeof value.destination !== 'string' || !/^[A-Z]{3}$/.test(value.destination) ||
          (value.excludeId !== undefined && (!Number.isSafeInteger(value.excludeId) || value.excludeId <= 0))) {
        throw new HttpError(400, 'Invalid candidate', 'INVALID_CANDIDATES')
      }
      return { date: value.date, origin: value.origin, destination: value.destination, ...(value.excludeId === undefined ? {} : { excludeId: value.excludeId }) }
    })
    if (!candidates.length) return json({ matches: [] }, { headers: { 'Cache-Control': 'no-store' } })
    const result = await context.env.DB.prepare(
      `SELECT CAST(c.key AS INTEGER) AS candidateIndex, MIN(f.id) AS flightId
       FROM json_each(?) c JOIN flights f
         ON f.user_id = ? AND f.date = json_extract(c.value, '$.date')
         AND f.origin = json_extract(c.value, '$.origin')
         AND f.destination = json_extract(c.value, '$.destination')
         AND (json_extract(c.value, '$.excludeId') IS NULL OR f.id != json_extract(c.value, '$.excludeId'))
       GROUP BY c.key ORDER BY CAST(c.key AS INTEGER)`,
    ).bind(JSON.stringify(candidates), user.id).all<{ candidateIndex: number; flightId: number }>()
    if (!result.success || !Array.isArray(result.results)) throw new Error('Duplicate candidate read failed')
    return json({ matches: result.results }, { headers: { 'Cache-Control': 'no-store' } })
  })
