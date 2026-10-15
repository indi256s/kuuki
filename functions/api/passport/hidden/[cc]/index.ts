// PUT /api/passport/hidden/:cc — hide a pressed country from the Passport collection and public profile (idempotent).
// DELETE /api/passport/hidden/:cc — restore it (idempotent).
// Hiding is presentation only: no derived state is dirtied because nothing derived reads this table.

import { runHandler, json, HttpError } from '../../../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../../../_lib/auth'
import { nowIso } from '../../../_lib/time'
import { parseCountryCode } from '../../../_lib/params'
import { readHiddenCountries } from '../../../_services/passport'

export const onRequestPut: PagesFunction<Env, string, RequestData> = (context) =>
  hideCountryRequest(context.request, context.env, context.data, context.params.cc)

/** Request/Response entry keeps compatibility transport separate from domain writes. */
export function hideCountryRequest(
  request: Request,
  env: Env,
  data: RequestData,
  rawCode: string | string[],
): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const cc = parseCountryCode(rawCode)

    // Only a pressed country can be hidden: pending-only and absent countries have no stamp to hide.
    const [inserted] = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO passport_hidden_countries (user_id, country_code, hidden_at)
         SELECT user_id, country_code, ? FROM country_visit_evidence
         WHERE user_id = ? AND country_code = ? AND status = 'pressed'
         ON CONFLICT (user_id, country_code) DO NOTHING`,
      ).bind(nowIso(), user.id, cc),
    ])
    if (!inserted.meta.changes) {
      const hidden = await readHiddenCountries(env.DB, user.id)
      if (!hidden.includes(cc))
        throw new HttpError(409, 'Only a pressed country can be hidden', 'NOT_PRESSED')
    }
    return json({ ok: true, hidden: await readHiddenCountries(env.DB, user.id) })
  })
}

export const onRequestDelete: PagesFunction<Env, string, RequestData> = (context) =>
  unhideCountryRequest(context.request, context.env, context.data, context.params.cc)

/** Request/Response entry keeps compatibility transport separate from domain writes. */
export function unhideCountryRequest(
  request: Request,
  env: Env,
  data: RequestData,
  rawCode: string | string[],
): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const cc = parseCountryCode(rawCode)

    await env.DB.prepare(
      'DELETE FROM passport_hidden_countries WHERE user_id = ? AND country_code = ?',
    )
      .bind(user.id, cc)
      .run()
    return json({ ok: true, hidden: await readHiddenCountries(env.DB, user.id) })
  })
}
