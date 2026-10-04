import { derivedStateJoin, PUBLISHED_DERIVED_STATE, toLeaderboardEntry, type LeaderboardCacheRow } from '../_lib/leaderboard'

export const leaderboardCategories = ['flights', 'distance', 'countries', 'cities', 'airlines'] as const
export type LeaderboardCategory = typeof leaderboardCategories[number]

export async function readPublicLeaderboard(db: D1Database, category: LeaderboardCategory, limit = 50, offset = 0) {
  const gate = `FROM leaderboard_cache lc JOIN profiles p ON p.id = lc.user_id
    JOIN user_stats us ON us.user_id = lc.user_id ${derivedStateJoin('lc')}
    WHERE lc.category = ? AND p.show_on_leaderboards = 1 AND p.is_public = 1
    AND us.total_flights >= 5 AND ${PUBLISHED_DERIVED_STATE}`
  const rows = await db.prepare(`SELECT lc.* ${gate} ORDER BY lc.rank ASC LIMIT ? OFFSET ?`)
    .bind(category, Math.min(Math.max(limit, 1), 200), Math.max(offset, 0)).all<LeaderboardCacheRow>()
  if (!rows.success || !Array.isArray(rows.results)) throw new Error('Leaderboard unavailable')
  const count = await db.prepare(`SELECT COUNT(*) AS total, MAX(lc.updated_at) AS updated_at ${gate}`).bind(category).first<{ total: number; updated_at: string | null }>()
  return { entries: rows.results.map(toLeaderboardEntry), total: count?.total ?? 0, updatedAt: count?.updated_at ?? null }
}

/** Private status for the authenticated owner. Competition rules remain the existing 5-flight gate. */
export async function readOwnLeaderboardEligibility(db: D1Database, ownerId: string) {
  const rows = await db.batch([
    db.prepare('SELECT is_public, show_on_leaderboards FROM profiles WHERE id = ?').bind(ownerId),
    db.prepare('SELECT total_flights FROM user_stats WHERE user_id = ?').bind(ownerId),
    db.prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?').bind(ownerId),
  ])
  if (rows.length !== 3 || rows.some(row => !row.success || !Array.isArray(row.results))) throw new Error('Leaderboard eligibility unavailable')
  const profile = rows[0].results[0] as { is_public: number; show_on_leaderboards: number } | undefined
  const stats = rows[1].results[0] as { total_flights: number } | undefined
  const state = rows[2].results[0] as { revision: number; published_revision: number } | undefined
  return { isPublic: !!profile?.is_public, optedIn: !!profile?.show_on_leaderboards,
    totalFlights: stats?.total_flights ?? 0, pending: !!state && state.revision !== state.published_revision }
}
