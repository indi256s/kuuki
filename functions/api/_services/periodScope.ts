// The one definition of "what the Overview and the opened map count": completed (awaiting or logged) flights of one
// owner in one period, and the C3 countries they reach after the published transit suppressions (ADR 0001 section 4).
// The Overview summary and `GET /api/flights/route-projection` both build their statements here, so the figures and the
// map can only disagree when the published revision changed between two reads.
import { buildFlightWhere, type FlightFilters } from '../_lib/flightQuery'

/** Reference country codes are finite; reads fail rather than truncate if the imported set outgrows this. */
export const MAX_COUNTRY_CODES = 512

/** Owner-scoped completed flights for a period; `year` overrides the filter year (used for the previous-year comparison). */
export function completedScope(userId: string, filters: FlightFilters, year?: number): { where: string; binds: Array<string | number> } {
  const { where, binds } = buildFlightWhere(userId, { ...filters, ...(year === undefined ? {} : { year }) })
  return { where: `${where} AND f.lifecycle_state IN ('awaiting', 'logged')`, binds }
}

/** Endpoints keep their flight id so the published suppressions can be anti-joined (`UNSUPPRESSED`). */
export const countryEndpoints = (where: string) => `WITH selected AS (SELECT id, origin, destination FROM flights f WHERE ${where}),
    country_endpoints AS (SELECT id, 'origin' AS endpoint, origin AS iata FROM selected
      UNION ALL SELECT id, 'destination' AS endpoint, destination AS iata FROM selected)`
export const UNSUPPRESSED_WHERE = `WHERE length(a.country_code) = 2 AND NOT EXISTS (SELECT 1 FROM country_evidence_suppressions x
      WHERE x.user_id = ? AND x.flight_id = e.id AND x.endpoint = e.endpoint)`
export const UNSUPPRESSED = `JOIN airports_reference a ON a.iata = e.iata ${UNSUPPRESSED_WHERE}`

/**
 * Visits per country for the period, with the account-wide C3 status as `pending`. Unfiltered all-time reads the
 * published projection (flight and legacy countries, no claims or ground visits); every other scope reads the canonical
 * endpoints minus the published suppressions, so a suppressed transit hub never counts.
 */
export function countryVisitsStatement(db: D1Database, userId: string, scope: { where: string; binds: Array<string | number> }, projection: boolean): D1PreparedStatement {
  return projection
    ? db.prepare(`SELECT country_code AS id, logged_visit_count + awaiting_visit_count AS visits,
        CASE WHEN status = 'pending' THEN 1 ELSE 0 END AS pending FROM country_visit_evidence WHERE user_id = ?
        AND logged_visit_count + awaiting_visit_count > 0 ORDER BY id LIMIT ${MAX_COUNTRY_CODES + 1}`).bind(userId)
    : db.prepare(`${countryEndpoints(scope.where)} SELECT a.country_code AS id, COUNT(*) AS visits,
        MAX(CASE WHEN ev.status = 'pending' THEN 1 ELSE 0 END) AS pending FROM country_endpoints e
        JOIN airports_reference a ON a.iata = e.iata
        LEFT JOIN country_visit_evidence ev ON ev.user_id = ? AND ev.country_code = a.country_code
        ${UNSUPPRESSED_WHERE} GROUP BY a.country_code ORDER BY id LIMIT ${MAX_COUNTRY_CODES + 1}`).bind(...scope.binds, userId, userId)
}
