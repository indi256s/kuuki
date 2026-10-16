// leaderboard_cache row + DTO. metadata is JSON-as-TEXT ({username, display_name, avatar_url, avatar_face, aircraft});
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

/**
 * Aircraft types drawn for the race lanes (scripts/leaderboard-lanes/fleet.mjs). A sky row carries the member's
 * most-flown type for its period; any other or missing type is drawn as `GENERIC`. Owner decision 2026-10-16: the
 * aircraft type is not private and may appear on public boards.
 */
export const LANE_AIRCRAFT = [
  'A319',
  'A320',
  'A20N',
  'A321',
  'A21N',
  'A332',
  'A333',
  'A359',
  'A35K',
  'A388',
  'B733',
  'B738',
  'B38M',
  'B763',
  'B788',
  'B77W',
  'E170',
  'E195',
  'SU95',
  'DH8B',
] as const
export type LaneAircraft = (typeof LANE_AIRCRAFT)[number] | 'GENERIC'
export const laneAircraft = (icao: string | null | undefined): LaneAircraft => {
  const key = icao?.trim().toUpperCase()
  return (LANE_AIRCRAFT as readonly string[]).includes(key ?? '')
    ? (key as LaneAircraft)
    : 'GENERIC'
}

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
    aircraft?: string
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
    /** Sky rows only; null on ground rows and on rows written before the lanes. */
    aircraft: meta.aircraft ? laneAircraft(meta.aircraft) : null,
  }
}
