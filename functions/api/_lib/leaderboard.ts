// leaderboard_cache row + DTO. metadata is JSON-as-TEXT ({username, display_name, avatar_url, avatar_face});
// flatten it onto the entry (the frontend reads these flat). user_id is kept so the client can
// highlight the current user; the cache only contains public, opted-in users (see refreshLeaderboards
// for the sky and ground gates), so exposing it here is not a privacy leak. Used by both the leaderboard list
// and the per-user rankings (me/rankings + public profile rankings).

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

export const SKY_CATEGORIES = ['flights', 'distance', 'countries', 'cities', 'airlines'] as const
export const GROUND_CATEGORIES = ['rail', 'road', 'ground_countries'] as const
export const LEADERBOARD_CATEGORIES = [...SKY_CATEGORIES, ...GROUND_CATEGORIES] as const
export type LeaderboardCategory = (typeof LEADERBOARD_CATEGORIES)[number]
export type GroundCategory = (typeof GROUND_CATEGORIES)[number]
export const isGroundCategory = (category: string): category is GroundCategory =>
  (GROUND_CATEGORIES as readonly string[]).includes(category)

/** Sky participation needs this many flights; ground needs this many completed rail and road journeys together. */
export const SKY_MIN_FLIGHTS = 5
export const GROUND_MIN_JOURNEYS = 3

/** The calendar-year period a rebuild at `now` computes besides `all` (UTC). */
export const currentPeriod = (now: Date) => String(now.getUTCFullYear())

/** `category IN (…sky…)` for readers that predate ground categories (profile gates keep sky only). */
export const SKY_CATEGORY_SQL = `(${SKY_CATEGORIES.map((c) => `'${c}'`).join(', ')})`

// Eligibility gate shared by every leaderboard read/rebuild: a user whose derived state is stale
// (revision != published_revision) is hidden until repair publishes it. Users with no
// user_derived_state row are eligible. Use as `${derivedStateJoin('lc')} ... WHERE ... AND ${PUBLISHED_DERIVED_STATE}`;
// the join always aliases the table as `ds`.
export const derivedStateJoin = (userAlias: string) =>
  `LEFT JOIN user_derived_state ds ON ds.user_id = ${userAlias}.user_id`
export const PUBLISHED_DERIVED_STATE = '(ds.user_id IS NULL OR ds.revision = ds.published_revision)'

export function toLeaderboardEntry(row: LeaderboardCacheRow) {
  let meta: {
    username?: string
    display_name?: string
    avatar_url?: string
    avatar_face?: string
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
  }
}
