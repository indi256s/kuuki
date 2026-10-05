// GET/POST /api/me/transit-review — the optional cleanup that lets a member reclassify historical connections as
// transit (ADR 0001 §5). GET reads only. POST takes { operationId, action: 'apply' | 'dismiss', items? } with a receipt.
import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { parseReviewRequest, readTransitReview, reviewTransit } from '../_services/transitReview'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    return json(await readTransitReview(context.env.DB, user.id))
  })

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env, data } = context
    requireCsrf(request)
    const user = requireUser(data)
    const body = await readJson<unknown>(request)
    if (body === null) throw new HttpError(400, 'Invalid transit review request', 'INVALID_REQUEST')
    return json(await reviewTransit(env.DB, user.id, parseReviewRequest(body)))
  })
