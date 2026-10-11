// POST /api/profiles/me/onboarded — mark the authenticated user's onboarding finished.
// Idempotent: the first call stamps onboarded_at, later calls return the same timestamp.

import { runHandler, json, HttpError } from '../../_lib/http'
import { requireCsrf, requireUser } from '../../_lib/auth'
import type { RequestData } from '../../_lib/auth'
import { nowIso } from '../../_lib/time'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    requireCsrf(context.request)
    const user = requireUser(context.data)
    const row = await context.env.DB.prepare(
      'UPDATE profiles SET onboarded_at = COALESCE(onboarded_at, ?) WHERE id = ? RETURNING onboarded_at',
    )
      .bind(nowIso(), user.id)
      .first<{ onboarded_at: string }>()
    if (!row) throw new HttpError(404, 'Profile not found', 'NOT_FOUND')
    return json({ onboarded_at: row.onboarded_at })
  })
