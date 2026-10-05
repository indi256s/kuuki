// GET /api/passport/countries — the passport collection: published country evidence (pressed / pending), the
// airport aggregate, claims and ground visits, and the six-region progress (ADR 0001 §4).

import { runHandler, json } from '../../_lib/http'
import { requireUser, type RequestData } from '../../_lib/auth'
import { readPassportCollection } from '../../_services/passport'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    return json(await readPassportCollection(context.env.DB, user.id))
  })
