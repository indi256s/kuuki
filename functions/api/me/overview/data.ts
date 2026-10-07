import { requireUser, type RequestData } from '../../_lib/auth'
import { json, runHandler } from '../../_lib/http'
import { stateOf } from '../../_services/derivedState'
import { overviewEtag, readOverviewData } from '../../_services/overviewData'

export const onRequestGet: PagesFunction<Env, string, RequestData> = context =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const state = await stateOf(context.env.DB, user.id)
    const etag = overviewEtag(state ?? { revision: 0, evidence_revision: 0 })
    if (context.request.headers.get('If-None-Match') === etag) {
      return new Response(null, { status: 304, headers: { 'Cache-Control': 'no-store', ETag: etag } })
    }
    const payload = await readOverviewData(context.env.DB, user.id)
    return json(payload, { headers: { ETag: payload.etag } })
  })
