import { SKY_CATEGORIES } from '../../../packages/shared/src/leaderboard'

export {
  GROUND_CATEGORIES,
  LEADERBOARD_CATEGORIES,
  SKY_CATEGORIES,
  isGroundCategory,
  type LeaderboardCategory,
} from '../../../packages/shared/src/leaderboard'

export interface LeaderboardCacheRow {
  id: number
  user_id: string
  category: string
  period: string
  value: number
  rank: number
  percentile: number | null
  metadata: string | null
  updated_at: string
}

export const SKY_MIN_FLIGHTS = 5
export const GROUND_MIN_JOURNEYS = 3

export const currentPeriod = (now: Date) => String(now.getUTCFullYear())

export const SKY_CATEGORY_SQL = `(${SKY_CATEGORIES.map((c) => `'${c}'`).join(', ')})`

export const derivedStateJoin = (userAlias: string) =>
  `LEFT JOIN user_derived_state ds ON ds.user_id = ${userAlias}.user_id`
export const PUBLISHED_DERIVED_STATE = '(ds.user_id IS NULL OR ds.revision = ds.published_revision)'

export function toLeaderboardEntry(row: LeaderboardCacheRow) {
  let meta: {
    username?: string
    display_name?: string
    avatar_url?: string
    avatar_face?: string
    aircraft?: string
    vehicle?: string
  } = {}
  if (row.metadata) {
    try {
      meta = JSON.parse(row.metadata) as typeof meta
    } catch {
      meta = {}
    }
  }
  return {
    id: row.id,
    user_id: row.user_id,
    category: row.category,
    value: row.value,
    rank: row.rank,
    percentile: row.percentile,
    username: meta.username ?? null,
    display_name: meta.display_name ?? null,
    avatar_url: meta.avatar_url ?? null,
    avatar_face: meta.avatar_face ?? null,
    aircraft: meta.aircraft?.trim().toUpperCase() || null,
    vehicle:
      meta.vehicle === 'rail' || meta.vehicle === 'road' ? (meta.vehicle as 'rail' | 'road') : null,
  }
}
