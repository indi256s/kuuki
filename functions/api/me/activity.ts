import { requireCsrf, requireUser, type RequestData } from '../_lib/auth'
import { json, runHandler } from '../_lib/http'
import { nowIso } from '../_lib/time'

export const onRequestPost: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    requireCsrf(context.request)
    const seenAt = nowIso()
    const day = seenAt.slice(0, 10)
    await context.env.DB.batch([
      context.env.DB.prepare(
        'INSERT INTO user_activity_days (user_id, day, first_seen_at) VALUES (?, ?, ?) ON CONFLICT(user_id, day) DO NOTHING',
      ).bind(user.id, day, seenAt),
      context.env.DB.prepare(
        'INSERT INTO user_activity_collection (id, started_at) VALUES (1, ?) ON CONFLICT(id) DO NOTHING',
      ).bind(seenAt),
    ])
    return json({ day })
  })
