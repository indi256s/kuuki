import { runHandler, json, HttpError } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { searchGroundPlaces } from '../_services/groundPlaces'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  searchGroundPlacesRequest(context.request, context.env, context.data)

export function searchGroundPlacesRequest(
  request: Request,
  env: Env,
  data: RequestData,
): Promise<Response> {
  return runHandler(async () => {
    const user = requireUser(data)
    const params = new URL(request.url).searchParams
    const q = params.get('q')
    if (q === null || q.length > 200) throw new HttpError(400, 'q is invalid', 'INVALID')
    const locale = params.get('locale') ?? 'en'
    if (locale !== 'ru' && locale !== 'en') throw new HttpError(400, 'locale is invalid', 'INVALID')
    return json(await searchGroundPlaces(env.DB, user.id, q))
  })
}
