// Leaderboard cache rebuild — ported from the live PL/pgSQL `refresh_leaderboards()`
// (see db/_extracted/LOGIC_SPEC.md "refresh_leaderboards()"). Runs via Cron (every 5 min),
// NOT per-write — it is a full rebuild of `leaderboard_cache`.
//
// Parity notes (do NOT "fix"):
//   * Exactly 5 categories. The `cities` category ranks `airports_count`, not a city count —
//     this is an intentional live quirk; preserve it.
//   * Eligibility = total_flights >= 5 AND show_on_leaderboards = TRUE (1).
//   * rank = ROW_NUMBER() OVER (ORDER BY <value> DESC, profiles.created_at ASC).
//   * percentile = ROUND((1 - rank/total) * 100, 1). The live SQL casts to NUMERIC (float
//     division). We add an explicit `total > 0` guard the live SQL lacks — see DEVIATION below.

import { nowIso } from '../_lib/time'
import { derivedStateJoin, PUBLISHED_DERIVED_STATE } from '../_lib/leaderboard'

// Category → user_stats value column. Order is the live INSERT order. Note `cities` maps to
// `airports_count` (the documented quirk) — there is NO `airports` category.
const CATEGORIES = [
  { category: 'flights', column: 'total_flights' },
  { category: 'distance', column: 'total_distance_km' },
  { category: 'countries', column: 'countries_count' },
  { category: 'cities', column: 'airports_count' },
  { category: 'airlines', column: 'airlines_count' },
] as const

// D1 caps a single statement at 100 bound variables. Each INSERT row binds 7 vars, so the chunk
// must stay at floor(100 / 7) = 14 rows (98 vars) to avoid "too many SQL variables" at runtime.
const ROWS_PER_INSERT = 14

interface EligibleRow {
  user_id: string
  created_at: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  total_flights: number
  total_distance_km: number
  countries_count: number
  airports_count: number
  airlines_count: number
}

/**
 * Full rebuild of `leaderboard_cache`: DELETE all rows, then INSERT one row per eligible user
 * per category (5 categories). Faithful port of the live `refresh_leaderboards()`.
 */
export async function refreshLeaderboards(db: D1Database): Promise<void> {
  // Eligible set = user_stats JOIN profiles WHERE total_flights >= 5 AND show_on_leaderboards = 1.
  // ORDER BY created_at ASC matches the live tie-break and lets us assign ROW_NUMBER() in TS.
  const eligible = await db
    .prepare(
      `SELECT us.user_id, p.created_at, p.username, p.display_name, p.avatar_url,
              us.total_flights, us.total_distance_km, us.countries_count,
              us.airports_count, us.airlines_count
       FROM user_stats us
       JOIN profiles p ON p.id = us.user_id
       ${derivedStateJoin('us')}
       WHERE us.total_flights >= 5 AND p.show_on_leaderboards = 1
         AND ${PUBLISHED_DERIVED_STATE}
       ORDER BY p.created_at ASC`,
    )
    .all<EligibleRow>()

  const rows = eligible.results
  const totalUsers = rows.length

  // Always clear the cache, even when there are no eligible users (matches DELETE-then-INSERT).
  const statements = [db.prepare('DELETE FROM leaderboard_cache WHERE 1 = 1')]

  if (totalUsers > 0) {
    const updatedAt = nowIso()

    for (const { category, column } of CATEGORIES) {
      // Stable sort by <value> DESC, then created_at ASC. `rows` is already created_at ASC, and
      // Array.prototype.sort is stable, so equal values keep that ascending-created_at order —
      // reproducing ROW_NUMBER() OVER (ORDER BY value DESC, created_at ASC).
      const ranked = [...rows].sort((a, b) => Number(b[column]) - Number(a[column]))

      const inserts = ranked.map((row, i) => {
        const rank = i + 1
        // percentile = ROUND((1 - rank/total) * 100, 1), float division, single rounding site.
        // total > 0 is guaranteed here (totalUsers > 0); guard documented at DEVIATION below.
        const percentile = Math.round((1 - rank / totalUsers) * 100 * 10) / 10
        const metadata = JSON.stringify({
          username: row.username,
          display_name: row.display_name,
          avatar_url: row.avatar_url,
        })
        return { userId: row.user_id, value: Number(row[column]), rank, percentile, metadata }
      })

      for (let i = 0; i < inserts.length; i += ROWS_PER_INSERT) {
        const chunk = inserts.slice(i, i + ROWS_PER_INSERT)
        const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')
        const binds: (string | number)[] = []
        for (const r of chunk) {
          binds.push(r.userId, category, r.value, r.rank, r.percentile, r.metadata, updatedAt)
        }
        statements.push(
          db
            .prepare(
              `INSERT INTO leaderboard_cache (user_id, category, value, rank, percentile, metadata, updated_at)
               VALUES ${placeholders}`,
            )
            .bind(...binds),
        )
      }
    }
  }

  await db.batch(statements)
}
