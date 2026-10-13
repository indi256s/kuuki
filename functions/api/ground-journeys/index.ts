// GET /api/ground-journeys — the owner's live journeys, list order and completed totals.
// POST /api/ground-journeys — create (planned or completed) with a receipt-guarded operation key.

import { runHandler, json, readJson, HttpError } from '../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../_lib/auth'
import { isIsoDate } from '../../../packages/shared/src/groundTravel'
import {
  GROUND_BODY_MAX_BYTES,
  applyGroundCommand,
  parseGroundCommand,
} from '../_services/groundJourneys'
import { readJourneyList } from '../_services/groundJourneyRead'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  listGroundJourneysRequest(context.request, context.env, context.data)

export function listGroundJourneysRequest(
  request: Request,
  env: Env,
  data: RequestData,
): Promise<Response> {
  return runHandler(async () => {
    const user = requireUser(data)
    const params = new URL(request.url).searchParams
    const mode = params.get('mode')
    if (mode !== null && mode !== 'rail' && mode !== 'road')
      throw new HttpError(400, 'mode must be rail or road', 'VALIDATION')
    const status = params.get('status')
    if (status !== null && status !== 'cancelled')
      throw new HttpError(400, 'status must be cancelled', 'VALIDATION')
    const today = params.get('today') ?? new Date().toISOString().slice(0, 10)
    if (!isIsoDate(today)) throw new HttpError(400, 'today must be YYYY-MM-DD', 'VALIDATION')
    return json(
      await readJourneyList(env.DB, user.id, {
        mode: mode ?? undefined,
        cancelledOnly: status === 'cancelled',
        today,
      }),
    )
  })
}

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  createGroundJourneyRequest(context.request, context.env, context.data)

export function createGroundJourneyRequest(
  request: Request,
  env: Env,
  data: RequestData,
): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const body = await readJson<unknown>(request, { maxBytes: GROUND_BODY_MAX_BYTES })
    const command = parseGroundCommand(body, { method: 'POST' })
    const { status, result } = await applyGroundCommand(env.DB, user.id, command)
    return json(result, { status })
  })
}
