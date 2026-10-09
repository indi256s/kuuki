// GET /api/flights/journal?owner=<id> — the owner's whole journal payload (every flight, refs, firsts, revisions) for Journal refetches.
// `owner` binds the read to the account the page was rendered for: after a cross-tab account switch the cookie names
// someone else, and the read is refused before any private data is loaded, so it can never land in the old page's cache.

import { runHandler, json, HttpError } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { readJournalAll } from '../_services/journal'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const owner = new URL(context.request.url).searchParams.get('owner')
    if (!owner) throw new HttpError(400, 'owner is required', 'OWNER_REQUIRED')
    if (owner !== user.id)
      throw new HttpError(409, 'The signed-in account changed', 'OWNER_CHANGED')
    return json(await readJournalAll(context.env.DB, user.id))
  })
