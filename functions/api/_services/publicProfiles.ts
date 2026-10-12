import { toPublicProfile, type ProfileRow } from '../_lib/profiles'
import { toUserStats, type UserStatsRow } from '../_lib/stats'
import {
  toUserBadgeWithDefinition,
  type UserBadgeRow,
  type BadgeDefinitionRow,
} from '../_lib/badges'
import {
  toLeaderboardEntry,
  derivedStateJoin,
  PUBLISHED_DERIVED_STATE,
  type LeaderboardCacheRow,
} from '../_lib/leaderboard'
import { assertRows } from '../_lib/d1'

function privateShell(profile: ProfileRow) {
  return {
    ...toPublicProfile(profile),
    display_name: null,
    bio: null,
    avatar_url: null,
    theme_color: null,
    created_at: null,
    show_on_leaderboards: false,
  }
}

/** Visibility is checked on every read, before fetching any derived data. */
export async function readPublicProfile(db: D1Database, username: string) {
  const profile = await db
    .prepare('SELECT * FROM profiles WHERE lower(username) = lower(?) LIMIT 1')
    .bind(username)
    .first<ProfileRow>()
  if (!profile) return null
  if (!profile.is_public)
    return {
      profile: privateShell(profile),
      stats: null,
      badges: [],
      rankings: [],
      countries: [] as string[],
      derivedState: 'private' as const,
    }

  const statements = [
    db.prepare('SELECT * FROM user_stats WHERE user_id = ?').bind(profile.id),
    db
      .prepare(`SELECT ub.id AS ub_id, ub.user_id AS ub_user_id, ub.badge_id AS ub_badge_id,
      ub.earned_at AS ub_earned_at, bd.* FROM user_badges ub JOIN badge_definitions bd ON bd.id = ub.badge_id
      WHERE ub.user_id = ? ORDER BY ub.earned_at DESC`)
      .bind(profile.id),
    db
      .prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?')
      .bind(profile.id),
    // Profile stamps: flight countries (the countries_count set) whose airports are in the public route set, so
    // the profile names no country the public Overview globe does not already show. No dates, counts, claims
    // or ground visits leave the owner (spec: no new disclosure).
    db
      .prepare(`SELECT e.country_code FROM country_visit_evidence e
      WHERE e.user_id = ? AND e.logged_visit_count + e.awaiting_visit_count > 0
      AND e.country_code IN (SELECT a.country_code FROM flights f JOIN airports_reference a
        ON a.iata IN (f.origin, f.destination)
        WHERE f.user_id = ? AND f.lifecycle_state IN ('logged', 'awaiting'))
      ORDER BY e.country_code`)
      .bind(profile.id, profile.id),
  ]
  const results = await db.batch(statements)
  assertRows(results, 'Public profile read failed', statements.length)
  const stats = results[0].results[0] as UserStatsRow | undefined
  const badgeRows = results[1].results as Array<
    UserBadgeRow &
      BadgeDefinitionRow & {
        ub_id: number
        ub_user_id: string
        ub_badge_id: number
        ub_earned_at: string
      }
  >
  const revision = results[2].results[0] as
    | { revision: number; published_revision: number }
    | undefined
  const badges = badgeRows.map((row) =>
    toUserBadgeWithDefinition(
      {
        id: row.ub_id,
        user_id: row.ub_user_id,
        badge_id: row.ub_badge_id,
        earned_at: row.ub_earned_at,
      },
      {
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        category: row.category,
        tier: row.tier,
        icon: row.icon,
        points: row.points,
        criteria: row.criteria,
      },
    ),
  )
  const pending = !!revision && revision.revision !== revision.published_revision
  let rankings: ReturnType<typeof toLeaderboardEntry>[] = []
  if (profile.show_on_leaderboards && (stats?.total_flights ?? 0) >= 5 && !pending) {
    const rows = await db
      .prepare(`SELECT lc.* FROM leaderboard_cache lc JOIN profiles p ON p.id = lc.user_id
      JOIN user_stats us ON us.user_id = lc.user_id ${derivedStateJoin('lc')}
      WHERE lc.user_id = ? AND p.is_public = 1 AND p.show_on_leaderboards = 1
      AND us.total_flights >= 5 AND ${PUBLISHED_DERIVED_STATE}`)
      .bind(profile.id)
      .all<LeaderboardCacheRow>()
    assertRows(rows, 'Public profile rankings unavailable')
    rankings = rows.results.map(toLeaderboardEntry)
  }
  const current = await db
    .prepare('SELECT * FROM profiles WHERE id = ?')
    .bind(profile.id)
    .first<ProfileRow>()
  if (!current || !current.is_public)
    return current
      ? {
          profile: privateShell(current),
          stats: null,
          badges: [],
          rankings: [],
          countries: [] as string[],
          derivedState: 'private' as const,
        }
      : null
  return {
    profile: toPublicProfile(current),
    stats: stats ? toUserStats(stats) : null,
    badges,
    rankings: current.show_on_leaderboards ? rankings : [],
    countries: (results[3].results as Array<{ country_code: string }>).map(
      (row) => row.country_code,
    ),
    derivedState: pending ? ('pending' as const) : ('ready' as const),
  }
}
