// Flight row + DTO mappers (mirrors _lib/profiles.ts). SQLite stores is_upcoming as 0/1; the API
// returns a real boolean to match the old Supabase row shape. toOwnFlight is a strict allowlist:
// it drops `user_id` (always the requester) and `aircraft_lookup_attempts` (a D1-only internal
// enrichment counter never present in the Supabase types the frontend was generated from) → 19 cols.

export interface FlightRow {
  id: number
  user_id: string
  date: string
  origin: string
  destination: string
  airline_iata: string | null
  aircraft_icao: string | null
  flight_number: string | null
  departure_time: string | null
  arrival_time: string | null
  departure_utc: string | null
  arrival_utc: string | null
  origin_tz: string | null
  dest_tz: string | null
  distance_km: number | null
  duration_minutes: number | null
  source: string
  is_upcoming: number | null
  enrichment_status: string
  aircraft_lookup_attempts: number
  created_at: string
}

/** Full own-flight DTO: 19 columns (no user_id / aircraft_lookup_attempts); is_upcoming → boolean. */
export function toOwnFlight(row: FlightRow) {
  return {
    id: row.id,
    date: row.date,
    origin: row.origin,
    destination: row.destination,
    airline_iata: row.airline_iata,
    aircraft_icao: row.aircraft_icao,
    flight_number: row.flight_number,
    departure_time: row.departure_time,
    arrival_time: row.arrival_time,
    departure_utc: row.departure_utc,
    arrival_utc: row.arrival_utc,
    origin_tz: row.origin_tz,
    dest_tz: row.dest_tz,
    distance_km: row.distance_km,
    duration_minutes: row.duration_minutes,
    source: row.source,
    is_upcoming: !!row.is_upcoming,
    enrichment_status: row.enrichment_status,
    created_at: row.created_at,
  }
}

/** Lightweight route row for the map — 6 columns only. */
export interface FlightRouteRow {
  id: number
  origin: string
  destination: string
  airline_iata: string | null
  date: string
  is_upcoming: number | null
}

export function toFlightRoute(row: FlightRouteRow) {
  return {
    id: row.id,
    origin: row.origin,
    destination: row.destination,
    airline_iata: row.airline_iata,
    date: row.date,
    is_upcoming: !!row.is_upcoming,
  }
}
