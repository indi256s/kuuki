import { coordinates, type LatLon } from '../geo'
import { routeKey, rowCountries, scopedGround } from './filter'
import type { OverviewFilter, OverviewPayload, OverviewRow, TravelScope } from './model'
import { rankings } from './rankings'

export interface GlobeData {
  routes: Array<{ key: string; a: string; b: string; count: number }>
  ghostRoutes: string[]
  airports: Array<{ iata: string; count: number }>
  countries: Array<{ code: string; visits: number }>
  ghostCountries: string[]
  ghosts: Array<{ id: number; origin: string; destination: string; date: string }>
  ground: Array<{
    id: string
    mode: 'rail' | 'road'
    planned: boolean
    runs: Array<Array<[number, number]>>
  }>
  centroid: LatLon | null
}

function centroid(points: Iterable<{ point: LatLon | null; weight: number }>): LatLon | null {
  const rad = Math.PI / 180
  let x = 0,
    y = 0,
    z = 0,
    located = 0
  for (const { point, weight } of points) {
    if (!point) continue
    const lat = point.lat * rad,
      lon = point.lon * rad
    x += Math.cos(lat) * Math.cos(lon) * weight
    y += Math.cos(lat) * Math.sin(lon) * weight
    z += Math.sin(lat) * weight
    located += weight
  }
  if (!located) return null
  x /= located
  y /= located
  z /= located
  if (Math.hypot(x, y, z) < 1e-9) return null
  return { lat: Math.atan2(z, Math.hypot(x, y)) / rad, lon: Math.atan2(y, x) / rad }
}

export function globe(
  allRows: OverviewRow[],
  scopeRows: OverviewRow[],
  payload: Pick<OverviewPayload, 'ground' | 'refs'>,
  filter: OverviewFilter,
  scope: 'all' | TravelScope,
): GlobeData {
  const refs = payload.refs
  const flightsOnly = scope !== 'ground'
  const ranked = rankings(flightsOnly ? scopeRows : [])
  const routes = ranked.routes.map(({ key, count }) => ({
    key,
    a: key.split('-')[0],
    b: key.split('-')[1],
    count,
  }))
  const routeKeys = new Set(routes.map((route) => route.key))
  const matching = scopedGround(payload, filter, scope)
  const completed = matching.filter((journey) => journey.status === 'completed')
  const countries = new Map<string, number>()
  if (flightsOnly)
    for (const row of scopeRows)
      for (const country of rowCountries(row, refs))
        countries.set(country, (countries.get(country) ?? 0) + row.weight)
  for (const journey of completed)
    for (const country of journey.countries)
      countries.set(country, (countries.get(country) ?? 0) + 1)
  const counted = allRows.filter((row) => row.state === 'logged' || row.state === 'awaiting')
  const airports = ranked.airports.map(({ key, count }) => ({ iata: key, count }))
  const ghostCandidates = new Set([
    ...(flightsOnly ? counted.flatMap((row) => rowCountries(row, refs)) : []),
    ...(scope === 'flights'
      ? []
      : payload.ground
          .filter((journey) => journey.status === 'completed')
          .flatMap((journey) => journey.countries)),
  ])
  return {
    routes,
    airports,
    ghostRoutes: flightsOnly
      ? [...new Set(counted.map((row) => routeKey(row.origin, row.destination)))]
          .filter((key) => !routeKeys.has(key))
          .sort()
      : [],
    countries: [...countries]
      .map(([code, visits]) => ({ code, visits }))
      .sort((a, b) => b.visits - a.visits || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)),
    ghostCountries: [...ghostCandidates].filter((code) => !countries.has(code)).sort(),
    ghosts: flightsOnly
      ? allRows
          .filter((row) => row.state === 'upcoming')
          .map(({ id, origin, destination, date }) => ({ id, origin, destination, date }))
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id))
      : [],
    ground: matching.map((journey) => ({
      id: journey.id,
      mode: journey.mode,
      planned: journey.status === 'planned',
      runs: journey.runs,
    })),
    centroid:
      scope === 'ground'
        ? centroid(
            matching.flatMap((journey) =>
              journey.runs.flatMap((run) =>
                run.map(([lon, lat]) => ({ point: { lat, lon }, weight: 1 })),
              ),
            ),
          )
        : centroid(
            airports.map((airport) => ({
              point: coordinates(refs.airports[airport.iata]),
              weight: airport.count,
            })),
          ),
  }
}
