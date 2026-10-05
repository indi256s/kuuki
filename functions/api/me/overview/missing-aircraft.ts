import { runHandler, json, HttpError } from '../../_lib/http'
import { requireUser, type RequestData } from '../../_lib/auth'
import { isCursor, readMissingAircraft } from '../../_services/missingAircraft'
import type { OverviewPeriod } from '../../../../packages/shared/src/overview'

/**
 * `GET /api/me/overview/missing-aircraft?period=all|YYYY[&after=<cursor>]`: one newest-first page (at most 100) of the
 * owner's completed flights with no aircraft in the period, the set `dataAvailability.missingAircraft` counts, with the
 * exact total and the cursor for the next page.
 */
export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const params = new URL(context.request.url).searchParams
    const period = params.get('period') ?? 'all'
    if (period !== 'all' && !/^(19|20|21)\d{2}$/.test(period)) throw new HttpError(400, 'Invalid period', 'INVALID_PERIOD')
    const after = params.get('after')
    if (after !== null && !isCursor(after)) throw new HttpError(400, 'Invalid cursor', 'INVALID_CURSOR')
    const page = await readMissingAircraft(context.env.DB, user.id, period as OverviewPeriod, after)
    return json(page, { headers: { 'Cache-Control': 'private, no-store' } })
  })
