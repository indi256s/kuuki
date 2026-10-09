import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { findDuplicateMatches, type DuplicateCandidate as Candidate } from '../_services/duplicates'

// Bounded candidate keys query the entire owned history, independently of list paging.
export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    requireCsrf(context.request)
    const body = await readJson<{ candidates?: unknown }>(context.request, { maxBytes: 24_000 })
    if (!Array.isArray(body?.candidates) || body.candidates.length > 100)
      throw new HttpError(400, 'At most 100 candidates are required', 'INVALID_CANDIDATES')
    const candidates: Candidate[] = body.candidates.map((item: unknown) => {
      if (!item || typeof item !== 'object')
        throw new HttpError(400, 'Invalid candidate', 'INVALID_CANDIDATES')
      const value = item as Partial<Candidate>
      if (
        typeof value.date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
        !Number.isFinite(Date.parse(value.date)) ||
        new Date(value.date).toISOString().slice(0, 10) !== value.date ||
        typeof value.origin !== 'string' ||
        !/^[A-Z]{3}$/.test(value.origin) ||
        typeof value.destination !== 'string' ||
        !/^[A-Z]{3}$/.test(value.destination) ||
        (value.excludeId !== undefined &&
          (!Number.isSafeInteger(value.excludeId) || value.excludeId <= 0))
      ) {
        throw new HttpError(400, 'Invalid candidate', 'INVALID_CANDIDATES')
      }
      return {
        date: value.date,
        origin: value.origin,
        destination: value.destination,
        ...(value.excludeId === undefined ? {} : { excludeId: value.excludeId }),
      }
    })
    return json(
      { matches: await findDuplicateMatches(context.env.DB, user.id, candidates) },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  })
