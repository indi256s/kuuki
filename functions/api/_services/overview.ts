import type { OverviewPeriod, OverviewSummary } from '../../../packages/shared/src/overview'
import { continentOf7 } from '../_lib/continents'
import { buildFlightWhere, type FlightFilters } from '../_lib/flightQuery'
import { assertRows } from '../_lib/d1'

type CountRow = { id: string; count: number }
type TotalsRow = {
  flights: number; distance_km: number; duration_minutes: number
  airlines: number; aircraft: number
}
type PlaceRow = { airports: number; cities: number }
type StateRow = { revision: number; published_revision: number; last_error: string | null }
type NextRow = { id: number; date: string; origin: string; destination: string; airline_iata: string | null; flight_number: string | null }
type LongestRow = { origin: string; destination: string; distance_km: number }
type RouteRow = { origin: string; destination: string; count: number }

// Reference country codes are finite, but fail rather than truncate if the imported
// reference set ever grows beyond a reasonable country/territory universe.
const MAX_COUNTRY_CODES = 512

function rows<T>(results: D1Result[], index: number): T[] {
  return results[index].results as T[]
}

function first<T>(results: D1Result[], index: number): T | null {
  return rows<T>(results, index)[0] ?? null
}

/** One batch provides a consistent canonical/revision snapshot for a single owner and period. */
export async function readOverview(db: D1Database, userId: string, period: OverviewPeriod = 'all', filters: FlightFilters = {}): Promise<OverviewSummary> {
  const started = Date.now()
  const generatedAt = new Date(started).toISOString()
  const { where, binds } = buildFlightWhere(userId, { ...filters, ...(period === 'all' ? {} : { year: Number(period) }) })
  const completedWhere = `${where} AND f.lifecycle_state IN ('awaiting', 'logged')`
  const bindPeriod = (sql: string, ...extra: string[]) => db.prepare(sql).bind(...binds, ...extra)
  // Bind the filtered selection once; three 25-code filters remain under D1's
  // variable limit instead of doubling their placeholders for both endpoints.
  const endpoints = `WITH selected AS (SELECT origin, destination FROM flights f WHERE ${completedWhere}),
    endpoints AS (SELECT origin AS iata FROM selected UNION ALL SELECT destination AS iata FROM selected)`
  const monthStart = period === 'all'
    ? new Date(Date.UTC(new Date(started).getUTCFullYear(), new Date(started).getUTCMonth() - 11, 1)).toISOString().slice(0, 7)
    : `${period}-01`
  const monthEnd = period === 'all'
    ? new Date(Date.UTC(new Date(started).getUTCFullYear(), new Date(started).getUTCMonth() + 1, 1)).toISOString().slice(0, 7)
    : `${Number(period) + 1}-01`

  const statements = [
    db.prepare('SELECT revision, published_revision, last_error FROM user_derived_state WHERE user_id = ?').bind(userId),
    bindPeriod(`SELECT COUNT(*) AS flights, COALESCE(ROUND(SUM(f.distance_km)), 0) AS distance_km,
      COALESCE(SUM(f.duration_minutes), 0) AS duration_minutes,
      COUNT(DISTINCT f.airline_iata) AS airlines, COUNT(DISTINCT f.aircraft_icao) AS aircraft
      FROM flights f WHERE ${completedWhere}`),
    bindPeriod(`${endpoints} SELECT COUNT(DISTINCT e.iata) AS airports,
      COUNT(DISTINCT CASE WHEN a.city IS NOT NULL THEN a.country_code || ':' || a.city END) AS cities
      FROM endpoints e LEFT JOIN airports_reference a ON a.iata = e.iata`),
    bindPeriod(`${endpoints} SELECT DISTINCT a.country_code AS id FROM endpoints e
      JOIN airports_reference a ON a.iata = e.iata WHERE a.country_code IS NOT NULL ORDER BY id LIMIT ${MAX_COUNTRY_CODES + 1}`),
    bindPeriod(`SELECT f.origin, f.destination, f.distance_km FROM flights f WHERE ${completedWhere}
      AND f.distance_km IS NOT NULL ORDER BY f.distance_km DESC, f.id ASC LIMIT 1`),
    bindPeriod(`SELECT f.origin, f.destination, COUNT(*) AS count FROM flights f WHERE ${completedWhere}
      GROUP BY f.origin, f.destination ORDER BY count DESC, f.origin, f.destination LIMIT 1`),
    bindPeriod(`SELECT f.airline_iata AS id, COUNT(*) AS count FROM flights f WHERE ${completedWhere}
      AND f.airline_iata IS NOT NULL GROUP BY f.airline_iata ORDER BY count DESC, id LIMIT 5`),
    bindPeriod(`${endpoints} SELECT e.iata AS id, COUNT(*) AS count FROM endpoints e
      GROUP BY e.iata ORDER BY count DESC, id LIMIT 5`),
    bindPeriod(`SELECT f.aircraft_icao AS id, COUNT(*) AS count FROM flights f WHERE ${completedWhere}
      AND f.aircraft_icao IS NOT NULL GROUP BY f.aircraft_icao ORDER BY count DESC, id LIMIT 5`),
    bindPeriod(`${endpoints} SELECT a.country_code AS id, COUNT(*) AS count FROM endpoints e
      JOIN airports_reference a ON a.iata = e.iata WHERE a.country_code IS NOT NULL
      GROUP BY a.country_code ORDER BY count DESC, id LIMIT 5`),
    bindPeriod(`SELECT substr(f.date, 1, 7) AS month, COUNT(*) AS flights FROM flights f WHERE ${completedWhere}
      AND substr(f.date, 1, 7) >= ? AND substr(f.date, 1, 7) < ?
      GROUP BY month ORDER BY month`, monthStart, monthEnd),
    db.prepare(`SELECT id, date, origin, destination, airline_iata, flight_number FROM flights
      WHERE user_id = ? AND lifecycle_state = 'upcoming' ORDER BY date ASC, id ASC LIMIT 1`).bind(userId),
    db.prepare("SELECT COUNT(*) AS count FROM flights WHERE user_id = ? AND lifecycle_state = 'upcoming'").bind(userId),
  ]
  const d1Started = Date.now()
  const results = await db.batch(statements)
  const d1Ms = Date.now() - d1Started
  assertRows(results, 'Overview batch failed', statements.length)
  const state = first<StateRow>(results, 0)
  const aggregate = first<TotalsRow>(results, 1)
  const places = first<PlaceRow>(results, 2)
  const countryIds = rows<{ id: string }>(results, 3).map(row => row.id)
  if (countryIds.length > MAX_COUNTRY_CODES) throw new Error('Overview country reference limit exceeded')
  const next = first<NextRow>(results, 11)
  const monthsByKey = new Map(rows<{ month: string; flights: number }>(results, 10).map(row => [row.month, row.flights]))
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = period === 'all'
      ? new Date(Date.UTC(Number(monthStart.slice(0, 4)), Number(monthStart.slice(5, 7)) - 1 + index, 1)).toISOString().slice(0, 7)
      : `${period}-${String(index + 1).padStart(2, '0')}`
    return { month, flights: monthsByKey.get(month) ?? 0 }
  })
  const revision = state?.revision ?? 0
  const publishedRevision = state?.published_revision ?? 0
  const longest = first<LongestRow>(results, 4)
  const summary: OverviewSummary = {
    schemaVersion: 1,
    period,
    revision,
    publishedRevision,
    derivedState: revision === publishedRevision ? 'ready' : state?.last_error ? 'error' : 'pending',
    generatedAt,
    totals: {
      flights: aggregate?.flights ?? 0,
      distanceKm: aggregate?.distance_km ?? 0,
      durationMinutes: aggregate?.duration_minutes ?? 0,
      countries: countryIds.length,
      cities: places?.cities ?? 0,
      airports: places?.airports ?? 0,
      airlines: aggregate?.airlines ?? 0,
      aircraft: aggregate?.aircraft ?? 0,
      continents: new Set(countryIds.map(id => continentOf7(id))).size,
      upcomingFlights: first<{ count: number }>(results, 12)?.count ?? 0,
    },
    nextFlight: next ? { id: next.id, date: next.date, origin: next.origin, destination: next.destination,
      airlineIata: next.airline_iata, flightNumber: next.flight_number } : null,
    insights: {
      longestFlight: longest ? { origin: longest.origin, destination: longest.destination,
        distanceKm: longest.distance_km } : null,
      mostFrequentRoute: first<RouteRow>(results, 5),
    },
    topLists: {
      airlines: rows<CountRow>(results, 6), airports: rows<CountRow>(results, 7),
      aircraft: rows<CountRow>(results, 8), countries: rows<CountRow>(results, 9),
    },
    months,
    countryIds,
  }
  console.log(JSON.stringify({ event: 'overview_read', statements: statements.length,
    rows: results.reduce((total, result) => total + (result.results?.length ?? 0), 0),
    d1Ms, durationMs: Date.now() - started, revisionLag: revision - publishedRevision }))
  return summary
}
