import 'server-only'
import { getRequestEnv, getRequestIdentity } from './identity'
import { toUserStats, type UserStatsRow } from '../../../../functions/api/_lib/stats'
import { readOwnBadges } from '../../../../functions/api/_services/ownBadges'
import { getProfileRow, toOwnProfile } from '../../../../functions/api/_lib/profiles'

export async function getOwnProfile() {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const profile = await getProfileRow(env.DB, identity.id)
  return profile ? { ownerId: identity.id, profile: toOwnProfile(profile) } : null
}

export async function getOwnProfileStats(userId: string) {
  const identity = await getRequestIdentity()
  if (!identity || identity.id !== userId) return null
  const env = await getRequestEnv()
  const row = await env.DB.prepare('SELECT * FROM user_stats WHERE user_id = ?')
    .bind(userId)
    .first<UserStatsRow>()
  return row ? toUserStats(row) : null
}

export async function getOwnBadges(userId: string) {
  const identity = await getRequestIdentity()
  if (!identity || identity.id !== userId) return []
  return readOwnBadges((await getRequestEnv()).DB, userId)
}

export async function getProfileShareUrl(username: string) {
  const { PAGES_ORIGIN } = await getRequestEnv()
  return new URL(`/fly/${encodeURIComponent(username)}`, PAGES_ORIGIN).href
}

/** The owner's own stamps with their last visit (owner-only: visitors get codes without dates). */
export async function getOwnStamps(userId: string) {
  const identity = await getRequestIdentity()
  if (!identity || identity.id !== userId) return []
  const rows = await (
    await getRequestEnv()
  ).DB.prepare(
    `SELECT country_code, last_visit FROM country_visit_evidence
      WHERE user_id = ? AND logged_visit_count + awaiting_visit_count > 0
      ORDER BY last_visit DESC, country_code`,
  )
    .bind(userId)
    .all<{ country_code: string; last_visit: string | null }>()
  return rows.results.map((row) => ({ code: row.country_code, lastVisit: row.last_visit }))
}
