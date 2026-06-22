// user_stats row + DTO. has_night_departure is the only 0/1 boolean; everything else is numeric or
// text. recomputeUserStats deliberately leaves most_visited_*, world_completion_pct and
// time_zones_count at their defaults (parity quirk — the frontend tolerates it), but they are still
// returned so the shape matches the old Supabase row.

export interface UserStatsRow {
  user_id: string
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
  time_zones_count: number
  most_visited_country: string | null
  most_visited_count: number
  world_completion_pct: number
  has_night_departure: number
  updated_at: string
}

export function toUserStats(row: UserStatsRow) {
  return {
    user_id: row.user_id,
    total_flights: row.total_flights,
    total_distance_km: row.total_distance_km,
    total_duration_minutes: row.total_duration_minutes,
    longest_flight_minutes: row.longest_flight_minutes,
    airports_count: row.airports_count,
    cities_count: row.cities_count,
    countries_count: row.countries_count,
    continents_count: row.continents_count,
    airlines_count: row.airlines_count,
    aircraft_count: row.aircraft_count,
    time_zones_count: row.time_zones_count,
    most_visited_country: row.most_visited_country,
    most_visited_count: row.most_visited_count,
    world_completion_pct: row.world_completion_pct,
    has_night_departure: !!row.has_night_departure,
    updated_at: row.updated_at,
  }
}
