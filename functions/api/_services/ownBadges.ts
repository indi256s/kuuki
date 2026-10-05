import { assertRows } from '../_lib/d1'
import {
  toUserBadgeWithDefinition,
  type UserBadgeRow,
  type BadgeDefinitionRow,
} from '../_lib/badges'

type JoinedRow = {
  ub_id: number
  ub_user_id: string
  ub_badge_id: number
  ub_earned_at: string
  bd_id: number
  bd_code: string
  bd_name: string
  bd_description: string | null
  bd_category: string | null
  bd_tier: string | null
  bd_icon: string | null
  bd_points: number | null
  bd_criteria: string | null
}

export async function readOwnBadges(db: D1Database, ownerId: string) {
  const rows = await db.prepare(
      `SELECT
         ub.id AS ub_id,
         ub.user_id AS ub_user_id,
         ub.badge_id AS ub_badge_id,
         ub.earned_at AS ub_earned_at,
         bd.id AS bd_id,
         bd.code AS bd_code,
         bd.name AS bd_name,
         bd.description AS bd_description,
         bd.category AS bd_category,
         bd.tier AS bd_tier,
         bd.icon AS bd_icon,
         bd.points AS bd_points,
         bd.criteria AS bd_criteria
       FROM user_badges ub
       JOIN badge_definitions bd ON ub.badge_id = bd.id
       WHERE ub.user_id = ?
       ORDER BY ub.earned_at DESC`,
    )
      .bind(ownerId)
      .all<JoinedRow>()

  assertRows(rows, 'Badges unavailable')
  const badges = rows.results.map((r) => {
      const userBadge: UserBadgeRow = {
        id: r.ub_id,
        user_id: r.ub_user_id,
        badge_id: r.ub_badge_id,
        earned_at: r.ub_earned_at,
      }
      const def: BadgeDefinitionRow = {
        id: r.bd_id,
        code: r.bd_code,
        name: r.bd_name,
        description: r.bd_description,
        category: r.bd_category,
        tier: r.bd_tier,
        icon: r.bd_icon,
        points: r.bd_points,
        criteria: r.bd_criteria,
      }
      return toUserBadgeWithDefinition(userBadge, def)
    })

  return badges
}
