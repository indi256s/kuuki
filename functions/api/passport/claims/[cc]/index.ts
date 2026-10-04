// PUT /api/passport/claims/:cc — claim a country (idempotent upsert).
// DELETE /api/passport/claims/:cc — unclaim (drops ground visits first, then the claim).

import { runHandler, json } from '../../../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../../../_lib/auth'
import { newId } from '../../../_lib/crypto'
import { nowIso } from '../../../_lib/time'
import { parseCountryCode } from '../../../_lib/params'
import { dirtyUserStatement, repairUserDerivedState } from '../../../_services/derivedState'

export const onRequestPut: PagesFunction<Env, string, RequestData> = context =>
  claimCountryRequest(context.request, context.env, context.data, context.params.cc)

/** Request/Response entry keeps compatibility transport separate from domain writes. */
export function claimCountryRequest(request: Request, env: Env, data: RequestData, rawCode: string | string[]): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const cc = parseCountryCode(rawCode)

    const [inserted] = await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO country_claims (id, user_id, country_code, claimed_at) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, country_code) DO NOTHING',
      )
      .bind(newId(), user.id, cc, nowIso()),
      dirtyUserStatement(env.DB, user.id, true),
    ])

    const claim = await env.DB
      .prepare('SELECT id, country_code, claimed_at FROM country_claims WHERE user_id = ? AND country_code = ?')
      .bind(user.id, cc)
      .first()

    return json({ ...claim, ...(inserted.meta.changes ? await repairUserDerivedState(env.DB, user.id) : {}) }, { status: 201 })
  })
}

export const onRequestDelete: PagesFunction<Env, string, RequestData> = context =>
  unclaimCountryRequest(context.request, context.env, context.data, context.params.cc)

/** Request/Response entry keeps compatibility transport separate from domain writes. */
export function unclaimCountryRequest(request: Request, env: Env, data: RequestData, rawCode: string | string[]): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const cc = parseCountryCode(rawCode)

    // Ground visits can exist without a claim, so each DELETE gets its own
    // only-if-changed dirty mark (changes() sees just the preceding statement).
    const [visits, , claims] = await env.DB.batch([
      env.DB.prepare('DELETE FROM ground_visits WHERE user_id = ? AND country_code = ?').bind(user.id, cc),
      dirtyUserStatement(env.DB, user.id, true),
      env.DB.prepare('DELETE FROM country_claims WHERE user_id = ? AND country_code = ?').bind(user.id, cc),
      dirtyUserStatement(env.DB, user.id, true),
    ])

    const changed = visits.meta.changes || claims.meta.changes
    return json({ ok: true, ...(changed ? await repairUserDerivedState(env.DB, user.id) : {}) })
  })
}
