import { toPublicProfile, type ProfileRow } from '../_lib/profiles'
import { toPublicStats, type UserStatsRow } from '../_lib/stats'
import {
  toUserBadgeWithDefinition,
  type UserBadgeRow,
  type BadgeDefinitionRow,
} from '../_lib/badges'
import { toLeaderboardEntry } from '../_lib/leaderboard'
import { readProfileLeaderboardRankings } from './publicLeaderboard'
import { assertRows } from '../_lib/d1'

export type PassportPublication = 'flights' | 'all'

const NOT_HIDDEN = `e.country_code NOT IN (SELECT h.country_code FROM passport_hidden_countries h WHERE h.user_id = ?)`

function privateShell(profile: ProfileRow) {
  return {
    ...toPublicProfile(profile),
    display_name: null,
    bio: null,
    avatar_url: null,
    avatar_face: null,
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
    rankings = await readProfileLeaderboardRankings(db, profile.id)
  }
  return {
    stats: stats ? toPublicStats(stats) : null,
    badges,
    rankings,
    countries: (results[3].results as Array<{ country_code: string }>).map(
      (row) => row.country_code,
    ),
    derivedState: pending ? ('pending' as const) : ('ready' as const),
    publication: scope,
  }
}

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
  if ((current.passport_publication ?? 'flights') !== scope)
    projection = await projectPublic(db, current, 'flights')
  return {
    ...projection,
    profile: toPublicProfile(current),
    rankings: current.show_on_leaderboards ? projection.rankings : [],
  }
}

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
