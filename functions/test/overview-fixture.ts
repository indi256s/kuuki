// Reusable Overview fixtures (T17, accepted by T18): an account built from `FixtureFlight` rows plus the columns
// the figures read (airline, aircraft, distance, duration), and a reader that calls the route like a client would.
import { apiContext } from './harness'
import { accountWith, USER, type FixtureFlight } from './country-fixture'
import { onRequestGet as getOverview } from '../api/me/overview/data'
import { computeOverview } from '../../packages/shared/src/overview/compute'
import type { OverviewFilter, OverviewPayload } from '../../packages/shared/src/overview/model'
import { onRequestGet as getProjection } from '../api/flights/route-projection'
import type { RouteProjection } from '../../packages/shared/src/routeProjection'

export { USER, at, T0, publish } from './country-fixture'
export type { FixtureFlight } from './country-fixture'

/** Columns outside the lifecycle fixture; every one may stay unset (NULL) to model unknown data. */
export interface FlightExtras {
  airline?: string
  aircraft?: string
  km?: number
  minutes?: number
}
export type OverviewFlight = FixtureFlight & FlightExtras

/** Aircraft the fixtures name; manufacturers come from the reference table, as in production. */
const AIRCRAFT: Array<[string, string, string]> = [
  ['A320', 'Airbus A320', 'Airbus'],
  ['A359', 'Airbus A350-900', 'Airbus'],
  ['B738', 'Boeing 737-800', 'Boeing'],
]

export function overviewAccount(
  flights: OverviewFlight[],
  extra: (db: D1Database) => D1PreparedStatement[] = () => [],
) {
  return accountWith(flights, (db) => [
    ...AIRCRAFT.map(([icao, name, maker]) =>
      db
        .prepare(
          'INSERT INTO aircraft_reference (icao, name, manufacturer, model, type, engine_type, engine_count) VALUES (?,?,?,?,?,?,?)',
        )
        .bind(icao, name, maker, icao, 'jet', 'jet', 2),
    ),
    ...flights
      .filter(
        (flight) =>
          flight.airline ||
          flight.aircraft ||
          flight.km !== undefined ||
          flight.minutes !== undefined,
      )
      .map((flight) =>
        db
          .prepare(
            'UPDATE flights SET airline_iata = ?, aircraft_icao = ?, distance_km = ?, duration_minutes = ? WHERE id = ?',
          )
          .bind(
            flight.airline ?? null,
            flight.aircraft ?? null,
            flight.km ?? null,
            flight.minutes ?? null,
            flight.id,
          ),
      ),
    ...extra(db),
  ])
}

export async function readOverviewPayload(
  db: D1Database,
  user: { id: string; email: string } = USER,
): Promise<OverviewPayload> {
  const response = await getOverview({
    ...apiContext(db, new Request('https://kuuki.test/api/me/overview/data')),
    data: { user },
  } as never)
  if (response.status !== 200) throw new Error(`Overview read failed: ${response.status}`)
  return response.json() as Promise<OverviewPayload>
}

export async function readOverviewScope(
  db: D1Database,
  filter: OverviewFilter = {},
  user: { id: string; email: string } = USER,
) {
  return computeOverview(await readOverviewPayload(db, user), filter)
}

/** `count` completed flights one day apart from 2020-01-01, for volume tests (one statement, no per-row writes). */
export function bulkFlights(db: D1Database, count: number, origin = 'TBS', destination = 'JFK') {
  return db
    .prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < ?)
    INSERT INTO flights (user_id,date,origin,destination,distance_km)
    SELECT ?, date('2020-01-01', '+' || x || ' days'), ?, ?, 100 FROM n`)
    .bind(count, USER.id, origin, destination)
}

/** An account with no canonical flights and one published archived (legacy) visit: real geography, no flights. */
export function legacyOnlyAccount(country = 'AE', airport = 'DXB', visits = 2) {
  return overviewAccount([], (d) => [
    d
      .prepare(`INSERT INTO legacy_visit_evidence (source_id,user_id,airport_iata,country_code,first_visit,last_visit,visit_count,source_digest,provenance,contributes,source_json)
      VALUES ('legacy-1',?,?,?,'2019-01-01','2019-01-01',?,'d','archive',1,'{}')`)
      .bind(USER.id, airport, country, visits),
  ])
}

/** The opened map's read for the same account, called like a client would (`period=all|YYYY`). */
export async function readRouteProjection(
  db: D1Database,
  period = 'all',
  user: { id: string; email: string } = USER,
): Promise<RouteProjection> {
  const response = await getProjection({
    ...apiContext(
      db,
      new Request(`https://kuuki.test/api/flights/route-projection?period=${period}`),
    ),
    data: { user },
  } as never)
  if (response.status !== 200) throw new Error(`Route projection read failed: ${response.status}`)
  return response.json() as Promise<RouteProjection>
}
