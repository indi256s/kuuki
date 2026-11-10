// DELETE /api/import/history/:id/source — erase every stored cell of this import, PNR and notes included.
// Flights stay; unconfirmed records are dropped from review; erased cells never come back (ADR 0008).
import { json, runHandler } from '../../../_lib/http'
import { rateLimit } from '../../../_lib/ratelimit'
import { requireCsrf, requireUser, type RequestData } from '../../../_lib/auth'
import { eraseRunSource } from '../../../_services/historyImport'

export const onRequestDelete: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    requireCsrf(context.request)
    const user = requireUser(context.data)
    await rateLimit(context.env.DB, `history-import:${user.id}`, 600, 3600)
    return json(await eraseRunSource(context.env.DB, user.id, String(context.params.id)))
  })
