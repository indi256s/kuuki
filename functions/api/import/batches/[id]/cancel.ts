import { requireCsrf, requireUser, type RequestData } from '../../../_lib/auth'
import { json, runHandler } from '../../../_lib/http'
import { cancelBatch } from '../../../_services/importDrafts'
import { abortImportJob } from '../../../_services/importRuntime'

export const onRequestPost: PagesFunction<Env, string, RequestData> = context => runHandler(async () => {
  requireCsrf(context.request)
  const user = requireUser(context.data); const batchId = String(context.params.id)
  await cancelBatch(context.env.DB, user.id, batchId)
  await abortImportJob(context.env, user.id, batchId)
  return json({ cancelled: true })
})
