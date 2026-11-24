export interface BadgeDefinitionRow {
  id: number
  code: string
  name: string
  description: string | null
  category: string | null
  tier: string | null
  icon: string | null
  points: number | null
  criteria: string | null
}

export function toBadgeDefinition(row: BadgeDefinitionRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    category: row.category,
    tier: row.tier,
    icon: row.icon,
    points: row.points,
    criteria: parseJson(row.criteria),
  }
}

export interface UserBadgeRow {
  id: number
  user_id: string
  badge_id: number
  earned_at: string
}

export function toUserBadgeWithDefinition(userBadge: UserBadgeRow, def: BadgeDefinitionRow) {
  return {
    id: userBadge.id,
    user_id: userBadge.user_id,
    badge_id: userBadge.badge_id,
    earned_at: userBadge.earned_at,
    badge: toBadgeDefinition(def),
  }
}

function parseJson(text: string | null): unknown {
  if (text == null) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
