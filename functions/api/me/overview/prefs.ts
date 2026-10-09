import { overviewPrefsSchema, parsePrefs } from '../../../../packages/shared/src/overview/prefs'
import { requireCsrf, requireUser, type RequestData } from '../../_lib/auth'
import { HttpError, json, readJson, runHandler } from '../../_lib/http'
import { nowIso } from '../../_lib/time'

const invalidPrefs = () => new HttpError(400, 'Invalid overview preferences', 'INVALID_PREFS')
const writeSchema = overviewPrefsSchema.extend({
  publicSections: overviewPrefsSchema.shape.publicSections.optional(),
})

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const profile = await context.env.DB.prepare('SELECT overview_prefs FROM profiles WHERE id = ?')
      .bind(user.id)
      .first<{ overview_prefs: string | null }>()
    if (!profile) throw new HttpError(404, 'Profile not found', 'NOT_FOUND')
    return json(parsePrefs(profile.overview_prefs))
  })

export const onRequestPut: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    requireCsrf(context.request)
    const user = requireUser(context.data)
    const body = await readJson<unknown>(context.request).catch((error) => {
      if (error instanceof HttpError && error.status === 413) throw invalidPrefs()
      throw error
    })
    const parsed = writeSchema.safeParse(body)
    if (!parsed.success || JSON.stringify(body).length > 8192) throw invalidPrefs()
    // Validation stays strict; tolerant parsing of this validated body retains facet insertion order.
    const filter = parsePrefs(JSON.stringify(body)).filter
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await context.env.DB.prepare(
        'SELECT overview_prefs FROM profiles WHERE id = ?',
      )
        .bind(user.id)
        .first<{ overview_prefs: string | null }>()
      if (!current) throw new HttpError(404, 'Profile not found', 'NOT_FOUND')
      // Background saves omit consent; compare-and-set preserves a concurrent withdrawal.
      const prefs = {
        ...parsed.data,
        filter,
        publicSections:
          parsed.data.publicSections ?? parsePrefs(current.overview_prefs).publicSections,
      }
      const serialized = JSON.stringify(prefs)
      if (serialized.length > 8192) throw invalidPrefs()
      const updated = await context.env.DB.prepare(
        'UPDATE profiles SET overview_prefs = ?, updated_at = ? WHERE id = ? AND overview_prefs IS ? RETURNING id',
      )
        .bind(serialized, nowIso(), user.id, current.overview_prefs)
        .first<{ id: string }>()
      if (updated) return json(prefs)
    }
    throw new HttpError(409, 'Preferences changed; retry the save', 'STATE_CONFLICT')
  })
