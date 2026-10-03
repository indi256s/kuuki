// GET /api/public/profiles/:username — unauthenticated public profile view. Private profiles
// return only the public profile shell with empty stats/badges/rankings. Rankings are gated on
// the user opting into leaderboards and having at least 5 flights. Never leaks private fields.

import { runHandler, json, HttpError } from '../../_lib/http'
import { toPublicProfile } from '../../_lib/profiles'
import type { ProfileRow } from '../../_lib/profiles'
import { toUserStats } from '../../_lib/stats'
import type { UserStatsRow } from '../../_lib/stats'
import { toUserBadgeWithDefinition } from '../../_lib/badges'
import type { UserBadgeRow, BadgeDefinitionRow } from '../../_lib/badges'
import { toLeaderboardEntry } from '../../_lib/leaderboard'
import type { LeaderboardCacheRow } from '../../_lib/leaderboard'

export const onRequestGet: PagesFunction<Env> = (context) =>
  runHandler(async () => {
    const db = context.env.DB
    const username = context.params.username as string

    const profile = await db
      .prepare('SELECT * FROM profiles WHERE lower(username) = lower(?) LIMIT 1')
      .bind(username)
      .first<ProfileRow>()
    if (!profile) throw new HttpError(404, 'Profile not found', 'NOT_FOUND')

    if (!profile.is_public) {
      return json({ profile: toPublicProfile(profile), stats: null, badges: [], rankings: [] })
    }

    const stats = await db
      .prepare('SELECT * FROM user_stats WHERE user_id = ?')
      .bind(profile.id)
      .first<UserStatsRow>()

    const badgeRows = await db
      .prepare(
        `SELECT ub.id AS ub_id, ub.user_id AS ub_user_id, ub.badge_id AS ub_badge_id,
                ub.earned_at AS ub_earned_at, bd.*
         FROM user_badges ub
         JOIN badge_definitions bd ON bd.id = ub.badge_id
         WHERE ub.user_id = ?
         ORDER BY ub.earned_at DESC`
      )
      .bind(profile.id)
      .all<UserBadgeRow & BadgeDefinitionRow & {
        ub_id: number
        ub_user_id: string
        ub_badge_id: number
        ub_earned_at: string
      }>()

    const badges = (badgeRows.results ?? []).map((row) => {
      const userBadge: UserBadgeRow = {
        id: row.ub_id,
        user_id: row.ub_user_id,
        badge_id: row.ub_badge_id,
        earned_at: row.ub_earned_at,
      }
      const def: BadgeDefinitionRow = {
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        category: row.category,
        tier: row.tier,
        icon: row.icon,
        points: row.points,
        criteria: row.criteria,
      }
      return toUserBadgeWithDefinition(userBadge, def)
    })

    const derivedState = await db.prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?')
      .bind(profile.id).first<{ revision: number; published_revision: number }>()
    const showRankings = !!profile.show_on_leaderboards && (stats?.total_flights ?? 0) >= 5 &&
      (!derivedState || derivedState.revision === derivedState.published_revision)
    let rankings: ReturnType<typeof toLeaderboardEntry>[] = []
    if (showRankings) {
      const rankRows = await db
        .prepare('SELECT * FROM leaderboard_cache WHERE user_id = ?')
        .bind(profile.id)
        .all<LeaderboardCacheRow>()
      rankings = (rankRows.results ?? []).map(toLeaderboardEntry)
    }

    return json({
      profile: toPublicProfile(profile),
      stats: stats ? toUserStats(stats) : null,
      badges,
      rankings,
    })
  })
