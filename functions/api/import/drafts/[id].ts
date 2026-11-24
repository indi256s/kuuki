import { runHandler, readJson, json } from '../../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../../_lib/auth'
import { parseDraftPatch, patchDraft } from '../../_services/importDrafts'

export const onRequestPatch: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    requireCsrf(context.request)
    const user = requireUser(context.data)
    const patch = parseDraftPatch(await readJson<unknown>(context.request, { maxBytes: 8 * 1024 }))
    return json({
      draft: await patchDraft(
        context.env.DB,
        user.id,
        String(context.params.id),
        patch,
        new Date(),
      ),
    })
  })
