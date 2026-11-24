import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { confirmFlights, parseConfirmRequest } from '../_services/confirmation'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)
    const body = await readJson<unknown>(request)
    if (body === null) throw new HttpError(400, 'Invalid confirmation request', 'INVALID_REQUEST')
    return json(await confirmFlights(env.DB, user.id, parseConfirmRequest(body)))
  })
