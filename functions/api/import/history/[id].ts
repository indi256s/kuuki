// GET /api/import/history/:id — summary and one keyset page of rows (`state`, `group`, `cursor`, `limit` ≤ 50);
// with `representation=archive`, every record and its private source cells as a JSON download (ADR 0008).
// DELETE /api/import/history/:id — discard what is not confirmed; created flights stay.
import { json, runHandler } from '../../_lib/http'
import { rateLimit } from '../../_lib/ratelimit'
import { requireCsrf, requireUser, type RequestData } from '../../_lib/auth'
import { discardRun, readArchive, readRunPage } from '../../_services/historyImport'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const query = new URL(context.request.url).searchParams
    const runId = String(context.params.id)
    if (query.get('representation') === 'archive') {
      const archive = await readArchive(context.env.DB, user.id, runId)
      return json(archive, {
        headers: {
          'Content-Disposition': `attachment; filename="kuuki-flighty-${archive.createdAt.slice(0, 10)}.json"`,
        },
      })
    }
    return json(await readRunPage(context.env.DB, user.id, runId, query))
  })

export const onRequestDelete: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    requireCsrf(context.request)
    const user = requireUser(context.data)
    await rateLimit(context.env.DB, `history-import:${user.id}`, 600, 3600)
    return json(await discardRun(context.env.DB, user.id, String(context.params.id)))
  })
