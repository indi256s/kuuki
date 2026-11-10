// PATCH /api/passport/ground-visits/:id edits one ground visit's year, note or way; DELETE removes it (own only).

import { runHandler, json, readJson, HttpError } from '../../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../../_lib/auth'
import { toGroundVisit, type GroundVisitRow } from '../../_lib/passportDtos'
import { dirtyUserStatement, repairUserDerivedState } from '../../_services/derivedState'
import { parseGroundVisitFields } from '../../_lib/groundVisits'

const EDITABLE = ['visitYear', 'note', 'entryMethod', 'mode'] as const

export const onRequestPatch: PagesFunction<Env, string, RequestData> = (context) =>
  updateGroundVisitRequest(context.request, context.env, context.data, context.params.id as string)

/** Fields left out of the body keep their stored value; the merged row is validated as a whole. */
export function updateGroundVisitRequest(
  request: Request,
  env: Env,
  data: RequestData,
  id: string,
): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const body = await readJson<Record<string, unknown>>(request)
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new HttpError(400, 'body is invalid', 'INVALID')

    const current = await env.DB.prepare(
      'SELECT id, user_id, country_code, visit_year, entry_method, mode, note, created_at, linked_flight_id FROM ground_visits WHERE id = ? AND user_id = ?',
    )
      .bind(id, user.id)
      .first<GroundVisitRow>()
    if (!current) throw new HttpError(404, 'Ground visit not found', 'NOT_FOUND')

    const merged: Record<string, unknown> = {
      visitYear: current.visit_year,
      note: current.note,
      entryMethod: current.entry_method,
      mode: current.mode,
    }
    for (const key of EDITABLE) if (Object.hasOwn(body, key)) merged[key] = body[key]
    const fields = parseGroundVisitFields(merged)

    // Compare-and-set on the row as read: a concurrent edit must not be overwritten by fields this body left out.
    const [result] = await env.DB.batch([
      env.DB.prepare(
        `UPDATE ground_visits SET visit_year = ?, note = ?, entry_method = ?, mode = ?
         WHERE id = ? AND user_id = ? AND visit_year IS ? AND note IS ? AND entry_method IS ? AND mode IS ?`,
      ).bind(
        fields.visitYear,
        fields.note,
        fields.entryMethod,
        fields.mode,
        id,
        user.id,
        current.visit_year,
        current.note,
        current.entry_method,
        current.mode,
      ),
      dirtyUserStatement(env.DB, user.id, true),
    ])
    if (!result.meta.changes) {
      const exists = await env.DB.prepare(
        'SELECT 1 FROM ground_visits WHERE id = ? AND user_id = ?',
      )
        .bind(id, user.id)
        .first()
      if (!exists) throw new HttpError(404, 'Ground visit not found', 'NOT_FOUND')
      throw new HttpError(409, 'Ground visit changed; reload and try again', 'STATE_CONFLICT')
    }
    const derived = await repairUserDerivedState(env.DB, user.id)

    return json({
      ...toGroundVisit({
        ...current,
        visit_year: fields.visitYear,
        note: fields.note,
        entry_method: fields.entryMethod,
        mode: fields.mode,
      }),
      ...derived,
    })
  })
}

export const onRequestDelete: PagesFunction<Env, string, RequestData> = (context) =>
  deleteGroundVisitRequest(context.request, context.env, context.data, context.params.id as string)

/** Request/Response entry keeps compatibility transport separate from domain writes. */
export function deleteGroundVisitRequest(
  request: Request,
  env: Env,
  data: RequestData,
  rawId: string,
): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const id = rawId

    const [result] = await env.DB.batch([
      env.DB.prepare('DELETE FROM ground_visits WHERE id = ? AND user_id = ?').bind(id, user.id),
      dirtyUserStatement(env.DB, user.id, true),
    ])

    return json({
      ok: true,
      ...(result.meta.changes ? await repairUserDerivedState(env.DB, user.id) : {}),
    })
  })
}
