import 'server-only'
import { parsePrefs } from '@kuuki/shared/overview/prefs'
import { HttpError } from '../../../../functions/api/_lib/http'
import { readOverview } from '../../../../functions/api/_services/overview'
import { readOverviewData } from '../../../../functions/api/_services/overviewData'
import { getRequestEnv, getRequestIdentity } from './identity'
import type { OverviewPeriod } from '@kuuki/shared/overview'

export async function getOwnOverview(period: OverviewPeriod = 'all') {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const summary = await readOverview(env.DB, identity.id, period)
  return { ownerId: identity.id, summary }
}

export async function getOwnOverviewData() {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const payload = await readOverviewData(env.DB, identity.id)
  return { ownerId: identity.id, payload }
}

export async function getOwnOverviewPrefs() {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const profile = await env.DB.prepare('SELECT overview_prefs FROM profiles WHERE id = ?')
    .bind(identity.id).first<{ overview_prefs: string | null }>()
  if (!profile) throw new HttpError(404, 'Profile not found', 'NOT_FOUND')
  return { ownerId: identity.id, prefs: parsePrefs(profile.overview_prefs) }
}
