import { buildFlightWhere, type FlightFilters } from '../_lib/flightQuery'

export const MAX_COUNTRY_CODES = 512

export function completedScope(
  userId: string,
  filters: FlightFilters,
  year?: number,
): { where: string; binds: Array<string | number> } {
  const { where, binds } = buildFlightWhere(userId, {
    ...filters,
    ...(year === undefined ? {} : { year }),
  })
  return { where: `${where} AND f.lifecycle_state IN ('awaiting', 'logged')`, binds }
}

export const countryEndpoints = (
  where: string,
) => `WITH selected AS (SELECT id, origin, destination FROM flights f WHERE ${where}),
    country_endpoints AS (SELECT id, 'origin' AS endpoint, origin AS iata FROM selected
      UNION ALL SELECT id, 'destination' AS endpoint, destination AS iata FROM selected)`
export const UNSUPPRESSED_WHERE = `WHERE length(a.country_code) = 2 AND NOT EXISTS (SELECT 1 FROM country_evidence_suppressions x
      WHERE x.user_id = ? AND x.flight_id = e.id AND x.endpoint = e.endpoint)`
export const UNSUPPRESSED = `JOIN airports_reference a ON a.iata = e.iata ${UNSUPPRESSED_WHERE}`

export function countryVisitsStatement(
  db: D1Database,
  userId: string,
  scope: { where: string; binds: Array<string | number> },
  projection: boolean,
): D1PreparedStatement {
  return projection
    ? db
        .prepare(`SELECT country_code AS id, logged_visit_count + awaiting_visit_count AS visits,
        CASE WHEN status = 'pending' THEN 1 ELSE 0 END AS pending FROM country_visit_evidence WHERE user_id = ?
        AND logged_visit_count + awaiting_visit_count > 0 ORDER BY id LIMIT ${MAX_COUNTRY_CODES + 1}`)
        .bind(userId)
    : db
        .prepare(`${countryEndpoints(scope.where)} SELECT a.country_code AS id, COUNT(*) AS visits,
        MAX(CASE WHEN ev.status = 'pending' THEN 1 ELSE 0 END) AS pending FROM country_endpoints e
        JOIN airports_reference a ON a.iata = e.iata
        LEFT JOIN country_visit_evidence ev ON ev.user_id = ? AND ev.country_code = a.country_code
        ${UNSUPPRESSED_WHERE} GROUP BY a.country_code ORDER BY id LIMIT ${MAX_COUNTRY_CODES + 1}`)
        .bind(...scope.binds, userId, userId)
}
