// Advanced-stats DATA breakdowns — faithful ports of the live PL/pgSQL `compute_*`
// functions (see db/_extracted/LOGIC_SPEC.md "refresh_advanced_stats" section).
//
// Each function is PURE/read-only and returns the EXACT JSON shape the live Supabase
// function returns. The orchestrator's composer JSON.stringifies these into the
// user_advanced_stats TEXT columns (this module returns JS values, never strings).
//
// Parity notes (do NOT "fix"):
//   * aircraft_*/aircraft_type/duration_stats aggregate COMPLETED flights only
//     (is_upcoming false/null) with aircraft_icao not null where relevant.
//   * continent/region breakdowns read from `visits` (not flights), COUNT(DISTINCT
//     country_code) per bucket — continent EXCLUDES 'other', region INCLUDES it.
//   * departure_patterns + duration_coverage use ALL flights (incl upcoming).
//   * Live `departure_time` is a Postgres `time` (HH:MM:SS); D1 stores TEXT HH:MM.
//     EXTRACT(HOUR FROM departure_time) → CAST(substr(departure_time,1,2) AS INTEGER).
//   * Top-10 / map ordering / tie-breaks are reproduced in TS to match the live
//     ORDER BY count DESC (SQLite GROUP BY ordering is otherwise unspecified).

import { regionOf } from '../_lib/continents'
import { firstOf, rowsOf, type BatchedRead } from './stats'

// --- types ---------------------------------------------------------------------------------

export interface AircraftBreakdown {
  aircraft: Record<string, number>
  manufacturers: Record<string, number>
}

export interface MostFlown {
  icao: string
  name: string
  count: number
  total_flights: number
}

export interface AircraftTypeBreakdown {
  types: Record<string, number>
  most_flown: MostFlown | null
}

export type ContinentBreakdown = Record<string, number>
export type RegionBreakdown = Record<string, number>

export interface DurationStats {
  total_minutes: number
  avg_minutes: number
  longest_minutes: number
  longest_flight_id: number | null
  shortest_minutes: number
  shortest_flight_id: number | null
  flight_count: number
}

export interface DeparturePatterns {
  red_eye: number
  early: number
  business: number
  evening: number
  total_with_time: number
}

// =========================================================================================
// 1. compute_aircraft_breakdown
//    { aircraft: {icao -> count} (top-10), manufacturers: {manufacturer -> count} }
//    Completed flights, aircraft_icao not null. Manufacturer via LEFT JOIN aircraft_reference,
//    COALESCE 'Unknown'. Both maps ordered by count DESC (manufacturers has no LIMIT).
// =========================================================================================

export function computeAircraftBreakdown(db: D1Database, userId: string): BatchedRead<AircraftBreakdown> {
  const ac = db
    .prepare(
      `SELECT aircraft_icao AS icao, COUNT(*) AS count
       FROM flights
       WHERE user_id = ?
         AND aircraft_icao IS NOT NULL
         AND (is_upcoming IS NULL OR is_upcoming = 0)
       GROUP BY aircraft_icao
       ORDER BY count DESC
       LIMIT 10`,
    )
    .bind(userId)
  const mf = db
    .prepare(
      `SELECT COALESCE(ar.manufacturer, 'Unknown') AS manufacturer, COUNT(*) AS count
       FROM flights f
       LEFT JOIN aircraft_reference ar ON f.aircraft_icao = ar.icao
       WHERE f.user_id = ?
         AND f.aircraft_icao IS NOT NULL
         AND (f.is_upcoming IS NULL OR f.is_upcoming = 0)
       GROUP BY COALESCE(ar.manufacturer, 'Unknown')
       ORDER BY count DESC`,
    )
    .bind(userId)
  return {
    statements: [ac, mf],
    derive([acResult, mfResult]) {
      const aircraft: Record<string, number> = {}
      for (const r of rowsOf<{ icao: string; count: number }>(acResult)) aircraft[r.icao] = r.count
      const manufacturers: Record<string, number> = {}
      for (const r of rowsOf<{ manufacturer: string; count: number }>(mfResult)) manufacturers[r.manufacturer] = r.count
      return { aircraft, manufacturers }
    },
  }
}

// =========================================================================================
// 2. compute_aircraft_type_breakdown
//    { types: {type -> count}, most_flown: {icao,name,count,total_flights} | null }
//    Completed flights, aircraft_icao not null. type via LEFT JOIN, COALESCE 'unknown'.
//    most_flown: top aircraft by count; name = COALESCE(ar.name, icao); total_flights =
//    SUM over all groups (= total completed flights with aircraft_icao). null if none.
// =========================================================================================

export function computeAircraftTypeBreakdown(db: D1Database, userId: string): BatchedRead<AircraftTypeBreakdown> {
  const tp = db
    .prepare(
      `SELECT COALESCE(ar.type, 'unknown') AS type, COUNT(*) AS count
       FROM flights f
       LEFT JOIN aircraft_reference ar ON f.aircraft_icao = ar.icao
       WHERE f.user_id = ?
         AND f.aircraft_icao IS NOT NULL
         AND (f.is_upcoming IS NULL OR f.is_upcoming = 0)
       GROUP BY COALESCE(ar.type, 'unknown')
       ORDER BY count DESC`,
    )
    .bind(userId)

  // total = sum over all aircraft groups (SUM(COUNT(*)) OVER()); top aircraft by count.
  const most = db
    .prepare(
      `SELECT t.aircraft_icao AS icao,
              COALESCE(ar.name, t.aircraft_icao) AS name,
              t.flight_count AS count
       FROM (
         SELECT f.aircraft_icao, COUNT(*) AS flight_count
         FROM flights f
         WHERE f.user_id = ?
           AND f.aircraft_icao IS NOT NULL
           AND (f.is_upcoming IS NULL OR f.is_upcoming = 0)
         GROUP BY f.aircraft_icao
         ORDER BY flight_count DESC
         LIMIT 1
       ) t
       LEFT JOIN aircraft_reference ar ON t.aircraft_icao = ar.icao`,
    )
    .bind(userId)

  const total = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM flights
       WHERE user_id = ?
         AND aircraft_icao IS NOT NULL
         AND (is_upcoming IS NULL OR is_upcoming = 0)`,
    )
    .bind(userId)

  return {
    statements: [tp, most, total],
    derive([tpResult, mostResult, totalResult]) {
      const types: Record<string, number> = {}
      for (const r of rowsOf<{ type: string; count: number }>(tpResult)) types[r.type] = r.count
      const mostRow = firstOf<{ icao: string; name: string; count: number }>(mostResult)
      if (!mostRow) return { types, most_flown: null }
      return {
        types,
        most_flown: {
          icao: mostRow.icao,
          name: mostRow.name,
          count: mostRow.count,
          total_flights: firstOf<{ total: number }>(totalResult)?.total ?? 0,
        },
      }
    },
  }
}

// =========================================================================================
// 3. compute_continent_breakdown  (map B via regionOf; EXCLUDES 'other')
//    { bucket -> COUNT(DISTINCT country_code) } over visits.
// =========================================================================================

/** Visit-based breakdown against visits awaiting atomic publication. */
export function continentBreakdownForCountries(countryCodes: Iterable<string>): ContinentBreakdown {
  return regionCountsForCountries(countryCodes, false)
}

// =========================================================================================
// 4. compute_region_breakdown  (map B via regionOf; INCLUDES 'other')
// =========================================================================================

export function regionBreakdownForCountries(countryCodes: Iterable<string>): RegionBreakdown {
  return regionCountsForCountries(countryCodes, true)
}

/**
 * Shared core for continent/region breakdowns: count DISTINCT country codes per map-B bucket.
 * `includeOther` toggles whether the 'other' bucket is emitted (continent excludes, region includes).
 */
function regionCountsForCountries(countryCodes: Iterable<string>, includeOther: boolean): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const code of new Set(countryCodes)) {
    const bucket = regionOf(code)
    if (!includeOther && bucket === 'other') continue
    counts[bucket] = (counts[bucket] ?? 0) + 1
  }
  return counts
}

// =========================================================================================
// 5. compute_duration_stats
//    Completed flights with duration_minutes not null.
//    { total_minutes, avg_minutes (ROUND(AVG)), longest_minutes, longest_flight_id,
//      shortest_minutes (MIN(NULLIF(dur,0))), shortest_flight_id, flight_count }
//    NOTE (live quirk preserved): the MAX/MIN subqueries that resolve the *_flight_id and
//    the AVG/SUM/MAX use SLIGHTLY different filters. Aggregates run over completed+not-null.
//    The MAX subquery for longest_flight_id matches over ALL flights (no upcoming filter)
//    but the outer id-select re-filters to completed. The MIN subquery uses
//    MIN(NULLIF(dur,0)) over all flights then id-selects completed with dur>0.
// =========================================================================================

export function computeDurationStats(db: D1Database, userId: string): BatchedRead<DurationStats> {
  const agg = db
    .prepare(
      `SELECT
         COALESCE(SUM(duration_minutes), 0) AS total_minutes,
         COALESCE(ROUND(AVG(duration_minutes)), 0) AS avg_minutes,
         COALESCE(MAX(duration_minutes), 0) AS longest_minutes,
         COALESCE(MIN(NULLIF(duration_minutes, 0)), 0) AS shortest_minutes,
         COUNT(*) AS flight_count
       FROM flights
       WHERE user_id = ?
         AND (is_upcoming IS NULL OR is_upcoming = 0)
         AND duration_minutes IS NOT NULL`,
    )
    .bind(userId)

  // longest_flight_id: id of a completed flight whose duration = MAX(duration) over ALL
  // flights for the user (live inner MAX has no is_upcoming filter), LIMIT 1.
  const longest = db
    .prepare(
      `SELECT id FROM flights
       WHERE user_id = ?
         AND duration_minutes = (SELECT MAX(duration_minutes) FROM flights WHERE user_id = ?)
         AND (is_upcoming IS NULL OR is_upcoming = 0)
       LIMIT 1`,
    )
    .bind(userId, userId)

  // shortest_flight_id: id of a completed flight with dur>0 whose duration =
  // MIN(NULLIF(duration,0)) over ALL flights, LIMIT 1.
  const shortest = db
    .prepare(
      `SELECT id FROM flights
       WHERE user_id = ?
         AND duration_minutes > 0
         AND duration_minutes = (SELECT MIN(NULLIF(duration_minutes, 0)) FROM flights WHERE user_id = ?)
         AND (is_upcoming IS NULL OR is_upcoming = 0)
       LIMIT 1`,
    )
    .bind(userId, userId)

  return {
    statements: [agg, longest, shortest],
    derive([aggResult, longestResult, shortestResult]) {
      const a = firstOf<{
        total_minutes: number
        avg_minutes: number
        longest_minutes: number
        shortest_minutes: number
        flight_count: number
      }>(aggResult)
      return {
        total_minutes: a?.total_minutes ?? 0,
        avg_minutes: a?.avg_minutes ?? 0,
        longest_minutes: a?.longest_minutes ?? 0,
        longest_flight_id: firstOf<{ id: number }>(longestResult)?.id ?? null,
        shortest_minutes: a?.shortest_minutes ?? 0,
        shortest_flight_id: firstOf<{ id: number }>(shortestResult)?.id ?? null,
        flight_count: a?.flight_count ?? 0,
      }
    },
  }
}

// =========================================================================================
// 6. compute_departure_patterns  (ALL flights incl upcoming; returns null if total = 0)
//    Buckets by hour of departure_time: red_eye [22..24)∪[0..6), early [6..12),
//    business [12..18), evening [18..22). total_with_time = count with departure_time.
//    SQLite has no EXTRACT: hour = CAST(substr(departure_time,1,2) AS INTEGER).
// =========================================================================================

export function computeDeparturePatterns(db: D1Database, userId: string): BatchedRead<DeparturePatterns | null> {
  const statement = db
    .prepare(
      `SELECT
         COUNT(*) FILTER (WHERE departure_time IS NOT NULL) AS total_with_time,
         COUNT(*) FILTER (
           WHERE departure_time IS NOT NULL
             AND (CAST(substr(departure_time, 1, 2) AS INTEGER) >= 22
               OR CAST(substr(departure_time, 1, 2) AS INTEGER) < 6)
         ) AS red_eye,
         COUNT(*) FILTER (
           WHERE departure_time IS NOT NULL
             AND CAST(substr(departure_time, 1, 2) AS INTEGER) >= 6
             AND CAST(substr(departure_time, 1, 2) AS INTEGER) < 12
         ) AS early,
         COUNT(*) FILTER (
           WHERE departure_time IS NOT NULL
             AND CAST(substr(departure_time, 1, 2) AS INTEGER) >= 12
             AND CAST(substr(departure_time, 1, 2) AS INTEGER) < 18
         ) AS business,
         COUNT(*) FILTER (
           WHERE departure_time IS NOT NULL
             AND CAST(substr(departure_time, 1, 2) AS INTEGER) >= 18
             AND CAST(substr(departure_time, 1, 2) AS INTEGER) < 22
         ) AS evening
       FROM flights
       WHERE user_id = ?`,
    )
    .bind(userId)
  return {
    statements: [statement],
    derive([result]) {
      const r = firstOf<{ total_with_time: number; red_eye: number; early: number; business: number; evening: number }>(result)
      if (!r || r.total_with_time === 0) return null
      return {
        red_eye: r.red_eye,
        early: r.early,
        business: r.business,
        evening: r.evening,
        total_with_time: r.total_with_time,
      }
    },
  }
}

// =========================================================================================
// 7. compute_duration_coverage  (ALL flights)
//    ROUND(count(duration>0) / count(all) * 100, 1) as a REAL. 0 when no flights.
// =========================================================================================

export function computeDurationCoverage(db: D1Database, userId: string): BatchedRead<number> {
  const statement = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE duration_minutes IS NOT NULL AND duration_minutes > 0) AS with_duration
       FROM flights
       WHERE user_id = ?`,
    )
    .bind(userId)
  return {
    statements: [statement],
    derive([result]) {
      const r = firstOf<{ total: number; with_duration: number }>(result)
      if (!r || r.total === 0) return 0
      return Math.round((r.with_duration / r.total) * 100 * 10) / 10
    },
  }
}
