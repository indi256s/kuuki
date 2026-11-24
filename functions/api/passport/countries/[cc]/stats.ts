import { runHandler, json } from '../../../_lib/http'
import { requireUser, type RequestData } from '../../../_lib/auth'
import { readCountryDetail } from '../../../_services/passport'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    return json(await readCountryDetail(context.env.DB, user.id, context.params.cc as string))
  })
