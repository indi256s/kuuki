// Leaderboard cache rebuild — ported from the live PL/pgSQL `refresh_leaderboards()`
// (see db/_extracted/LOGIC_SPEC.md "refresh_leaderboards()"). Runs via Cron (every 5 min),
// NOT per-write — it is a full rebuild of `leaderboard_cache`.
//
// Parity notes (do NOT "fix"):
//   * The `cities` category ranks `airports_count`, not a city count — an intentional live quirk.
//   * Sky eligibility keeps total_flights >= 5 AND show_on_leaderboards = 1.
//   * percentile = ROUND((1 - rank/total) * 100, 1), float division, with a `total > 0` guard.
//
// Deliberate deviations (leaderboard redesign, 2026-10-15; spec .scratch/leaderboard-redesign/spec.md):
//   * Eligibility also requires `is_public = 1`, as every public read does, so hidden members leave no rank gaps.
//   * Competition ranking (1, 1, 3): equal values share a rank instead of ROW_NUMBER() by signup date.
//     Percentile follows the shared rank.
//   * Three ground categories (ADR 0005, ADR 0007 refinement): members who publish all countries
//     (`passport_publication = 'all'`) with at least 3 completed rail and road journeys together.
//   * Two periods: `all` and the current UTC calendar year (`YYYY`). Thresholds are judged on all-time
//     totals in both periods, so nobody drops out of the year board for flying little this year.
//   * A zero value is not ranked, except in all-time sky categories (parity: everyone eligible ranks there).
//   * Lane vehicles ride in metadata: sky rows carry the most-flown aircraft type, ground Countries rows the mode the
//     member covered more distance by (2026-10-16).

import {
  journeyDistance,
  parsePlaceSnapshot,
  type GroundPlaceSnapshot,
} from '../../../packages/shared/src/groundTravel'
import { nowIso } from '../_lib/time'
import {
  currentPeriod,
  derivedStateJoin,
  GROUND_CATEGORIES,
  isGroundCategory,
  GROUND_MIN_JOURNEYS,
  PUBLISHED_DERIVED_STATE,
  SKY_CATEGORIES,
  SKY_MIN_FLIGHTS,
  type LeaderboardCategory,
} from '../_lib/leaderboard'

// D1 caps a single statement at 100 bound variables; the chunk follows the per-row bind count.
const BINDS_PER_ROW = 8
const ROWS_PER_INSERT = Math.floor(100 / BINDS_PER_ROW)

type Values = Partial<Record<LeaderboardCategory, number>>

interface Member {
  user_id: string
  created_at: string | null
  username: string | null
  display_name: string | null
  avatar_url: string | null
  avatar_face: string | null
}

const PUBLISHED_PUBLIC = `p.is_public = 1 AND p.show_on_leaderboards = 1 AND ${PUBLISHED_DERIVED_STATE}`

/**
 * Completed journeys per member, optionally only those starting in `year` (an integer string, safe to inline).
 * Deleted journeys have no status, so `completed` excludes them.
 */
const groundTotals = (year: string | null) => {
  const started = (alias: string) =>
    year ? `AND substr(${alias}.start_date, 1, 4) = '${year}'` : ''
  return `
  SELECT gj.user_id,
         SUM(gj.mode = 'rail') AS rail,
         SUM(gj.mode = 'road') AS road,
         (SELECT COUNT(DISTINCT gjc.country_code) FROM ground_journey_countries gjc
            JOIN ground_journeys c ON c.id = gjc.journey_id AND c.user_id = gjc.user_id
           WHERE gjc.user_id = gj.user_id AND c.status = 'completed' ${started('c')}) AS ground_countries
  FROM ground_journeys gj
  WHERE gj.status = 'completed' ${started('gj')}
  GROUP BY gj.user_id`
}

/**
 * Each member's most-flown aircraft type among their awaiting and logged flights, optionally in one year (bound).
 * Ties go to the type flown most recently, then the code, so a rebuild is stable.
 */
const topAircraft = (year: boolean) => `
  SELECT user_id, icao FROM (
    SELECT user_id, icao,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY n DESC, last DESC, icao) AS pick
    FROM (SELECT user_id, UPPER(TRIM(aircraft_icao)) AS icao, COUNT(*) AS n, MAX(date) AS last
          FROM flights
          WHERE lifecycle_state IN ('awaiting', 'logged') AND TRIM(COALESCE(aircraft_icao, '')) <> ''
            ${year ? 'AND substr(date, 1, 4) = ?' : ''}
          GROUP BY user_id, UPPER(TRIM(aircraft_icao))))
  WHERE pick = 1`

/** Invalid stored snapshots leave the journey distance unknown. */
const place = (json: string) => {
  try {
    return parsePlaceSnapshot(JSON.parse(json))
  } catch {
    return null
  }
}

/** Completed journey kilometres, using the same complete-distance and rounding rule as ground totals. */
function groundKm(
  legs: Array<{
    user_id: string
    journey_id: string
    start_date: string | null
    from_place: string
    to_place: string
  }>,
  points: Array<{ user_id: string; journey_id: string; start_date: string | null; place: string }>,
  year: string,
) {
  const all = new Map<string, { rail: number; road: number }>()
  const inYear = new Map<string, { rail: number; road: number }>()
  type Journey = {
    userId: string
    start: string | null
    mode: 'rail' | 'road'
    pairs: Array<[GroundPlaceSnapshot | null, GroundPlaceSnapshot | null]>
  }
  const journeys = new Map<string, Journey>()
  for (const leg of legs) {
    const journey = journeys.get(leg.journey_id) ?? {
      userId: leg.user_id,
      start: leg.start_date,
      mode: 'rail',
      pairs: [],
    }
    journey.pairs.push([place(leg.from_place), place(leg.to_place)])
    journeys.set(leg.journey_id, journey)
  }
  // Points arrive ordered by journey, then ordinal.
  for (let i = 1; i < points.length; i += 1) {
    const [a, b] = [points[i - 1], points[i]]
    if (a.journey_id !== b.journey_id) continue
    const journey = journeys.get(b.journey_id) ?? {
      userId: b.user_id,
      start: b.start_date,
      mode: 'road',
      pairs: [],
    }
    journey.pairs.push([place(a.place), place(b.place)])
    journeys.set(b.journey_id, journey)
  }
  for (const journey of journeys.values()) {
    const km = journeyDistance(journey.pairs).distanceKm
    if (km === null) continue
    const books = journey.start?.slice(0, 4) === year ? [all, inYear] : [all]
    for (const book of books) {
      const kms = book.get(journey.userId) ?? { rail: 0, road: 0 }
      kms[journey.mode] += km
      book.set(journey.userId, kms)
    }
  }
  // More rail kilometres run the locomotive; anything else, including no known distance, drives the car.
  const vehicle = (book: typeof all) => (userId: string) => {
    const kms = book.get(userId)
    return kms && kms.rail > kms.road ? 'rail' : 'road'
  }
  return { all: vehicle(all), year: vehicle(inYear) }
}

/**
 * Full rebuild of `leaderboard_cache`: DELETE all rows, then INSERT one row per ranked member per category
 * per period, in one batch.
 */
export async function refreshLeaderboards(db: D1Database, now = new Date()): Promise<void> {
  const year = currentPeriod(now)
  const reads = await db.batch([
    // Sky members with their all-time values (user_stats).
    db.prepare(
      `SELECT us.user_id, p.created_at, p.username, p.display_name, p.avatar_url, p.avatar_face,
              us.total_flights AS flights, us.total_distance_km AS distance, us.countries_count AS countries,
              us.airports_count AS cities, us.airlines_count AS airlines
       FROM user_stats us
       JOIN profiles p ON p.id = us.user_id
       ${derivedStateJoin('us')}
       WHERE us.total_flights >= ${SKY_MIN_FLIGHTS} AND ${PUBLISHED_PUBLIC}`,
    ),
    // Sky values for the year, from that year's flights. Countries here are airport countries only: the
    // year has no legacy evidence or connection/transit rules, so it can differ from the all-time number.
    db
      .prepare(
        `WITH year_flights AS (
         SELECT * FROM flights
         WHERE lifecycle_state IN ('awaiting', 'logged') AND substr(date, 1, 4) = ?
       ),
       endpoints AS (
         SELECT user_id, origin AS iata FROM year_flights
         UNION SELECT user_id, destination FROM year_flights
       )
       SELECT f.user_id, COUNT(*) AS flights, ROUND(COALESCE(SUM(f.distance_km), 0)) AS distance,
              COUNT(DISTINCT f.airline_iata) AS airlines,
              (SELECT COUNT(*) FROM endpoints e WHERE e.user_id = f.user_id) AS cities,
              (SELECT COUNT(DISTINCT a.country_code) FROM endpoints e
                 JOIN airports_reference a ON a.iata = e.iata WHERE e.user_id = f.user_id) AS countries
       FROM year_flights f
       GROUP BY f.user_id`,
      )
      .bind(year),
    // Ground members: consent includes publishing all countries (ADR 0007 refinement).
    db.prepare(
      `SELECT p.id AS user_id, p.created_at, p.username, p.display_name, p.avatar_url, p.avatar_face,
              g.rail, g.road, g.ground_countries
       FROM (${groundTotals(null)}) g
       JOIN profiles p ON p.id = g.user_id
       ${derivedStateJoin('g')}
       WHERE g.rail + g.road >= ${GROUND_MIN_JOURNEYS} AND p.passport_publication = 'all'
         AND ${PUBLISHED_PUBLIC}`,
    ),
    db.prepare(groundTotals(year)),
    db.prepare(topAircraft(false)),
    db.prepare(topAircraft(true)).bind(year),
    db.prepare(
      `SELECT l.user_id, l.journey_id, j.start_date, l.from_place, l.to_place
       FROM ground_rail_legs l
       JOIN ground_journeys j ON j.id = l.journey_id AND j.user_id = l.user_id
       WHERE j.status = 'completed'`,
    ),
    db.prepare(
      `SELECT p.user_id, p.journey_id, j.start_date, p.place
       FROM ground_road_points p
       JOIN ground_journeys j ON j.id = p.journey_id AND j.user_id = p.user_id
       WHERE j.status = 'completed'
       ORDER BY p.journey_id, p.ordinal`,
    ),
  ])
  const [sky, skyYear, ground, groundYear] = reads
    .slice(0, 4)
    .map((read) => read.results as unknown as Array<Member & Values>)
  const [aircraftAll, aircraftYear] = reads
    .slice(4, 6)
    .map(
      (read) =>
        new Map(
          (read.results as Array<{ user_id: string; icao: string }>).map((row) => [
            row.user_id,
            row.icao,
          ]),
        ),
    )

  const groundVehicle = groundKm(
    reads[6].results as unknown as Parameters<typeof groundKm>[0],
    reads[7].results as unknown as Parameters<typeof groundKm>[1],
    year,
  )

  const members = new Map<string, Member>()
  for (const row of [...sky, ...ground]) members.set(row.user_id, row)
  const yearOf = (rows: Array<Member & Values>) => new Map(rows.map((row) => [row.user_id, row]))
  const skyYearById = yearOf(skyYear)
  const groundYearById = yearOf(groundYear)

  const boards: Array<{
    category: LeaderboardCategory
    period: string
    values: Array<{ userId: string; value: number }>
    keepZero: boolean
  }> = []
  const board = (
    categories: readonly LeaderboardCategory[],
    period: string,
    rows: Array<Member & Values>,
    lookup: (row: Member & Values) => Values | undefined,
    keepZero: boolean,
  ) => {
    for (const category of categories) {
      boards.push({
        category,
        period,
        keepZero,
        values: rows.map((row) => ({
          userId: row.user_id,
          value: Number(lookup(row)?.[category] ?? 0),
        })),
      })
    }
  }
  board(SKY_CATEGORIES, 'all', sky, (row) => row, true)
  board(SKY_CATEGORIES, year, sky, (row) => skyYearById.get(row.user_id), false)
  board(GROUND_CATEGORIES, 'all', ground, (row) => row, false)
  board(GROUND_CATEGORIES, year, ground, (row) => groundYearById.get(row.user_id), false)

  const updatedAt = nowIso()
  // Sky rows preserve the actual aircraft type for their period; artwork fallback belongs to the client.
  // Ground Countries rows add the mode with more kilometres in their period.
  const metadata = (userId: string, category: LeaderboardCategory, period: string) => {
    const m = members.get(userId)
    if (!m) return '{}'
    return JSON.stringify({
      username: m.username,
      display_name: m.display_name,
      avatar_url: m.avatar_url,
      avatar_face: m.avatar_face,
      ...(category === 'ground_countries'
        ? { vehicle: (period === 'all' ? groundVehicle.all : groundVehicle.year)(userId) }
        : isGroundCategory(category)
          ? {}
          : { aircraft: (period === 'all' ? aircraftAll : aircraftYear).get(userId) ?? null }),
    })
  }
  const signup = (id: string) => members.get(id)?.created_at ?? ''

  const inserts: Array<(string | number)[]> = []
  for (const { category, period, values, keepZero } of boards) {
    // Ties keep signup order for a stable listing; they share the rank.
    const ranked = values
      .filter((entry) => keepZero || entry.value > 0)
      .sort((a, b) => b.value - a.value || signup(a.userId).localeCompare(signup(b.userId)))
    const total = ranked.length
    let rank = 0
    ranked.forEach((entry, i) => {
      if (i === 0 || entry.value !== ranked[i - 1].value) rank = i + 1
      const percentile = Math.round((1 - rank / total) * 100 * 10) / 10
      inserts.push([
        entry.userId,
        category,
        period,
        entry.value,
        rank,
        percentile,
        metadata(entry.userId, category, period),
        updatedAt,
      ])
    })
  }

  // Always clear the cache, even when nobody is eligible (DELETE-then-INSERT in one batch).
  const statements = [db.prepare('DELETE FROM leaderboard_cache WHERE 1 = 1')]
  const row = `(${Array(BINDS_PER_ROW).fill('?').join(', ')})`
  for (let i = 0; i < inserts.length; i += ROWS_PER_INSERT) {
    const chunk = inserts.slice(i, i + ROWS_PER_INSERT)
    statements.push(
      db
        .prepare(
          `INSERT INTO leaderboard_cache (user_id, category, period, value, rank, percentile, metadata, updated_at)
           VALUES ${chunk.map(() => row).join(', ')}`,
        )
        .bind(...chunk.flat()),
    )
  }
  await db.batch(statements)
}
