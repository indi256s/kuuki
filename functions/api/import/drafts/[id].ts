// PATCH /api/import/drafts/:id — a version-checked, owner-scoped review edit: corrections, selection, the explicit
// year decision and the duplicate acknowledgement. A stale version or a converted row is 409 DRAFT_VERSION_CONFLICT
// with the current draft, so another tab's edit is never overwritten.
import { runHandler, readJson, json } from '../../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../../_lib/auth'
import { parseDraftPatch, patchDraft } from '../../_services/importDrafts'

export const onRequestPatch: PagesFunction<Env, string, RequestData> = context =>
  runHandler(async () => {
    requireCsrf(context.request)
    const user = requireUser(context.data)
    const patch = parseDraftPatch(await readJson<unknown>(context.request, { maxBytes: 8 * 1024 }))
    return json({ draft: await patchDraft(context.env.DB, user.id, String(context.params.id), patch, new Date()) })
  })
