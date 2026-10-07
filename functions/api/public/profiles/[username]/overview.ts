import { HttpError, json, runHandler } from '../../../_lib/http'
import { readPublicOverview } from '../../../_services/publicOverview'

export const onRequestGet: PagesFunction<Env> = context => runHandler(async () => {
  const overview = await readPublicOverview(context.env.DB, context.params.username as string)
  if (!overview) throw new HttpError(404, 'Profile not found', 'NOT_FOUND')
  return json(overview, { headers: { 'Cache-Control': 'public, max-age=300' } })
})
