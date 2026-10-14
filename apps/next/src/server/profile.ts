import 'server-only'
import { getRequestEnv, getRequestIdentity } from './identity'
import { toUserStats, type UserStatsRow } from '../../../../functions/api/_lib/stats'
import { readOwnBadges } from '../../../../functions/api/_services/ownBadges'
import { getProfileRow, toOwnProfile } from '../../../../functions/api/_lib/profiles'
import {
  derivedStateJoin,
  PUBLISHED_DERIVED_STATE,
  toLeaderboardEntry,
  type LeaderboardCacheRow,
} from '../../../../functions/api/_lib/leaderboard'

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

/** The owner's leaderboard entries (empty when ineligible), the `GET /api/me/rankings` read. */
export async function readOwnRankings(db: D1Database, userId: string) {
  const { results } = await db
    .prepare(
      `SELECT lc.* FROM leaderboard_cache lc
       JOIN profiles p ON p.id = lc.user_id
       JOIN user_stats us ON us.user_id = lc.user_id
       ${derivedStateJoin('lc')}
       WHERE lc.user_id = ? AND p.show_on_leaderboards = 1 AND us.total_flights >= 5
         AND ${PUBLISHED_DERIVED_STATE}`,
    )
    .bind(userId)
    .all<LeaderboardCacheRow>()
  return results.map(toLeaderboardEntry)
}
