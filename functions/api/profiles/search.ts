import { runHandler, json } from '../_lib/http'
import { requireUser } from '../_lib/auth'
import type { RequestData } from '../_lib/auth'
import { toPublicProfile } from '../_lib/profiles'
import type { ProfileRow } from '../_lib/profiles'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    requireUser(context.data)
    const q = new URL(context.request.url).searchParams.get('q')?.trim() ?? ''
    if (q.length < 2) return json([])

    const pattern = '%' + q.replace(/[\\%_]/g, '\\$&') + '%'
    const result = await context.env.DB.prepare(
      "SELECT * FROM profiles WHERE is_public = 1 AND lower(username) LIKE lower(?) ESCAPE '\\' LIMIT 10",
    )
      .bind(pattern)
      .all<ProfileRow>()

    return json((result.results ?? []).map(toPublicProfile))
  })
