// GET /api/me/awaiting — the owner's confirmation queue (ADR 0001 §5). Read-only: it never moves a flight,
// repairs derived state or writes a row, so opening the queue cannot change what it shows.
import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { readAwaitingQueue } from '../_services/queue'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    return json(await readAwaitingQueue(context.env.DB, user.id))
  })
