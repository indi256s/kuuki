// The requester is gated before their earned badge read.
import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { readOwnBadges } from '../_services/ownBadges'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => json(await readOwnBadges(context.env.DB, requireUser(context.data).id)))
