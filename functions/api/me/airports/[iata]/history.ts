import { requireUser, type RequestData } from '../../../_lib/auth'
import { HttpError, json, runHandler } from '../../../_lib/http'
import { readAirportHistory } from '../../../_services/airportHistory'

export const onRequestGet: PagesFunction<Env, 'iata', RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const query = new URL(context.request.url).searchParams
    const owner = query.get('owner')
    if (!owner) throw new HttpError(400, 'owner is required', 'OWNER_REQUIRED')
    if (owner !== user.id)
      throw new HttpError(409, 'The signed-in account changed', 'OWNER_CHANGED')
    return json(
      await readAirportHistory(
        context.env.DB,
        user.id,
        String(context.params.iata),
        query.get('scope'),
        query.get('cursor'),
      ),
    )
  })
