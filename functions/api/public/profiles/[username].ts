import { runHandler, json, HttpError } from '../../_lib/http'
import { readPublicProfile } from '../../_services/publicProfiles'

export const onRequestGet: PagesFunction<Env> = (context) =>
  runHandler(async () => {
    const profile = await readPublicProfile(context.env.DB, context.params.username as string)
    if (!profile) throw new HttpError(404, 'Profile not found', 'NOT_FOUND')
    return json(profile)
  })
