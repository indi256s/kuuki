// GET /api/profiles/check-username?username= — availability check for the authenticated user,
// excluding their own row. Empty / too-short usernames are treated as unavailable.

import { runHandler, json } from '../_lib/http'
import { requireUser } from '../_lib/auth'
import type { RequestData } from '../_lib/auth'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const username = new URL(context.request.url).searchParams.get('username')?.trim() ?? ''
    if (username.length < 3) return json({ available: false })

    const taken = await context.env.DB.prepare(
      'SELECT id FROM profiles WHERE lower(username) = lower(?) AND id != ? LIMIT 1',
    )
      .bind(username, user.id)
      .first<{ id: string }>()

    return json({ available: !taken })
  })
