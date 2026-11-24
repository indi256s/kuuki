import { runHandler, json, readJson, HttpError } from '../../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../../_lib/auth'
import { newId } from '../../_lib/crypto'
import { nowIso } from '../../_lib/time'
import { toGroundVisit, type GroundVisitRow } from '../../_lib/passportDtos'
import { parseCatalogCountryCode } from '../../_lib/params'
import { parseGroundVisitFields, parseVisitId } from '../../_lib/groundVisits'
import { dirtyUserStatement, repairUserDerivedState } from '../../_services/derivedState'
import { assertRows } from '../../_lib/d1'

type GroundVisitBody = {
  id?: string
  countryCode?: string
  visitYear?: number | null
  note?: string | null
  entryMethod?: string | null
  mode?: string | null
}

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  listGroundVisitsRequest(context.request, context.env, context.data)

export function listGroundVisitsRequest(
  request: Request,
  env: Env,
  data: RequestData,
): Promise<Response> {
  return runHandler(async () => {
    const user = requireUser(data)
    const rows = await env.DB.prepare(
      'SELECT id, user_id, country_code, visit_year, entry_method, mode, note, created_at, linked_flight_id FROM ground_visits WHERE user_id = ? ORDER BY created_at DESC, id',
    )
      .bind(user.id)
      .all<GroundVisitRow>()
    assertRows(rows, 'Ground visits unavailable')
    return json(rows.results.map(toGroundVisit))
  })
}

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  createGroundVisitRequest(context.request, context.env, context.data)

export function createGroundVisitRequest(
  request: Request,
  env: Env,
  data: RequestData,
): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)

    const body = await readJson<GroundVisitBody>(request)
    const countryCode = parseCatalogCountryCode(body?.countryCode)

    const visitId = parseVisitId(body?.id)
    const { visitYear, note, entryMethod, mode } = parseGroundVisitFields(body ?? {})
    const id = visitId ?? newId()
    const createdAt = nowIso()

    const results = await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO ground_visits (id, user_id, country_code, visit_year, note, entry_method, mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
      ).bind(id, user.id, countryCode, visitYear, note, entryMethod, mode, createdAt),
      dirtyUserStatement(env.DB, user.id, true),
      env.DB.prepare(
        'SELECT id, user_id, country_code, visit_year, entry_method, mode, note, created_at, linked_flight_id FROM ground_visits WHERE id = ? AND user_id = ?',
      ).bind(id, user.id),
    ])
    assertRows(results, 'Ground visit unavailable', 3)
    const [insert, , read] = results
    const row = read.results[0] as GroundVisitRow | undefined
    if (!row || row.country_code !== countryCode)
      throw new HttpError(409, 'Visit id already used for another visit', 'IDEMPOTENCY_CONFLICT')
    const derived = await repairUserDerivedState(env.DB, user.id)

    return json(
      { ...toGroundVisit(row), ...derived },
      { status: (insert.meta.changes ?? 0) > 0 ? 201 : 200 },
    )
  })
}
