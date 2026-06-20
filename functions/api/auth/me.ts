// GET /api/auth/me — session bootstrap. Returns { user, profile } or { user: null }.

import { runHandler, json } from '../_lib/http'
import type { RequestData } from '../_lib/auth'
import { getProfileRow, toOwnProfile } from '../_lib/profiles'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = context.data.user
    if (!user) return json({ user: null, profile: null })
    const profileRow = await getProfileRow(context.env.DB, user.id)
    return json({ user, profile: profileRow ? toOwnProfile(profileRow) : null })
  })
