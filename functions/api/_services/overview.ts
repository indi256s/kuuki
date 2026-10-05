import type { OverviewMapCountry, OverviewPeriod, OverviewSummary } from '../../../packages/shared/src/overview'
import { REGION_POLICY, regionCount, regionProgress } from '../_lib/regions'
import { favoriteAirline, newCountriesIn, overviewComparison, type FirstVisitRow, type PeriodTotals } from './overviewShape'
import { isDerivedReady } from './derivedState'
import type { FlightFilters } from '../_lib/flightQuery'
import { MAX_COUNTRY_CODES, UNSUPPRESSED, completedScope, countryEndpoints, countryVisitsStatement } from './periodScope'
import { assertRows } from '../_lib/d1'

type CountRow = { id: string; count: number }
type TotalsRow = {
  flights: number; distance_km: number; duration_minutes: number
  airlines: number; aircraft: number
  duration_known: number; distance_known: number; missing_aircraft: number
}
type CountryRow = { id: string; visits: number; pending: number }
type PlaceRow = { airports: number; cities: number }
type StateRow = { revision: number; published_revision: number; evidence_revision: number; last_error: string | null }
type NextRow = { id: number; date: string; origin: string; destination: string; airline_iata: string | null; flight_number: string | null }
type LongestRow = { origin: string; destination: string; distance_km: number }
type RouteRow = { origin: string; destination: string; count: number }

/** One batch provides a consistent canonical/revision snapshot for a single owner and period. */
export async function readOverview(db: D1Database, userId: string, period: OverviewPeriod = 'all', filters: FlightFilters = {}): Promise<OverviewSummary> {
  const started = Date.now()
  const generatedAt = new Date(started).toISOString()
  const completed = (year?: number) => completedScope(userId, filters, year)
  const current = completed(period === 'all' ? undefined : Number(period))
  const completedWhere = current.where
  const bindPeriod = (sql: string, ...extra: Array<string | number>) => db.prepare(sql).bind(...current.binds, ...extra)
  // Bind the filtered selection once; three 25-code filters remain under D1's
  // variable limit instead of doubling their placeholders for both endpoints.
  const endpoints = `WITH selected AS (SELECT origin, destination FROM flights f WHERE ${completedWhere}),
    endpoints AS (SELECT origin AS iata FROM selected UNION ALL SELECT destination AS iata FROM selected)`
  // Unfiltered all-time reads the published projection (flight and legacy countries, no claims or ground visits).
  const projection = period === 'all' && Object.keys(filters).length === 0
  const monthStart = period === 'all'
    ? new Date(Date.UTC(new Date(started).getUTCFullYear(), new Date(started).getUTCMonth() - 11, 1)).toISOString().slice(0, 7)
    : `${period}-01`
  const monthEnd = period === 'all'
    ? new Date(Date.UTC(new Date(started).getUTCFullYear(), new Date(started).getUTCMonth() + 1, 1)).toISOString().slice(0, 7)
    : `${Number(period) + 1}-01`

  // Each read is registered under a key, so adding a read never renumbers the others.
  const reads = new Map<string, D1PreparedStatement>()
  const add = (key: string, statement: D1PreparedStatement) => { reads.set(key, statement) }
  add('state', db.prepare('SELECT revision, published_revision, evidence_revision, last_error FROM user_derived_state WHERE user_id = ?').bind(userId))
  add('totals', bindPeriod(`SELECT COUNT(*) AS flights, COALESCE(ROUND(SUM(f.distance_km)), 0) AS distance_km,
      COALESCE(SUM(f.duration_minutes), 0) AS duration_minutes,
      COUNT(DISTINCT f.airline_iata) AS airlines, COUNT(DISTINCT f.aircraft_icao) AS aircraft,
      COUNT(f.duration_minutes) AS duration_known, COUNT(f.distance_km) AS distance_known,
      COUNT(CASE WHEN f.aircraft_icao IS NULL THEN 1 END) AS missing_aircraft
      FROM flights f WHERE ${completedWhere}`))
  add('places', bindPeriod(`${endpoints} SELECT COUNT(DISTINCT e.iata) AS airports,
      COUNT(DISTINCT CASE WHEN a.city IS NOT NULL THEN a.country_code || ':' || a.city END) AS cities
      FROM endpoints e LEFT JOIN airports_reference a ON a.iata = e.iata`))
  // Visit counts per country feed the mini map buckets; `pending` is the country's published status (awaiting-only).
  add('countries', countryVisitsStatement(db, userId, current, projection))
  add('longest', bindPeriod(`SELECT f.origin, f.destination, f.distance_km FROM flights f WHERE ${completedWhere}
      AND f.distance_km IS NOT NULL ORDER BY f.distance_km DESC, f.id ASC LIMIT 1`))
  add('frequent', bindPeriod(`SELECT f.origin, f.destination, COUNT(*) AS count FROM flights f WHERE ${completedWhere}
      GROUP BY f.origin, f.destination ORDER BY count DESC, f.origin, f.destination LIMIT 1`))
  add('airlines', bindPeriod(`SELECT f.airline_iata AS id, COUNT(*) AS count FROM flights f WHERE ${completedWhere}
      AND f.airline_iata IS NOT NULL GROUP BY f.airline_iata ORDER BY count DESC, id LIMIT 5`))
  add('airports', bindPeriod(`${endpoints} SELECT e.iata AS id, COUNT(*) AS count FROM endpoints e
      GROUP BY e.iata ORDER BY count DESC, id LIMIT 5`))
  add('aircraft', bindPeriod(`SELECT f.aircraft_icao AS id, COUNT(*) AS count FROM flights f WHERE ${completedWhere}
      AND f.aircraft_icao IS NOT NULL GROUP BY f.aircraft_icao ORDER BY count DESC, id LIMIT 5`))
  add('manufacturers', bindPeriod(`WITH selected AS (SELECT aircraft_icao FROM flights f WHERE ${completedWhere} AND f.aircraft_icao IS NOT NULL)
      SELECT ar.manufacturer AS id, COUNT(*) AS count FROM selected s JOIN aircraft_reference ar ON ar.icao = s.aircraft_icao
      WHERE ar.manufacturer <> '' GROUP BY ar.manufacturer ORDER BY count DESC, id LIMIT 5`))
  add('topCountries', bindPeriod(`${countryEndpoints(completedWhere)} SELECT a.country_code AS id, COUNT(*) AS count FROM country_endpoints e ${UNSUPPRESSED}
      GROUP BY a.country_code ORDER BY count DESC, id LIMIT 5`, userId))
  add('months', bindPeriod(`SELECT substr(f.date, 1, 7) AS month, COUNT(*) AS flights FROM flights f WHERE ${completedWhere}
      AND substr(f.date, 1, 7) >= ? AND substr(f.date, 1, 7) < ?
      GROUP BY month ORDER BY month`, monthStart, monthEnd))
  add('routes', bindPeriod(`SELECT COUNT(*) AS routes FROM (SELECT DISTINCT min(f.origin, f.destination) AS a, max(f.origin, f.destination) AS b
      FROM flights f WHERE ${completedWhere})`))
  add('years', db.prepare(`SELECT DISTINCT substr(date, 1, 4) AS year FROM flights WHERE user_id = ?
      AND lifecycle_state IN ('awaiting', 'logged') ORDER BY year DESC LIMIT 200`).bind(userId))
  add('next', db.prepare(`SELECT id, date, origin, destination, airline_iata, flight_number FROM flights
      WHERE user_id = ? AND lifecycle_state = 'upcoming' ORDER BY date ASC, id ASC LIMIT 1`).bind(userId))
  add('upcoming', db.prepare("SELECT COUNT(*) AS count FROM flights WHERE user_id = ? AND lifecycle_state = 'upcoming'").bind(userId))
  // Provenance of the unfiltered all-time country figure: only that read includes archived evidence (the projection), so
  // no other scope pays for the check. The user-prefix index serves it; the predicate is the contribution policy of
  // `legacyEvidenceStatement` (contributing rows with an airport).
  if (projection) {
    add('archived', db.prepare(`SELECT EXISTS (SELECT 1 FROM legacy_visit_evidence WHERE user_id = ? AND contributes = 1
      AND airport_iata IS NOT NULL AND visit_count > 0) AS archived`).bind(userId))
  }
  if (period !== 'all') {
    // Earliest non-transit evidence across all time, from the published projection: the year only selects first visits.
    add('firstVisits', db.prepare(`SELECT country_code AS id, first_visit, status FROM country_visit_evidence WHERE user_id = ?
      AND logged_visit_count + awaiting_visit_count > 0 AND first_visit >= ? AND first_visit <= ?
      ORDER BY first_visit, id LIMIT ${MAX_COUNTRY_CODES + 1}`).bind(userId, `${period}-01-01`, `${period}-12-31`))
    const previous = completed(Number(period) - 1)
    add('previousTotals', db.prepare(`SELECT COUNT(*) AS flights, COALESCE(ROUND(SUM(f.distance_km)), 0) AS distance_km,
      COALESCE(SUM(f.duration_minutes), 0) AS duration_minutes FROM flights f WHERE ${previous.where}`).bind(...previous.binds))
    add('previousCountries', db.prepare(`${countryEndpoints(previous.where)} SELECT COUNT(DISTINCT a.country_code) AS countries
      FROM country_endpoints e ${UNSUPPRESSED}`).bind(...previous.binds, userId))
    add('earlier', db.prepare(`SELECT EXISTS (SELECT 1 FROM flights WHERE user_id = ? AND lifecycle_state IN ('awaiting', 'logged')
      AND date < ?) AS earlier`).bind(userId, `${period}-01-01`))
  }
  const keys = [...reads.keys()]
  const statements = [...reads.values()]
  const d1Started = Date.now()
  const results = await db.batch(statements)
  const d1Ms = Date.now() - d1Started
  assertRows(results, 'Overview batch failed', statements.length)
  const at = (key: string): D1Result => results[keys.indexOf(key)]
  const rowsAt = <T>(key: string): T[] => at(key).results as T[]
  const firstAt = <T>(key: string): T | null => rowsAt<T>(key)[0] ?? null

  const state = firstAt<StateRow>('state')
  const aggregate = firstAt<TotalsRow>('totals')
  const places = firstAt<PlaceRow>('places')
  const revision = state?.revision ?? 0
  const publishedRevision = state?.published_revision ?? 0
  // Published and current (ADR 0001 §10): revision and the evidence stamp both equal the published revision.
  const ready = isDerivedReady({ revision, published_revision: publishedRevision, evidence_revision: state?.evidence_revision ?? publishedRevision })
  const countryRows = ready ? rowsAt<CountryRow>('countries') : []
  if (countryRows.length > MAX_COUNTRY_CODES) throw new Error('Overview country reference limit exceeded')
  const mapCountries: OverviewMapCountry[] = countryRows.map(row => ({ id: row.id, visits: row.visits, pending: row.pending === 1 }))
  const countryIds = mapCountries.map(country => country.id)
  const pendingIds = mapCountries.filter(country => country.pending).map(country => country.id)
  const next = firstAt<NextRow>('next')
  const monthsByKey = new Map(rowsAt<{ month: string; flights: number }>('months').map(row => [row.month, row.flights]))
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = period === 'all'
      ? new Date(Date.UTC(Number(monthStart.slice(0, 4)), Number(monthStart.slice(5, 7)) - 1 + index, 1)).toISOString().slice(0, 7)
      : `${period}-${String(index + 1).padStart(2, '0')}`
    return { month, flights: monthsByKey.get(month) ?? 0 }
  })
  const longest = firstAt<LongestRow>('longest')
  const airlines = rowsAt<CountRow>('airlines')
  const totals = {
    flights: aggregate?.flights ?? 0,
    distanceKm: aggregate?.distance_km ?? 0,
    durationMinutes: aggregate?.duration_minutes ?? 0,
    countries: ready ? countryIds.length : null,
  }
  let comparison: OverviewSummary['comparison'] = null
  if (period !== 'all') {
    const before = firstAt<{ flights: number; distance_km: number; duration_minutes: number }>('previousTotals')
    const previous: PeriodTotals = {
      flights: before?.flights ?? 0, distanceKm: before?.distance_km ?? 0, durationMinutes: before?.duration_minutes ?? 0,
      countries: ready ? firstAt<{ countries: number }>('previousCountries')?.countries ?? 0 : null,
    }
    comparison = overviewComparison(period, totals, previous, firstAt<{ earlier: number }>('earlier')?.earlier === 1)
  }
  const summary: OverviewSummary = {
    schemaVersion: 1,
    period,
    revision,
    publishedRevision,
    derivedState: ready ? 'ready' : state?.last_error ? 'error' : 'pending',
    countryState: ready ? 'ready' : 'updating',
    archivedEvidence: keys.includes('archived') && firstAt<{ archived: number }>('archived')?.archived === 1,
    regionPolicyVersion: REGION_POLICY.version,
    generatedAt,
    totals: {
      ...totals,
      cities: places?.cities ?? 0,
      airports: places?.airports ?? 0,
      airlines: aggregate?.airlines ?? 0,
      aircraft: aggregate?.aircraft ?? 0,
      // Six-region catalog collection model (`regionPolicyVersion`), not the numeric continentOf7 of badges.
      continents: ready ? regionCount(countryIds) : null,
      pendingCountries: ready ? pendingIds.length : null,
      upcomingFlights: firstAt<{ count: number }>('upcoming')?.count ?? 0,
    },
    comparison,
    dataAvailability: {
      flights: totals.flights,
      durationKnown: aggregate?.duration_known ?? 0,
      distanceKnown: aggregate?.distance_known ?? 0,
      missingAircraft: aggregate?.missing_aircraft ?? 0,
    },
    map: { countries: mapCountries, routeCount: firstAt<{ routes: number }>('routes')?.routes ?? 0 },
    nextFlight: next ? { id: next.id, date: next.date, origin: next.origin, destination: next.destination,
      airlineIata: next.airline_iata, flightNumber: next.flight_number } : null,
    insights: {
      longestFlight: longest ? { origin: longest.origin, destination: longest.destination,
        distanceKm: longest.distance_km } : null,
      mostFrequentRoute: firstAt<RouteRow>('frequent'),
      favoriteAirline: favoriteAirline(airlines),
      newCountries: ready && period !== 'all' ? newCountriesIn(period, rowsAt<FirstVisitRow>('firstVisits'), mapCountries) : null,
    },
    topLists: {
      airlines, airports: rowsAt<CountRow>('airports'),
      aircraft: rowsAt<CountRow>('aircraft'), countries: ready ? rowsAt<CountRow>('topCountries') : [],
      manufacturers: rowsAt<CountRow>('manufacturers'),
    },
    years: rowsAt<{ year: string }>('years').map(row => Number(row.year)).filter(year => Number.isInteger(year) && year > 0),
    regions: ready ? regionProgress(countryIds.filter(id => !pendingIds.includes(id)), pendingIds) : null,
    months,
    countryIds,
  }
  console.log(JSON.stringify({ event: 'overview_read', statements: statements.length,
    rows: results.reduce((total, result) => total + (result.results?.length ?? 0), 0),
    d1Ms, durationMs: Date.now() - started, revisionLag: revision - publishedRevision }))
  return summary
}
