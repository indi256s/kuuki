import { runHandler, json, HttpError } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { readOverview } from '../_services/overview'
import type { OverviewPeriod } from '../../../packages/shared/src/overview'
import { parseFlightFilters } from '../_lib/flightQuery'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const params = new URL(context.request.url).searchParams
    const period = params.get('period') ?? params.get('year') ?? 'all'
    if (period !== 'all' && !/^(19|20|21)\d{2}$/.test(period)) {
      throw new HttpError(400, 'Invalid period', 'INVALID_PERIOD')
    }
    const summary = await readOverview(context.env.DB, user.id, period as OverviewPeriod, parseFlightFilters(params))
    const body = JSON.stringify(summary)
    console.log(JSON.stringify({ event: 'overview_response', bytes: new TextEncoder().encode(body).length }))
    return json(summary, { headers: { 'Cache-Control': 'private, no-store' } })
  })
