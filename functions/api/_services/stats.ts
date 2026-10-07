// Core write-path services — ported from the live PL/pgSQL (see db/_extracted/LOGIC_SPEC.md).
// Stats and badge statements below are composed by derivedState.repairUserDerivedState.
//
// Parity notes (do not "fix"): recompute does NOT set most_visited_*, world_completion_pct,
// or time_zones_count.

import { nowIso } from '../_lib/time'
import { continentOf7 } from '../_lib/continents'

/** Reads that share one D1 batch; `derive` receives their results in statement order. */
export interface BatchedRead<T> {
  statements: D1PreparedStatement[]
  derive(results: D1Result[]): T
}

/** Concatenate reads into one batch and split the results back by position. */
export function combineReads<T extends unknown[]>(
  ...reads: { [K in keyof T]: BatchedRead<T[K]> }
): BatchedRead<T> {
  const parts = reads as BatchedRead<unknown>[]
  return {
    statements: parts.flatMap(read => read.statements),
    derive(results) {
      let offset = 0
      return parts.map(read => read.derive(results.slice(offset, offset += read.statements.length))) as T
    },
  }
}

export const rowsOf = <T>(result: D1Result | undefined): T[] => (result?.results ?? []) as T[]
export const firstOf = <T>(result: D1Result | undefined): T | null => rowsOf<T>(result)[0] ?? null

interface BadgeRow {
  id: number
  criteria: string | null
}

/** The complete proposed visit row, calculated before any derived table is changed. */
export interface DerivedVisit {
  airport_iata: string
  country_code: string
  city: string | null
  first_visit: string
  last_visit: string
  visit_count: number
}

export interface ComputedUserStats {
  total_flights: number
  total_distance_km: number
  total_duration_minutes: number
  longest_flight_minutes: number
  airports_count: number
  cities_count: number
  countries_count: number
  continents_count: number
  airlines_count: number
  aircraft_count: number
  has_night_departure: number
}

/**
 * Read canonical flights; stats are calculated against the proposed visits (airports) and the proposed
 * country-evidence countries (ADR 0001 §4), never old visits. Airports keep both endpoints of a transit
 * stop; `countries_count` and `continents_count` come from the one country calculation. The continent
 * rule is `continentOf7`, versioned as `badge-continents-v1`: badge eligibility is award-only and unchanged.
 */
export function computeStatsForVisits(
  db: D1Database,
  userId: string,
): BatchedRead<(visits: DerivedVisit[], countries: string[]) => ComputedUserStats> {
  return {
    statements: [db.prepare(
      `SELECT COUNT(*) AS total_flights, COALESCE(SUM(distance_km), 0) AS total_distance_km,
              COALESCE(SUM(duration_minutes), 0) AS total_duration_minutes,
              COALESCE(MAX(duration_minutes), 0) AS longest_flight_minutes,
              COUNT(DISTINCT airline_iata) AS airlines_count,
              COUNT(DISTINCT aircraft_icao) AS aircraft_count,
              COALESCE(MAX(CASE WHEN departure_time IS NOT NULL
                AND CAST(substr(departure_time, 1, 2) AS INTEGER) < 5 THEN 1 ELSE 0 END), 0) AS has_night_departure
       FROM flights WHERE user_id = ? AND lifecycle_state IN ('awaiting', 'logged')`,
    ).bind(userId)],
    derive: ([result]) => (visits, countries) => {
      const flights = firstOf<Pick<ComputedUserStats,
        'total_flights' | 'total_distance_km' | 'total_duration_minutes' |
        'longest_flight_minutes' | 'airlines_count' | 'aircraft_count' | 'has_night_departure'>>(result)
      return {
        total_flights: flights?.total_flights ?? 0,
        total_distance_km: Math.round(flights?.total_distance_km ?? 0),
        total_duration_minutes: flights?.total_duration_minutes ?? 0,
        longest_flight_minutes: flights?.longest_flight_minutes ?? 0,
        airlines_count: flights?.airlines_count ?? 0,
        aircraft_count: flights?.aircraft_count ?? 0,
        has_night_departure: flights?.has_night_departure ?? 0,
        airports_count: visits.length,
        cities_count: new Set(visits.map(v => v.city).filter(Boolean)).size,
        countries_count: new Set(countries).size,
        continents_count: new Set(countries.map(continentOf7)).size,
      }
    },
  }
}

/** Upsert only recalculated fields; historical/unowned fields survive. */
export function computedStatsStatement(
  db: D1Database,
  userId: string,
  stats: ComputedUserStats,
): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO user_stats (
       user_id, total_flights, total_distance_km, total_duration_minutes,
       longest_flight_minutes, airports_count, cities_count, countries_count,
       continents_count, airlines_count, aircraft_count, has_night_departure, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       total_flights=excluded.total_flights, total_distance_km=excluded.total_distance_km,
       total_duration_minutes=excluded.total_duration_minutes,
       longest_flight_minutes=excluded.longest_flight_minutes,
       airports_count=excluded.airports_count, cities_count=excluded.cities_count,
       countries_count=excluded.countries_count, continents_count=excluded.continents_count,
       airlines_count=excluded.airlines_count, aircraft_count=excluded.aircraft_count,
       has_night_departure=excluded.has_night_departure, updated_at=excluded.updated_at`,
  ).bind(
    userId, stats.total_flights, stats.total_distance_km, stats.total_duration_minutes,
    stats.longest_flight_minutes, stats.airports_count, stats.cities_count,
    stats.countries_count, stats.continents_count, stats.airlines_count,
    stats.aircraft_count, stats.has_night_departure, nowIso(),
  )
}

/** Award-only badge evaluation from the new stats row; existing awards are never revoked. */
export function computedBadgeStatements(
  db: D1Database,
  userId: string,
): BatchedRead<(stats: ComputedUserStats) => D1PreparedStatement[]> {
  return {
    statements: [
      // Signup order counts only earlier rows through idx_profiles_created_at.
      db.prepare(
        `SELECT COUNT(*) + 1 AS n FROM profiles
         WHERE created_at < COALESCE((SELECT created_at FROM profiles WHERE id = ?), ?)`,
      ).bind(userId, nowIso()),
      db.prepare('SELECT id, criteria FROM badge_definitions'),
    ],
    derive: ([orderResult, badgeResult]) => (stats) => badgeStatements(
      db, userId, stats, firstOf<{ n: number }>(orderResult), rowsOf<BadgeRow>(badgeResult),
    ),
  }
}

function badgeStatements(
  db: D1Database,
  userId: string,
  stats: ComputedUserStats,
  order: { n: number } | null,
  badges: BadgeRow[],
): D1PreparedStatement[] {
  const earnedAt = nowIso()
  const result: D1PreparedStatement[] = []
  for (const badge of badges) {
    let criteria: Record<string, unknown> = {}
    try { criteria = badge.criteria ? JSON.parse(badge.criteria) : {} } catch { /* malformed criteria earn nothing */ }
    const n = (name: string) => Number(criteria[name])
    let earned = false
    if ('flights' in criteria) earned = stats.total_flights >= n('flights')
    else if ('distance_km' in criteria) earned = stats.total_distance_km >= n('distance_km')
    else if ('airlines' in criteria) earned = stats.airlines_count >= n('airlines')
    else if ('aircraft' in criteria) earned = stats.aircraft_count >= n('aircraft')
    else if ('continents' in criteria) earned = stats.continents_count >= n('continents')
    else if ('flight_minutes' in criteria) earned = stats.longest_flight_minutes >= n('flight_minutes')
    else if ('night_departure' in criteria) earned = stats.has_night_departure === 1
    else if ('early_adopter' in criteria) earned = (order?.n ?? 1) <= n('early_adopter')
    if (earned) result.push(
      db.prepare('INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, ?) ON CONFLICT(user_id, badge_id) DO NOTHING')
        .bind(userId, badge.id, earnedAt),
    )
  }
  return result
}
