// GET /api/import/batches/:id — the owner's batch snapshot: status, stage, revision, expiry and every draft with its
// duplicate match and validation issue. D1 is authoritative, so this is also the refresh/remount read.
// DELETE /api/import/batches/:id — explicit discard. Closing the page is not a discard.
import { runHandler, json } from '../../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../../_lib/auth'
import { batchNotFound, discardBatch, readBatchSnapshot } from '../../_services/importDrafts'

export const onRequestGet: PagesFunction<Env, string, RequestData> = context =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const snapshot = await readBatchSnapshot(context.env.DB, user.id, String(context.params.id), new Date())
    if (!snapshot) throw batchNotFound()
    return json(snapshot)
  })

export const onRequestDelete: PagesFunction<Env, string, RequestData> = context =>
  runHandler(async () => {
    requireCsrf(context.request)
    const user = requireUser(context.data)
    if (!await discardBatch(context.env.DB, user.id, String(context.params.id))) throw batchNotFound()
    return json({ deleted: true })
  })
