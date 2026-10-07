import { overviewPrefsSchema, parsePrefs } from '../../../../packages/shared/src/overview/prefs'
import { requireCsrf, requireUser, type RequestData } from '../../_lib/auth'
import { HttpError, json, readJson, runHandler } from '../../_lib/http'
import { nowIso } from '../../_lib/time'

const invalidPrefs = () => new HttpError(400, 'Invalid overview preferences', 'INVALID_PREFS')

export const onRequestGet: PagesFunction<Env, string, RequestData> = context => runHandler(async () => {
  const user = requireUser(context.data)
  const profile = await context.env.DB.prepare('SELECT overview_prefs FROM profiles WHERE id = ?')
    .bind(user.id).first<{ overview_prefs: string | null }>()
  if (!profile) throw new HttpError(404, 'Profile not found', 'NOT_FOUND')
  return json(parsePrefs(profile.overview_prefs))
})

export const onRequestPut: PagesFunction<Env, string, RequestData> = context => runHandler(async () => {
  requireCsrf(context.request)
  const user = requireUser(context.data)
  const body = await readJson<unknown>(context.request).catch(error => {
    if (error instanceof HttpError && error.status === 413) throw invalidPrefs()
    throw error
  })
  const parsed = overviewPrefsSchema.safeParse(body)
  if (!parsed.success || JSON.stringify(body).length > 8192) throw invalidPrefs()
  // Validation stays strict; tolerant parsing of this validated body retains facet insertion order.
  const prefs = { ...parsed.data, filter: parsePrefs(JSON.stringify(body)).filter }
  const profile = await context.env.DB.prepare('UPDATE profiles SET overview_prefs = ?, updated_at = ? WHERE id = ? RETURNING id')
    .bind(JSON.stringify(prefs), nowIso(), user.id).first<{ id: string }>()
  if (!profile) throw new HttpError(404, 'Profile not found', 'NOT_FOUND')
  return json(prefs)
})
