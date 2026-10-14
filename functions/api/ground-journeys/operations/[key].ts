// GET /api/ground-journeys/operations/:key — the owner's recorded result of one operation key, or `unknown`.

import { runHandler, json } from '../../_lib/http'
import { requireUser, type RequestData } from '../../_lib/auth'
import { readOperationStatus } from '../../_services/groundJourneyRead'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  groundOperationRequest(context.env, context.data, context.params.key)

export function groundOperationRequest(
  env: Env,
  data: RequestData,
  rawKey: string | string[],
): Promise<Response> {
  return runHandler(async () => {
    const user = requireUser(data)
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey
    return json(await readOperationStatus(env.DB, user.id, key, new Date().toISOString()))
  })
}
