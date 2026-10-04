// POST /api/passport/ground-visits — record a ground visit.

import { runHandler, json, readJson, HttpError } from '../../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../../_lib/auth'
import { newId } from '../../_lib/crypto'
import { nowIso } from '../../_lib/time'
import { toGroundVisit, type GroundVisitRow } from '../../_lib/passportDtos'
import { parseCountryCode } from '../../_lib/params'
import { dirtyUserStatement, repairUserDerivedState } from '../../_services/derivedState'
import { assertRows } from '../../_lib/d1'

interface GroundVisitBody {
  countryCode?: string
  visitYear?: number | null
  note?: string | null
  entryMethod?: string | null
}

export const onRequestGet: PagesFunction<Env, string, RequestData> = context =>
  listGroundVisitsRequest(context.request, context.env, context.data)

/** Owner-scoped management/export projection includes the preserved note. */
export function listGroundVisitsRequest(request: Request, env: Env, data: RequestData): Promise<Response> {
  return runHandler(async () => {
    const user = requireUser(data)
    const rows = await env.DB.prepare('SELECT id, user_id, country_code, visit_year, entry_method, note, created_at FROM ground_visits WHERE user_id = ? ORDER BY created_at DESC, id').bind(user.id).all<GroundVisitRow>()
    assertRows(rows, 'Ground visits unavailable')
    return json(rows.results.map(toGroundVisit))
  })
}

export const onRequestPost: PagesFunction<Env, string, RequestData> = context =>
  createGroundVisitRequest(context.request, context.env, context.data)

/** Request/Response entry keeps compatibility transport separate from domain writes. */
export function createGroundVisitRequest(request: Request, env: Env, data: RequestData): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)

    const body = await readJson<GroundVisitBody>(request)
    const countryCode = parseCountryCode(body?.countryCode)

    const note = body?.note ?? null
    if (note != null && (typeof note !== 'string' || note.length > 200)) throw new HttpError(400, 'note is invalid', 'INVALID')

    const entryMethod = body?.entryMethod ?? null
    if (entryMethod != null && entryMethod !== 'land' && entryMethod !== 'sea') {
      throw new HttpError(400, 'invalid entryMethod', 'INVALID')
    }

    const visitYear = body?.visitYear ?? null
    if (visitYear !== null && (!Number.isInteger(visitYear) || visitYear < 1800 || visitYear > 2200)) throw new HttpError(400, 'visitYear is invalid', 'INVALID')
    const id = newId()
    const createdAt = nowIso()

    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO ground_visits (id, user_id, country_code, visit_year, note, entry_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(id, user.id, countryCode, visitYear, note, entryMethod, createdAt),
      dirtyUserStatement(env.DB, user.id),
    ])
    const derived = await repairUserDerivedState(env.DB, user.id)

    return json(
      { ...toGroundVisit({
        id,
        user_id: user.id,
        country_code: countryCode,
        visit_year: visitYear,
        note,
        entry_method: entryMethod,
        created_at: createdAt,
      }), ...derived },
      { status: 201 },
    )
  })
}
