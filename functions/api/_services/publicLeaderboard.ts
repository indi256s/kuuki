import {
  currentPeriod,
  derivedStateJoin,
  GROUND_MIN_JOURNEYS,
  isGroundCategory,
  LEADERBOARD_CATEGORIES,
  PUBLISHED_DERIVED_STATE,
  SKY_CATEGORY_SQL,
  SKY_MIN_FLIGHTS,
  toLeaderboardEntry,
  type LeaderboardCacheRow,
  type LeaderboardCategory,
} from '../_lib/leaderboard'
import { assertRows } from '../_lib/d1'

export const leaderboardCategories = LEADERBOARD_CATEGORIES
export type { LeaderboardCategory }
export const isLeaderboardPeriod = (period: string) => period === 'all' || /^\d{4}$/.test(period)

/**
 * Live consent re-check on cached rows (`lc`), so a member who leaves between rebuilds disappears at once.
 * Sky rows keep the five-flight gate; ground rows need all countries published (ADR 0007 refinement) and three
 * completed journeys, so deleting one hides the member before the next rebuild.
 */
const READ_GATE = `FROM leaderboard_cache lc JOIN profiles p ON p.id = lc.user_id
    LEFT JOIN user_stats us ON us.user_id = lc.user_id ${derivedStateJoin('lc')}
    WHERE p.show_on_leaderboards = 1 AND p.is_public = 1 AND ${PUBLISHED_DERIVED_STATE}
    AND ((lc.category IN ${SKY_CATEGORY_SQL} AND COALESCE(us.total_flights, 0) >= ${SKY_MIN_FLIGHTS})
      OR (lc.category NOT IN ${SKY_CATEGORY_SQL} AND p.passport_publication = 'all'
        AND (SELECT COUNT(*) FROM ground_journeys gj
             WHERE gj.user_id = lc.user_id AND gj.status = 'completed') >= ${GROUND_MIN_JOURNEYS}))`

// Rank the live eligible set before pagination or selecting one member. Cache values stay published,
// while places and percentiles reflect the participants visitors can currently see.
const VISIBLE_BOARD = `SELECT lc.*, COUNT(*) OVER (PARTITION BY lc.category, lc.period) AS total,
    ROW_NUMBER() OVER (PARTITION BY lc.category, lc.period ORDER BY lc.value DESC, lc.id) AS pos,
    RANK() OVER (PARTITION BY lc.category, lc.period ORDER BY lc.value DESC) AS standing
  ${READ_GATE}`

type Ranked = LeaderboardCacheRow & { total: number; pos: number; standing: number }

function toVisibleLeaderboardEntry(row: Ranked) {
  return toLeaderboardEntry({
    ...row,
    rank: row.standing,
    percentile: Math.round((1 - row.standing / row.total) * 1000) / 10,
  })
}

/** All-time sky places shared by public profiles and authenticated owner reads. */
export async function readProfileLeaderboardRankings(db: D1Database, userId: string) {
  const rows = await db
    .prepare(`WITH board AS (${VISIBLE_BOARD} AND lc.period = 'all' AND lc.category IN ${SKY_CATEGORY_SQL})
      SELECT * FROM board WHERE user_id = ? ORDER BY category`)
    .bind(userId)
    .all<Ranked>()
  assertRows(rows, 'Profile rankings unavailable')
  return rows.results.map(toVisibleLeaderboardEntry)
}

export async function readPublicLeaderboard(
  db: D1Database,
  category: LeaderboardCategory,
  limit = 50,
  offset = 0,
  period = 'all',
) {
  const reads = await db.batch([
    db
      .prepare(`WITH board AS (${VISIBLE_BOARD} AND lc.category = ? AND lc.period = ?)
        SELECT * FROM board ORDER BY pos LIMIT ? OFFSET ?`)
      .bind(category, period, Math.min(Math.max(limit, 1), 200), Math.max(offset, 0)),
    db
      .prepare(`SELECT COUNT(*) AS total, MAX(lc.updated_at) AS updated_at
        ${READ_GATE} AND lc.category = ? AND lc.period = ?`)
      .bind(category, period),
  ])
  assertRows(reads, 'Leaderboard unavailable', 2)
  const count = reads[1].results[0] as { total: number; updated_at: string | null } | undefined
  return {
    entries: (reads[0].results as Ranked[]).map(toVisibleLeaderboardEntry),
    total: count?.total ?? 0,
    updatedAt: count?.updated_at ?? null,
  }
}

export type LeaderboardEntry = ReturnType<typeof toLeaderboardEntry>

/** One category × period board: the top rows (rank ≤ 10, or everyone when 20 or fewer take part). */
export interface LeaderboardBoardSlice {
  top: LeaderboardEntry[]
  total: number
}

/** The viewer's standing in one category × period. */
export type ViewerPlace =
  | {
      state: 'ranked'
      entry: LeaderboardEntry
      /** Up to two rows either side of the viewer, the viewer included, in board order. */
      neighbours: LeaderboardEntry[]
      /** The nearest better rank and how much the viewer needs to reach it; null for the leader. */
      next: { entry: LeaderboardEntry; gap: number } | null
    }
  /** Not enough flights (sky) or completed journeys (ground) yet. */
  | { state: 'progress'; have: number; need: number }
  /** Ground only: enough journeys, but the Passport does not publish all countries. */
  | { state: 'blocked' }
  /** Recent changes are still being published; `entry` is the last published place, if any. */
  | { state: 'pending'; entry: LeaderboardEntry | null }
  /** Private profile or leaderboard participation off. */
  | { state: 'off' }
  /** Eligible, but no place here (nothing in this category or year, or the next rebuild has not run). */
  | { state: 'unranked' }

export type LeaderboardBoardPayload = Awaited<ReturnType<typeof readLeaderboardBoard>>

/** Above this many participants the page shows the top ten plus the viewer's neighbourhood. */
export const SHOW_EVERYONE_UP_TO = 20
const TOP_RANK = 10

/**
 * The whole leaderboard page in one read: every category × period (`all` and the current UTC year) and, for a
 * signed-in viewer, their place, neighbourhood and gap in each. The page switches category and period locally.
 */
export async function readLeaderboardBoard(
  db: D1Database,
  viewerId: string | null,
  now = new Date(),
) {
  const year = currentPeriod(now)
  const periods = ['all', year] as const
  const board = `${VISIBLE_BOARD} AND lc.period IN ('all', ?)`

  const statements = [
    db
      .prepare(
        `WITH board AS (${board}) SELECT * FROM board
         WHERE standing <= ${TOP_RANK} OR total <= ${SHOW_EVERYONE_UP_TO} ORDER BY category, period, pos`,
      )
      .bind(year),
    db.prepare(`SELECT MAX(lc.updated_at) AS updated_at ${READ_GATE}`),
  ]
  if (viewerId) {
    statements.push(
      db
        .prepare(
          `SELECT p.is_public, p.show_on_leaderboards, p.passport_publication,
                  COALESCE(us.total_flights, 0) AS total_flights, ds.revision, ds.published_revision,
                  (SELECT COUNT(*) FROM ground_journeys gj
                    WHERE gj.user_id = p.id AND gj.status = 'completed') AS journeys
           FROM profiles p LEFT JOIN user_stats us ON us.user_id = p.id
           LEFT JOIN user_derived_state ds ON ds.user_id = p.id
           WHERE p.id = ?`,
        )
        .bind(viewerId),
      // Own rows without the live gate: a pending viewer still sees the last published place.
      db
        .prepare(`SELECT * FROM leaderboard_cache WHERE user_id = ? AND period IN ('all', ?)`)
        .bind(viewerId, year),
      // The viewer ±2 by board position, plus the nearest better rank when it lies further up (ties).
      db
        .prepare(
          `WITH board AS (${board}),
           me AS (SELECT category, period, pos, standing FROM board WHERE user_id = ?)
           SELECT b.* FROM board b
           JOIN me ON me.category = b.category AND me.period = b.period
           WHERE b.pos BETWEEN me.pos - 2 AND me.pos + 2
              OR b.pos = (SELECT MAX(x.pos) FROM board x
                          WHERE x.category = me.category AND x.period = me.period AND x.standing < me.standing)
           ORDER BY b.category, b.period, b.pos`,
        )
        .bind(year, viewerId),
    )
  }
  const reads = await db.batch(statements)
  assertRows(reads, 'Leaderboard unavailable', statements.length)

  const key = (category: string, period: string) => `${category}:${period}`
  const slices = new Map<string, LeaderboardBoardSlice>()
  for (const row of reads[0].results as Ranked[]) {
    const slice = slices.get(key(row.category, row.period)) ?? { top: [], total: row.total }
    slice.top.push(toVisibleLeaderboardEntry(row))
    slices.set(key(row.category, row.period), slice)
  }
  const summary = reads[1].results[0] as { updated_at: string | null } | undefined
  const boards = Object.fromEntries(
    LEADERBOARD_CATEGORIES.map((category) => [
      category,
      Object.fromEntries(
        periods.map((period) => [
          period,
          slices.get(key(category, period)) ?? { top: [], total: 0 },
        ]),
      ),
    ]),
  ) as Record<LeaderboardCategory, Record<string, LeaderboardBoardSlice>>

  let viewer: {
    userId: string
    places: Record<LeaderboardCategory, Record<string, ViewerPlace>>
  } | null = null
  if (viewerId) {
    const profile = reads[2].results[0] as
      | {
          is_public: number
          show_on_leaderboards: number
          passport_publication: string | null
          total_flights: number
          revision: number | null
          published_revision: number | null
          journeys: number
        }
      | undefined
    const own = new Map(
      (reads[3].results as unknown as LeaderboardCacheRow[]).map((row) => [
        key(row.category, row.period),
        toLeaderboardEntry(row),
      ]),
    )
    const near = new Map<string, Ranked[]>()
    for (const row of reads[4].results as Ranked[]) {
      near.set(key(row.category, row.period), [
        ...(near.get(key(row.category, row.period)) ?? []),
        row,
      ])
    }
    const pending = profile?.revision != null && profile.revision !== profile.published_revision
    const place = (category: LeaderboardCategory, period: string): ViewerPlace => {
      if (!profile?.is_public || !profile.show_on_leaderboards) return { state: 'off' }
      if (pending) return { state: 'pending', entry: own.get(key(category, period)) ?? null }
      if (isGroundCategory(category)) {
        if (profile.journeys < GROUND_MIN_JOURNEYS)
          return { state: 'progress', have: profile.journeys, need: GROUND_MIN_JOURNEYS }
        if (profile.passport_publication !== 'all') return { state: 'blocked' }
      } else if (profile.total_flights < SKY_MIN_FLIGHTS) {
        return { state: 'progress', have: profile.total_flights, need: SKY_MIN_FLIGHTS }
      }
      const rows = near.get(key(category, period))
      const mine = rows?.find((row) => row.user_id === viewerId)
      if (!rows || !mine) return { state: 'unranked' }
      const better = rows.filter((row) => row.standing < mine.standing).at(-1)
      return {
        state: 'ranked',
        entry: toVisibleLeaderboardEntry(mine),
        neighbours: rows
          .filter((row) => Math.abs(row.pos - mine.pos) <= 2)
          .map(toVisibleLeaderboardEntry),
        next: better
          ? { entry: toVisibleLeaderboardEntry(better), gap: better.value - mine.value }
          : null,
      }
    }
    viewer = {
      userId: viewerId,
      places: Object.fromEntries(
        LEADERBOARD_CATEGORIES.map((category) => [
          category,
          Object.fromEntries(periods.map((period) => [period, place(category, period)])),
        ]),
      ) as Record<LeaderboardCategory, Record<string, ViewerPlace>>,
    }
  }

  return { year, periods: [...periods], boards, viewer, updatedAt: summary?.updated_at ?? null }
}

/** Private status for the authenticated owner. Competition rules remain the existing 5-flight gate. */
export async function readOwnLeaderboardEligibility(db: D1Database, ownerId: string) {
  const rows = await db.batch([
    db.prepare('SELECT is_public, show_on_leaderboards FROM profiles WHERE id = ?').bind(ownerId),
    db.prepare('SELECT total_flights FROM user_stats WHERE user_id = ?').bind(ownerId),
    db
      .prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?')
      .bind(ownerId),
  ])
  assertRows(rows, 'Leaderboard eligibility unavailable', 3)
  const profile = rows[0].results[0] as
    | { is_public: number; show_on_leaderboards: number }
    | undefined
  const stats = rows[1].results[0] as { total_flights: number } | undefined
  const state = rows[2].results[0] as { revision: number; published_revision: number } | undefined
  return {
    isPublic: !!profile?.is_public,
    optedIn: !!profile?.show_on_leaderboards,
    totalFlights: stats?.total_flights ?? null,
    pending: !!state && state.revision !== state.published_revision,
  }
}

/** Authenticated owner's current published all-time place, even outside the public first page. */
export async function readOwnLeaderboardRank(
  db: D1Database,
  ownerId: string,
  category: LeaderboardCategory,
) {
  const row = await db
    .prepare(
      `WITH board AS (${VISIBLE_BOARD} AND lc.category = ? AND lc.period = 'all')
       SELECT * FROM board WHERE user_id = ?`,
    )
    .bind(category, ownerId)
    .first<Ranked>()
  return row ? { entry: toVisibleLeaderboardEntry(row), period: row.updated_at } : null
}
