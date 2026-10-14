// /api/ground-places/manual — the owner's private manual places (name + country, optional coordinates/timezone).

import { runHandler, json, readJson, HttpError } from '../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../_lib/auth'
import {
  createManualPlace,
  listManualPlaces,
  parseManualPlaceInput,
} from '../_services/groundPlaces'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  listManualPlacesRequest(context.env, context.data)

export function listManualPlacesRequest(env: Env, data: RequestData): Promise<Response> {
  return runHandler(async () => {
    const user = requireUser(data)
    return json(await listManualPlaces(env.DB, user.id))
  })
}

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  createManualPlaceRequest(context.request, context.env, context.data)

/**
 * Idempotent by client id: 201 on creation, 200 with the stored place when the same owner repeats the same
 * payload, 409 for a different payload or an id that is not the caller's (the two are indistinguishable).
 */
export function createManualPlaceRequest(
  request: Request,
  env: Env,
  data: RequestData,
): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const parsed = parseManualPlaceInput(await readJson<unknown>(request))
    if (!parsed.ok) throw new HttpError(400, parsed.error, 'INVALID')
    const result = await createManualPlace(env.DB, user.id, parsed.input)
    if (result.kind === 'conflict')
      throw new HttpError(409, 'Place id is already in use', 'CONFLICT')
    return json(result.place, { status: result.kind === 'created' ? 201 : 200 })
  })
}
