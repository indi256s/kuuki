// GET /api/profiles/:id — own profile returns the full own-view; others return the public view
// only when they have opted in (is_public). Private profiles 404 to avoid leaking existence.

import { runHandler, json, HttpError } from '../_lib/http'
import { requireUser } from '../_lib/auth'
import type { RequestData } from '../_lib/auth'
import { getProfileRow, toOwnProfile, toPublicProfile } from '../_lib/profiles'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const id = context.params.id as string
    const row = await getProfileRow(context.env.DB, id)
    if (!row) throw new HttpError(404, 'Profile not found', 'NOT_FOUND')
    if (id === user.id) return json(toOwnProfile(row))
    if (row.is_public) return json(toPublicProfile(row))
    throw new HttpError(404, 'Profile not found', 'NOT_FOUND')
  })
