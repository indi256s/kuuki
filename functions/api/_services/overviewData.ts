import { familyOf } from '../../../packages/data/src/aircraft-lookup'
import { aggregateRows } from '../../../packages/shared/src/overview/aggregate'
import { AGGREGATE_THRESHOLD, type OverviewPayload, type OverviewRow } from '../../../packages/shared/src/overview/model'
import { assertRows } from '../_lib/d1'
import type { FlightRow } from '../_lib/flights'
import { COUNTRY_REGION } from '../_lib/countryRegions.generated'
import { passportRead } from './passport'

export const overviewEtag = (userId: string, state: { revision: number; evidence_revision: number }): string =>
  `W/"ov2-${encodeURIComponent(userId)}-${state.revision}-${state.evidence_revision}"`

type AirportRow = { iata: string; latitude: number | null; longitude: number | null; country_code: string | null; city: string | null; name: string }
type AircraftRow = { icao: string; manufacturer: string | null; type: string | null; model: string | null; name: string | null }

function departureMinute(time: string | null): number | null {
  if (!time || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

export async function readOverviewData(db: D1Database, userId: string): Promise<OverviewPayload> {
  const passport = passportRead(db, userId)
  const statements = [
    db.prepare(`SELECT id, date, origin, destination, lifecycle_state, airline_iata, aircraft_icao,
      flight_number, departure_time, distance_km, duration_minutes, zones_overflown,
      duration_source, origin_tz, dest_tz, departure_utc FROM flights WHERE user_id = ? ORDER BY date, id`).bind(userId),
    db.prepare('SELECT flight_id, endpoint FROM country_evidence_suppressions WHERE user_id = ?').bind(userId),
    db.prepare(`SELECT iata, latitude, longitude, country_code, city, name FROM airports_reference
      WHERE iata IN (SELECT origin FROM flights WHERE user_id = ? UNION SELECT destination FROM flights WHERE user_id = ?
        UNION SELECT home_airport FROM profiles WHERE id = ?)
      ORDER BY iata`).bind(userId, userId, userId),
    db.prepare(`SELECT icao, manufacturer, type, model, name FROM aircraft_reference
      WHERE icao IN (SELECT aircraft_icao FROM flights WHERE user_id = ?) ORDER BY icao`).bind(userId),
    db.prepare('SELECT home_airport FROM profiles WHERE id = ?').bind(userId),
    ...passport.statements,
  ]
  const results = await db.batch(statements)
  assertRows(results, 'Overview data read failed', statements.length)
  const { state, data } = passport.derive(results.slice(5))
  const bits = new Map<number, number>()
  for (const suppression of results[1].results as { flight_id: number; endpoint: 'origin' | 'destination' }[]) {
    bits.set(suppression.flight_id, (bits.get(suppression.flight_id) ?? 0) | (suppression.endpoint === 'origin' ? 1 : 2))
  }
  const rows: OverviewRow[] = (results[0].results as FlightRow[]).map(row => ({
    id: row.id, weight: 1, date: row.date, state: row.lifecycle_state,
    origin: row.origin, destination: row.destination, airline: row.airline_iata, aircraft: row.aircraft_icao,
    flightNumber: row.flight_number, depMinute: departureMinute(row.departure_time),
    distanceKm: row.distance_km, durationMinutes: row.duration_minutes, zonesOverflown: row.zones_overflown,
    durationSource: row.duration_source, originTz: row.origin_tz, destTz: row.dest_tz, departureUtc: row.departure_utc,
    suppressed: (bits.get(row.id) ?? 0) as OverviewRow['suppressed'],
  }))
  const airports = new Map((results[2].results as AirportRow[]).map(row => [row.iata, row]))
  const aircraft = new Map((results[3].results as AircraftRow[]).map(row => [row.icao, row]))
  const homeOverride = (results[4].results[0] as { home_airport: string | null } | undefined)?.home_airport ?? null
  const refs: OverviewPayload['refs'] = { airports: {}, aircraft: {}, regions: {} }
  const airportCodes = new Set(rows.flatMap(row => [row.origin, row.destination]))
  if (homeOverride && airports.has(homeOverride)) airportCodes.add(homeOverride)
  for (const code of [...airportCodes].sort()) {
    const ref = airports.get(code)
    refs.airports[code] = { lat: ref?.latitude ?? null, lon: ref?.longitude ?? null,
      country: ref?.country_code || null, city: ref?.city ?? null, name: ref?.name ?? code }
    const region = ref?.country_code ? COUNTRY_REGION[ref.country_code] : null
    if (region) refs.regions[ref!.country_code!] = region
  }
  for (const code of [...new Set(rows.map(row => row.aircraft).filter((code): code is string => code !== null))].sort()) {
    const ref = aircraft.get(code)
    refs.aircraft[code] = { manufacturer: ref?.manufacturer ?? null, type: ref?.type ?? null,
      family: familyOf(code, ref), name: ref?.name ?? null }
  }
  const mode = rows.length > AGGREGATE_THRESHOLD ? 'aggregate' : 'flights'
  return {
    schemaVersion: 2, etag: overviewEtag(userId, state ?? { revision: 0, evidence_revision: 0 }),
    generatedAt: new Date().toISOString(), mode, derivedReady: data.derivedState === 'ready',
    passport: { countries: data.pressedCountryCount, regions: data.regions.filter(region => region.pressed > 0).length },
    homeOverride,
    rows: mode === 'aggregate' ? aggregateRows(rows) : rows, refs,
  }
}
