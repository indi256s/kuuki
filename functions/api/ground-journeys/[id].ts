// GET /api/ground-journeys/:id — one own journey; foreign, missing and deleted ids are one 404.
// PATCH — update | complete | reopen | cancel | restore. DELETE — delete (body: operationKey, expectedVersion).

import { runHandler, json, readJson, HttpError } from '../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../_lib/auth'
import { isUuid } from '../../../packages/shared/src/groundTravel'
import {
  GROUND_BODY_MAX_BYTES,
  applyGroundCommand,
  parseGroundCommand,
} from '../_services/groundJourneys'
import { readOwnerJourney } from '../_services/groundJourneyRead'

const idOf = (raw: string | string[]) => {
  const id = Array.isArray(raw) ? raw[0] : raw
  if (!isUuid(id)) throw new HttpError(404, 'Journey not found', 'NOT_FOUND')
  return id.toLowerCase()
}

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  getGroundJourneyRequest(context.request, context.env, context.data, context.params.id)

export function getGroundJourneyRequest(
  _request: Request,
  env: Env,
  data: RequestData,
  rawId: string | string[],
): Promise<Response> {
  return runHandler(async () => {
    const user = requireUser(data)
    const journey = await readOwnerJourney(env.DB, user.id, idOf(rawId))
    if (!journey) throw new HttpError(404, 'Journey not found', 'NOT_FOUND')
    return json(journey)
  })
}

export const onRequestPatch: PagesFunction<Env, string, RequestData> = (context) =>
  mutateGroundJourneyRequest(context.request, context.env, context.data, context.params.id, 'PATCH')

export const onRequestDelete: PagesFunction<Env, string, RequestData> = (context) =>
  mutateGroundJourneyRequest(
    context.request,
    context.env,
    context.data,
    context.params.id,
    'DELETE',
  )

export function mutateGroundJourneyRequest(
  request: Request,
  env: Env,
  data: RequestData,
  rawId: string | string[],
  method: 'PATCH' | 'DELETE',
): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const journeyId = idOf(rawId)
    const body = await readJson<unknown>(request, { maxBytes: GROUND_BODY_MAX_BYTES })
    const command = parseGroundCommand(body, { method, journeyId })
    const { result } = await applyGroundCommand(env.DB, user.id, command)
    return json(result)
  })
}
