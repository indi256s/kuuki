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

export type PassportPublication = 'flights' | 'all'

/** Hidden countries leave the public projection; binds the owner id once. */
const NOT_HIDDEN = `e.country_code NOT IN (SELECT h.country_code FROM passport_hidden_countries h WHERE h.user_id = ?)`

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

function privatePayload(profile: ProfileRow) {
  return {
    profile: privateShell(profile),
    stats: null,
    badges: [],
    rankings: [],
    countries: [] as string[],
    derivedState: 'private' as const,
    publication: null,
  }
}

/** The one public projection (stats, badges, rankings, country codes) of a profile for an explicit scope. */
async function projectPublic(db: D1Database, profile: ProfileRow, scope: PassportPublication) {
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
    // Profile stamps, minus hidden countries. 'flights': flight countries (the countries_count set) whose airports
    // are in the public route set, so the profile names no country the public Overview globe does not already
    // show. 'all': every pressed country, whatever its source, never pending. Codes only: no dates, counts,
    // sources, claims or ground visits leave the owner.
    scope === 'all'
      ? db
          .prepare(`SELECT e.country_code FROM country_visit_evidence e
      WHERE e.user_id = ? AND e.status = 'pressed' AND ${NOT_HIDDEN}
      ORDER BY e.country_code`)
          .bind(profile.id, profile.id)
      : db
          .prepare(`SELECT e.country_code FROM country_visit_evidence e
      WHERE e.user_id = ? AND e.logged_visit_count + e.awaiting_visit_count > 0
      AND e.country_code IN (SELECT a.country_code FROM flights f JOIN airports_reference a
        ON a.iata IN (f.origin, f.destination)
        WHERE f.user_id = ? AND f.lifecycle_state IN ('logged', 'awaiting'))
      AND ${NOT_HIDDEN}
      ORDER BY e.country_code`)
          .bind(profile.id, profile.id, profile.id),
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
  return {
    stats: stats ? toUserStats(stats) : null,
    badges,
    rankings,
    countries: (results[3].results as Array<{ country_code: string }>).map(
      (row) => row.country_code,
    ),
    derivedState: pending ? ('pending' as const) : ('ready' as const),
    publication: scope,
  }
}

/** Visibility is checked on every read, before fetching any derived data. */
export async function readPublicProfile(db: D1Database, username: string) {
  const profile = await db
    .prepare('SELECT * FROM profiles WHERE lower(username) = lower(?) LIMIT 1')
    .bind(username)
    .first<ProfileRow>()
  if (!profile) return null
  if (!profile.is_public) return privatePayload(profile)

  const scope = profile.passport_publication ?? 'flights'
  let projection = await projectPublic(db, profile, scope)
  const current = await db
    .prepare('SELECT * FROM profiles WHERE id = ?')
    .bind(profile.id)
    .first<ProfileRow>()
  if (!current) return null
  if (!current.is_public) return privatePayload(current)
  // The owner changed publication during the read: a narrowed scope must not return the wider set it replaced, so
  // fall back to the narrowest projection rather than trusting either snapshot.
  if ((current.passport_publication ?? 'flights') !== scope)
    projection = await projectPublic(db, current, 'flights')
  return {
    ...projection,
    profile: toPublicProfile(current),
    rankings: current.show_on_leaderboards ? projection.rankings : [],
  }
}

/**
 * What the owner's public profile would show under `scope`, whether or not the profile is public now. Same
 * projection and shape as a public read; the caller authenticates the owner.
 */
export async function readPublicProfilePreview(
  db: D1Database,
  ownerId: string,
  scope: PassportPublication,
) {
  const profile = await db
    .prepare('SELECT * FROM profiles WHERE id = ?')
    .bind(ownerId)
    .first<ProfileRow>()
  if (!profile) return null
  const projection = await projectPublic(db, profile, scope)
  return {
    ...projection,
    profile: toPublicProfile(profile),
    rankings: profile.show_on_leaderboards ? projection.rankings : [],
  }
}
