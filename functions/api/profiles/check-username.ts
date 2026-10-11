// GET /api/profiles/check-username?username= — availability check for the authenticated user,
// excluding their own row. A username that fails the address pattern is reported invalid.

import { runHandler, json } from '../_lib/http'
import { requireUser } from '../_lib/auth'
import type { RequestData } from '../_lib/auth'
import { ADDRESS_PATTERN, normalizeAddress } from '../../../packages/shared/src/address'

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const username = normalizeAddress(
      new URL(context.request.url).searchParams.get('username') ?? '',
    )
    if (!ADDRESS_PATTERN.test(username)) return json({ available: false, valid: false })

    const taken = await context.env.DB.prepare(
      'SELECT id FROM profiles WHERE lower(username) = lower(?) AND id != ? LIMIT 1',
    )
      .bind(username, user.id)
      .first<{ id: string }>()

    return json({ available: !taken, valid: true })
  })
