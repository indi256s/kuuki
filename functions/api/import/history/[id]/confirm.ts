// POST /api/import/history/:id/confirm — `{timezone?, items: [{rowId, version, key}]}`, at most 50 (ADR 0008).
// Receipt-first and per item: a retry after a lost answer replays; flights come from the shared create chain.
import { json, readJson, runHandler } from '../../../_lib/http'
import { rateLimit } from '../../../_lib/ratelimit'
import { requireCsrf, requireUser, type RequestData } from '../../../_lib/auth'
import { confirmRows, parseConfirm } from '../../../_services/historyImportDecisions'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    requireCsrf(context.request)
    const user = requireUser(context.data)
    await rateLimit(context.env.DB, `history-import:${user.id}`, 600, 3600)
    const request = parseConfirm(await readJson<unknown>(context.request, { maxBytes: 64 * 1024 }))
    const { results, run, derived } = await confirmRows(
      context.env.DB,
      user.id,
      String(context.params.id),
      request,
    )
    return json({ results, run, ...(derived ?? {}) })
  })
