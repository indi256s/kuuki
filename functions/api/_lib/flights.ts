import type { DurationSource, OwnFlight } from '../../../packages/shared/src/types'
import type { LifecycleState } from '../_services/countryEvidence'
import type { ConfirmationSource } from '../_services/lifecycle'

export const FLIGHT_COLUMNS =
  'id, user_id, date, origin, destination, airline_iata, aircraft_icao, flight_number, ' +
  'departure_time, arrival_time, departure_utc, arrival_utc, origin_tz, dest_tz, distance_km, ' +
  'duration_minutes, duration_source, times_from_schedule, utc_explicit, zones_overflown, source, is_upcoming, enrichment_status, aircraft_lookup_attempts, created_at, ' +
  'lifecycle_state, confirmation_source, confirmed_at, lifecycle_timezone, awaiting_after, auto_confirm_after, ' +
  'arrival_transit, arrival_transit_leg_id'

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
  duration_source: DurationSource | null
  times_from_schedule: 0 | 1
  utc_explicit: 0 | 1
  zones_overflown: number | null
  source: string
  is_upcoming: number | null
  enrichment_status: string
  aircraft_lookup_attempts: number
  created_at: string
  lifecycle_state: LifecycleState
  confirmation_source: ConfirmationSource | null
  confirmed_at: string | null
  lifecycle_timezone: string | null
  awaiting_after: string | null
  auto_confirm_after: string | null
  arrival_transit: number | null
  arrival_transit_leg_id: number | null
}

export function toOwnFlight(row: FlightRow): OwnFlight {
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
    duration_source: row.duration_source,
    zones_overflown: row.zones_overflown,
    source: row.source,
    is_upcoming: !!row.is_upcoming,
    enrichment_status: row.enrichment_status,
    created_at: row.created_at,
    lifecycle_state: row.lifecycle_state,
    confirmation_source: row.confirmation_source,
    confirmed_at: row.confirmed_at,
    lifecycle_timezone: row.lifecycle_timezone,
    awaiting_after: row.awaiting_after,
    auto_confirm_after: row.auto_confirm_after,
    arrival_transit: row.arrival_transit === null ? null : row.arrival_transit === 1,
    arrival_transit_leg_id: row.arrival_transit_leg_id,
  }
}

export interface FlightRouteRow {
  id: number
  origin: string
  destination: string
  airline_iata: string | null
  date: string
  is_upcoming: number | null
  lifecycle_state: LifecycleState
}

export function toFlightRoute(row: FlightRouteRow) {
  return {
    id: row.id,
    origin: row.origin,
    destination: row.destination,
    airline_iata: row.airline_iata,
    date: row.date,
    is_upcoming: !!row.is_upcoming,
    lifecycle_state: row.lifecycle_state,
  }
}
