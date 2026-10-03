// Core write-path services — ported from the live PL/pgSQL (see db/_extracted/LOGIC_SPEC.md).
// Distance/duration fill runs on flight writes; the stats and badge statements below are
// composed by derivedState.repairUserDerivedState.
//
// Parity notes (do not "fix"): recompute does NOT set most_visited_*, world_completion_pct,
// or time_zones_count.

import { nowIso } from '../_lib/time'
import { continentOf7 } from '../_lib/continents'

// Plausibility bounds for distance/duration. The server CLAMPS client-supplied values so a
// forged number can't inflate user_stats or unlock badges (security finding: client-trusted
// distance_km / duration_minutes were written verbatim, no recompute, no CHECK).
const MAX_DISTANCE_KM = 20_000 // > longest real non-stop (~15,300 km), < half-Earth great-circle
const MAX_DURATION_MIN = 1_200 // 20 h ceiling
const clampDistance = (d: number | null): number | null => (d == null ? null : Math.max(0, Math.min(MAX_DISTANCE_KM, d)))
const clampDuration = (m: number | null): number | null => (m == null ? null : Math.max(0, Math.min(MAX_DURATION_MIN, m)))

// --- distance / duration (fill_flight_distance + haversine_km) ----------------------------

/** Great-circle km with the live 1.10 routing factor, rounded to an integer. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const ROUTING_FACTOR = 1.1
  const rad = (x: number) => (x * Math.PI) / 180
  const dlat = rad(lat2 - lat1)
  const dlon = rad(lon2 - lon1)
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dlon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * ROUTING_FACTOR)
}

/**
 * Fill distance_km (and a duration fallback) from airports_reference when distance is null —
 * mirrors fill_flight_distance. Returns the resolved values to write on the flight row.
 */
export async function fillDistanceAndDuration(
  db: D1Database,
  origin: string,
  destination: string,
  distanceKm: number | null,
  durationMinutes: number | null,
): Promise<{ distanceKm: number | null; durationMinutes: number | null }> {
  // Clamp a client-supplied distance/duration to a plausible range instead of trusting it verbatim.
  if (distanceKm != null) return { distanceKm: clampDistance(distanceKm), durationMinutes: clampDuration(durationMinutes) }

  const o = await db
    .prepare('SELECT latitude, longitude FROM airports_reference WHERE iata = ?')
    .bind(origin)
    .first<{ latitude: number | null; longitude: number | null }>()
  const d = await db
    .prepare('SELECT latitude, longitude FROM airports_reference WHERE iata = ?')
    .bind(destination)
    .first<{ latitude: number | null; longitude: number | null }>()

  if (o?.latitude == null || o.longitude == null || d?.latitude == null || d.longitude == null) {
    return { distanceKm, durationMinutes: clampDuration(durationMinutes) }
  }

  const dist = haversineKm(o.latitude, o.longitude, d.latitude, d.longitude)
  let dur = durationMinutes
  if (durationMinutes == null && dist > 0) {
    const overhead = dist > 3000 ? 45 : 30
    dur = Math.round((dist / 800) * 60 + overhead)
  }
  return { distanceKm: clampDistance(dist), durationMinutes: clampDuration(dur) }
}

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

/** Read canonical flights; stats are calculated against the proposed visits, never old visits. */
export function computeStatsForVisits(
  db: D1Database,
  userId: string,
): BatchedRead<(visits: DerivedVisit[]) => ComputedUserStats> {
  return {
    statements: [db.prepare(
      `SELECT COUNT(*) AS total_flights, COALESCE(SUM(distance_km), 0) AS total_distance_km,
              COALESCE(SUM(duration_minutes), 0) AS total_duration_minutes,
              COALESCE(MAX(duration_minutes), 0) AS longest_flight_minutes,
              COUNT(DISTINCT airline_iata) AS airlines_count,
              COUNT(DISTINCT aircraft_icao) AS aircraft_count,
              COALESCE(MAX(CASE WHEN departure_time IS NOT NULL
                AND CAST(substr(departure_time, 1, 2) AS INTEGER) < 5 THEN 1 ELSE 0 END), 0) AS has_night_departure
       FROM flights WHERE user_id = ? AND (is_upcoming IS NULL OR is_upcoming = 0)`,
    ).bind(userId)],
    derive: ([result]) => (visits) => {
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
        countries_count: new Set(visits.map(v => v.country_code)).size,
        continents_count: new Set(visits.map(v => v.country_code).map(continentOf7)).size,
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
