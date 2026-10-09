// GET /api/flights/journal — the owner's whole journal payload (every flight, refs, firsts, revisions) for Journal refetches.

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { readJournalAll } from '../_services/journal'

export const onRequestGet: PagesFunction<Env, string, RequestData> = context =>
  runHandler(async () => {
    const user = requireUser(context.data)
    return json(await readJournalAll(context.env.DB, user.id))
  })
