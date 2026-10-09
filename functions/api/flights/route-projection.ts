// Private, compact route projection for the opened map (C6). It shares the Overview's completed-period predicate, its
// country policy (published transit suppressions) and its publication stamps, so the map and the summary agree or
// visibly differ by revision. Geometry comes from D1's authoritative airport reference and is bounded.
import { runHandler, json, HttpError } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { assertRows } from '../_lib/d1'
import { isDerivedReady } from '../_services/derivedState'
import { MAX_COUNTRY_CODES, completedScope, countryVisitsStatement } from '../_services/periodScope'
import type {
  ProjectedPair,
  ProjectedRoute,
  RouteProjection,
} from '../../../packages/shared/src/routeProjection'

/** Per list. 5,000 distinct pairs is the largest payload the opened map is measured at (docs/research local performance). */
export const MAX_PROJECTED_ROUTES = 5000

type Geometry = {
  a_lat: number | null
  a_lng: number | null
  b_lat: number | null
  b_lng: number | null
  a_country: string | null
  b_country: string | null
}
type RouteRow = Geometry & { origin: string; destination: string; count: number; last_date: string }
type PairRow = Geometry & {
  a: string
  b: string
  count: number
  forward: number
  last_date: string
}
type StateRow = {
  revision: number
  published_revision: number
  evidence_revision: number
  last_error: string | null
}
type CountryRow = { id: string; visits: number; pending: number }

/** Coordinates and countries of the two ends (`l` joins the first, `r` the second airport) from the airport reference. */
const GEOMETRY = `
      l.latitude AS a_lat, l.longitude AS a_lng, l.country_code AS a_country,
      r.latitude AS b_lat, r.longitude AS b_lng, r.country_code AS b_country`
const point = (lng: number | null, lat: number | null): [number, number] | null =>
  lng === null || lat === null ? null : [lng, lat]

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const user = requireUser(context.data)
    const period = new URL(context.request.url).searchParams.get('period') ?? 'all'
    if (period !== 'all' && !/^(19|20|21)\d{2}$/.test(period))
      throw new HttpError(400, 'Invalid period', 'INVALID_PERIOD')
    const db = context.env.DB
    const scope = completedScope(user.id, {}, period === 'all' ? undefined : Number(period))
    const selected = `WITH selected AS (SELECT origin, destination, date FROM flights f WHERE ${scope.where})`
    const statements = [
      db
        .prepare(
          'SELECT revision, published_revision, evidence_revision, last_error FROM user_derived_state WHERE user_id = ?',
        )
        .bind(user.id),
      db
        .prepare(`${selected}
      SELECT s.origin, s.destination, s.count, s.last_date,${GEOMETRY} FROM (
        SELECT origin, destination, COUNT(*) AS count, MAX(date) AS last_date FROM selected GROUP BY origin, destination) s
      LEFT JOIN airports_reference l ON l.iata = s.origin LEFT JOIN airports_reference r ON r.iata = s.destination
      ORDER BY s.last_date DESC, s.origin, s.destination LIMIT ${MAX_PROJECTED_ROUTES + 1}`)
        .bind(...scope.binds),
      db
        .prepare(`${selected}
      SELECT s.a, s.b, s.count, s.forward, s.last_date,${GEOMETRY} FROM (
        SELECT min(origin, destination) AS a, max(origin, destination) AS b, COUNT(*) AS count,
          SUM(CASE WHEN origin = min(origin, destination) THEN 1 ELSE 0 END) AS forward, MAX(date) AS last_date
        FROM selected GROUP BY min(origin, destination), max(origin, destination)) s
      LEFT JOIN airports_reference l ON l.iata = s.a LEFT JOIN airports_reference r ON r.iata = s.b
      ORDER BY s.last_date DESC, s.a, s.b LIMIT ${MAX_PROJECTED_ROUTES + 1}`)
        .bind(...scope.binds),
      db
        .prepare(
          `${selected} SELECT COUNT(*) AS routes FROM (SELECT 1 FROM selected GROUP BY min(origin, destination), max(origin, destination))`,
        )
        .bind(...scope.binds),
      countryVisitsStatement(db, user.id, scope, period === 'all'),
    ]
    const results = await db.batch(statements)
    assertRows(results, 'Route projection query failed', statements.length)
    const state = results[0].results[0] as StateRow | undefined
    const revision = state?.revision ?? 0
    const publishedRevision = state?.published_revision ?? 0
    const ready = isDerivedReady({
      revision,
      published_revision: publishedRevision,
      evidence_revision: state?.evidence_revision ?? publishedRevision,
    })
    const directed = results[1].results as RouteRow[]
    const undirected = results[2].results as PairRow[]
    const routeCount = (results[3].results[0] as { routes: number } | undefined)?.routes ?? 0
    const countryRows = results[4].results as CountryRow[]
    if (countryRows.length > MAX_COUNTRY_CODES)
      throw new Error('Route projection country reference limit exceeded')

    const routes: ProjectedRoute[] = directed.slice(0, MAX_PROJECTED_ROUTES).map((row) => ({
      origin: row.origin,
      destination: row.destination,
      count: row.count,
      lastDate: row.last_date,
      originCountry: row.a_country,
      destinationCountry: row.b_country,
      from: point(row.a_lng, row.a_lat),
      to: point(row.b_lng, row.b_lat),
    }))
    const pairs: ProjectedPair[] = undirected.slice(0, MAX_PROJECTED_ROUTES).map((row) => ({
      a: row.a,
      b: row.b,
      aCountry: row.a_country,
      bCountry: row.b_country,
      count: row.count,
      forward: row.forward,
      reverse: row.count - row.forward,
      lastDate: row.last_date,
      from: point(row.a_lng, row.a_lat),
      to: point(row.b_lng, row.b_lat),
    }))
    const body: RouteProjection = {
      schemaVersion: 1,
      period,
      ownerId: user.id,
      revision,
      publishedRevision,
      derivedState: ready ? 'ready' : state?.last_error ? 'error' : 'pending',
      countryState: ready ? 'ready' : 'updating',
      routeCount,
      limit: MAX_PROJECTED_ROUTES,
      truncated: directed.length > MAX_PROJECTED_ROUTES || routeCount > MAX_PROJECTED_ROUTES,
      routes,
      pairs,
      countries: ready
        ? countryRows.map((row) => ({ id: row.id, visits: row.visits, pending: row.pending === 1 }))
        : null,
    }
    return json(body)
  })
