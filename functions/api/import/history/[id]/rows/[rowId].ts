// PATCH /api/import/history/:id/rows/:rowId — `{version, answers?, ignore?}` for one record (ADR 0008).
import { json, readJson, runHandler } from '../../../../_lib/http'
import { rateLimit } from '../../../../_lib/ratelimit'
import { requireCsrf, requireUser, type RequestData } from '../../../../_lib/auth'
import { parsePatchRow, patchRow } from '../../../../_services/historyImportDecisions'

export const onRequestPatch: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    requireCsrf(context.request)
    const user = requireUser(context.data)
    await rateLimit(context.env.DB, `history-import:${user.id}`, 600, 3600)
    const request = parsePatchRow(await readJson<unknown>(context.request, { maxBytes: 8 * 1024 }))
    return json(
      await patchRow(
        context.env.DB,
        user.id,
        String(context.params.id),
        String(context.params.rowId),
        request,
      ),
    )
  })
