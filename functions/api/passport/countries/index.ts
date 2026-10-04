// GET /api/passport/countries — raw passport collections for the FE to merge with countries.json.

import { runHandler, json } from '../../_lib/http'
import { requireUser, type RequestData } from '../../_lib/auth'
import { readPassport } from '../../_services/passport'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    return json(await readPassport(context.env.DB, user.id))
  })
