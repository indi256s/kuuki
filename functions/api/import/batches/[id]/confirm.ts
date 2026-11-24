import { runHandler, readJson, json } from '../../../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../../../_lib/auth'
import { confirmBatch, parseConfirmRequest } from '../../../_services/importConversion'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    requireCsrf(context.request)
    const user = requireUser(context.data)
    const request = parseConfirmRequest(
      await readJson<unknown>(context.request, { maxBytes: 64 * 1024 }),
    )
    const { results, batch, derived } = await confirmBatch(
      context.env.DB,
      user.id,
      String(context.params.id),
      request,
      new Date(),
    )
    return json({ results, batch, ...(derived ?? {}) })
  })
