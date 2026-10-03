// POST /api/passport/ground-visits — record a ground visit.

import { runHandler, json, readJson, HttpError } from '../../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../../_lib/auth'
import { newId } from '../../_lib/crypto'
import { nowIso } from '../../_lib/time'
import { toGroundVisit } from '../../_lib/passportDtos'
import { parseCountryCode } from '../../_lib/params'
import { dirtyUserStatement, repairUserDerivedState } from '../../_services/derivedState'

interface GroundVisitBody {
  countryCode?: string
  visitYear?: number | null
  note?: string | null
  entryMethod?: string | null
}

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env } = context
    requireCsrf(request)
    const user = requireUser(context.data)

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
