// Core write-path services — ported from the live PL/pgSQL (see db/_extracted/LOGIC_SPEC.md).
// These replace the Postgres trigger chain that fired on flight writes:
//   fill distance/duration → derive visits → recompute user_stats → unlock flags → evaluate badges.
//
// Parity notes (do not "fix"): countries/cities/continents are counted from `visits` only;
// visits accumulate (no decrement on flight delete); recompute does NOT set most_visited_*,
// world_completion_pct, or time_zones_count.

import { nowIso } from '../_lib/time'
import { continentOf7 } from '../_lib/continents'

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
  if (distanceKm != null) return { distanceKm, durationMinutes }

  const o = await db
    .prepare('SELECT latitude, longitude FROM airports_reference WHERE iata = ?')
    .bind(origin)
    .first<{ latitude: number | null; longitude: number | null }>()
  const d = await db
    .prepare('SELECT latitude, longitude FROM airports_reference WHERE iata = ?')
    .bind(destination)
    .first<{ latitude: number | null; longitude: number | null }>()

  if (o?.latitude == null || o.longitude == null || d?.latitude == null || d.longitude == null) {
    return { distanceKm, durationMinutes }
  }

  const dist = haversineKm(o.latitude, o.longitude, d.latitude, d.longitude)
  let dur = durationMinutes
  if (durationMinutes == null && dist > 0) {
    const overhead = dist > 3000 ? 45 : 30
    dur = Math.round((dist / 800) * 60 + overhead)
  }
  return { distanceKm: dist, durationMinutes: dur }
}

// --- visits derivation (update_visits_from_flight) ---------------------------------------

export interface FlightForVisits {
  origin: string
  destination: string
  date: string
  is_upcoming: number | boolean | null
}

/**
 * Upsert origin + destination visits for a flight. Mirrors update_visits_from_flight:
 * INSERT/UPDATE only (callers must NOT call this on delete — visits are cumulative),
 * skips upcoming flights, skips airports missing from airports_reference.
 */
export async function syncVisitsFromFlight(db: D1Database, userId: string, flight: FlightForVisits): Promise<void> {
  if (flight.is_upcoming) return
  for (const iata of [flight.origin, flight.destination]) {
    const ap = await db
      .prepare('SELECT iata, country_code, city FROM airports_reference WHERE iata = ?')
      .bind(iata)
      .first<{ iata: string; country_code: string; city: string | null }>()
    if (!ap) continue
    await db
      .prepare(
        `INSERT INTO visits (user_id, country_code, city, airport_iata, first_visit, last_visit, visit_count)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT (user_id, airport_iata) DO UPDATE SET
           last_visit  = MAX(visits.last_visit, excluded.last_visit),
           first_visit = MIN(visits.first_visit, excluded.first_visit),
           visit_count = visits.visit_count + 1`,
      )
      .bind(userId, ap.country_code, ap.city, ap.iata, flight.date, flight.date)
      .run()
  }
}

// --- user_stats recompute (recalculate_user_stats) --------------------------------------

export async function recomputeUserStats(db: D1Database, userId: string): Promise<void> {
  const f = await db
    .prepare(
      `SELECT
         COUNT(*) AS total_flights,
         COALESCE(SUM(distance_km), 0) AS total_distance_km,
         COALESCE(MAX(duration_minutes), 0) AS longest_flight_minutes,
         COALESCE(SUM(duration_minutes), 0) AS total_duration_minutes,
         COUNT(DISTINCT CASE WHEN airline_iata IS NOT NULL THEN airline_iata END) AS airlines_count,
         COUNT(DISTINCT CASE WHEN aircraft_icao IS NOT NULL THEN aircraft_icao END) AS aircraft_count
       FROM flights
       WHERE user_id = ? AND (is_upcoming IS NULL OR is_upcoming = 0)`,
    )
    .bind(userId)
    .first<{
      total_flights: number
      total_distance_km: number
      longest_flight_minutes: number
      total_duration_minutes: number
      airlines_count: number
      aircraft_count: number
    }>()

  const v = await db
    .prepare(
      `SELECT
         COUNT(DISTINCT CASE WHEN airport_iata IS NOT NULL THEN airport_iata END) AS airports_count,
         COUNT(DISTINCT country_code) AS countries_count,
         COUNT(DISTINCT city) AS cities_count
       FROM visits WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{ airports_count: number; countries_count: number; cities_count: number }>()

  // Continents: distinct 7-bucket continent over visits' country codes (TS map for parity).
  const ccRows = await db
    .prepare('SELECT DISTINCT country_code FROM visits WHERE user_id = ? AND country_code IS NOT NULL')
    .bind(userId)
    .all<{ country_code: string }>()
  const continents = new Set<string>()
  for (const r of ccRows.results) continents.add(continentOf7(r.country_code))
  const continentsCount = continents.size

  const night = await db
    .prepare(
      `SELECT EXISTS(
         SELECT 1 FROM flights
         WHERE user_id = ? AND departure_time IS NOT NULL
           AND CAST(substr(departure_time, 1, 2) AS INTEGER) < 5
           AND (is_upcoming IS NULL OR is_upcoming = 0)
       ) AS has_night`,
    )
    .bind(userId)
    .first<{ has_night: number }>()

  await db
    .prepare(
      `INSERT INTO user_stats (
         user_id, total_flights, total_distance_km, countries_count, cities_count,
         airlines_count, aircraft_count, continents_count, longest_flight_minutes,
         has_night_departure, airports_count, total_duration_minutes, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         total_flights = excluded.total_flights,
         total_distance_km = excluded.total_distance_km,
         countries_count = excluded.countries_count,
         cities_count = excluded.cities_count,
         airlines_count = excluded.airlines_count,
         aircraft_count = excluded.aircraft_count,
         continents_count = excluded.continents_count,
         longest_flight_minutes = excluded.longest_flight_minutes,
         has_night_departure = excluded.has_night_departure,
         airports_count = excluded.airports_count,
         total_duration_minutes = excluded.total_duration_minutes,
         updated_at = excluded.updated_at`,
    )
    .bind(
      userId,
      f?.total_flights ?? 0,
      Math.round(f?.total_distance_km ?? 0),
      v?.countries_count ?? 0,
      v?.cities_count ?? 0,
      f?.airlines_count ?? 0,
      f?.aircraft_count ?? 0,
      continentsCount,
      f?.longest_flight_minutes ?? 0,
      night?.has_night ? 1 : 0,
      v?.airports_count ?? 0,
      f?.total_duration_minutes ?? 0,
      nowIso(),
    )
    .run()
}

// --- advanced-stats unlock flags (update_advanced_stats_unlocks) -------------------------

export async function updateAdvancedStatsUnlocks(db: D1Database, userId: string): Promise<void> {
  const s = await db
    .prepare('SELECT aircraft_count, countries_count, total_flights FROM user_stats WHERE user_id = ?')
    .bind(userId)
    .first<{ aircraft_count: number; countries_count: number; total_flights: number }>()
  if (!s) return
  await db
    .prepare(
      `INSERT INTO user_advanced_stats (user_id, avia_geek_unlocked, country_geek_unlocked, duration_unlocked, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         avia_geek_unlocked = excluded.avia_geek_unlocked,
         country_geek_unlocked = excluded.country_geek_unlocked,
         duration_unlocked = excluded.duration_unlocked,
         updated_at = excluded.updated_at`,
    )
    .bind(userId, s.aircraft_count >= 5 ? 1 : 0, s.countries_count >= 5 ? 1 : 0, s.total_flights >= 10 ? 1 : 0, nowIso())
    .run()
}

// --- badges (evaluate_badges) -----------------------------------------------------------

interface BadgeRow {
  id: number
  criteria: string | null
}

export async function evaluateBadges(db: D1Database, userId: string): Promise<void> {
  const s = await db
    .prepare(
      `SELECT total_flights, total_distance_km, airlines_count, aircraft_count, continents_count,
              longest_flight_minutes, has_night_departure
       FROM user_stats WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{
      total_flights: number
      total_distance_km: number
      airlines_count: number
      aircraft_count: number
      continents_count: number
      longest_flight_minutes: number
      has_night_departure: number
    }>()
  if (!s) return

  const prof = await db.prepare('SELECT created_at FROM profiles WHERE id = ?').bind(userId).first<{ created_at: string }>()
  const un = await db
    .prepare('SELECT COUNT(*) + 1 AS n FROM profiles WHERE created_at < ?')
    .bind(prof?.created_at ?? nowIso())
    .first<{ n: number }>()
  const userNumber = un?.n ?? 1

  const badges = await db.prepare('SELECT id, criteria FROM badge_definitions').all<BadgeRow>()
  const toAward: number[] = []

  for (const b of badges.results) {
    let crit: Record<string, unknown> = {}
    if (b.criteria) {
      try {
        crit = JSON.parse(b.criteria)
      } catch {
        crit = {}
      }
    }
    const num = (k: string) => Number(crit[k])
    let earned = false
    // ELSIF chain — order matters, first match wins.
    if ('flights' in crit && s.total_flights >= num('flights')) earned = true
    else if ('distance_km' in crit && s.total_distance_km >= num('distance_km')) earned = true
    else if ('airlines' in crit && s.airlines_count >= num('airlines')) earned = true
    else if ('aircraft' in crit && s.aircraft_count >= num('aircraft')) earned = true
    else if ('continents' in crit && s.continents_count >= num('continents')) earned = true
    else if ('flight_minutes' in crit && s.longest_flight_minutes >= num('flight_minutes')) earned = true
    else if ('night_departure' in crit && s.has_night_departure === 1) earned = true
    else if ('early_adopter' in crit && userNumber <= num('early_adopter')) earned = true
    else if ('beta_invite' in crit) earned = true // legacy: always awarded
    if (earned) toAward.push(b.id)
  }

  if (toAward.length) {
    const now = nowIso()
    await db.batch(
      toAward.map((id) =>
        db
          .prepare('INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, ?) ON CONFLICT (user_id, badge_id) DO NOTHING')
          .bind(userId, id, now),
      ),
    )
  }
}
