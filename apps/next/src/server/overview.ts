import 'server-only'
import { cache } from 'react'
import { parsePrefs } from '@kuuki/shared/overview/prefs'
import { HttpError } from '../../../../functions/api/_lib/http'
import { readOverviewData } from '../../../../functions/api/_services/overviewData'
import { getRequestEnv, getRequestIdentity } from './identity'

// Request-scoped like the identity they read, so the page can start both before the profile gate and reuse the reads in flight.
export const getOwnOverviewData = cache(async () => {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const payload = await readOverviewData(env.DB, identity.id)
  return { ownerId: identity.id, payload }
})

export const getOwnOverviewPrefs = cache(async () => {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const profile = await env.DB.prepare('SELECT overview_prefs FROM profiles WHERE id = ?')
    .bind(identity.id)
    .first<{ overview_prefs: string | null }>()
  if (!profile) throw new HttpError(404, 'Profile not found', 'NOT_FOUND')
  return { ownerId: identity.id, prefs: parsePrefs(profile.overview_prefs) }
})

/**
 * Starts the owner's reads beside the onboarding gate rather than after it. Each read checks the session first, so a guest reads nothing;
 * a member who still has to finish onboarding is redirected and the result is dropped.
 */
export function preloadOwnOverview() {
  void getOwnOverviewData().catch(() => {})
  void getOwnOverviewPrefs().catch(() => {})
}
