import { coordinates, type LatLon } from '../geo'
import { routeKey, rowCountries } from './filter'
import type { OverviewPayload, OverviewRow } from './model'
import { rankings } from './rankings'

export interface GlobeData {
  routes: Array<{ key: string; a: string; b: string; count: number }>
  ghostRoutes: string[]
  airports: Array<{ iata: string; count: number }>
  countries: Array<{ code: string; visits: number }>
  ghostCountries: string[]
  ghosts: Array<{ id: number; origin: string; destination: string; date: string }>
  centroid: LatLon | null
}

function centroid(airports: GlobeData['airports'], refs: OverviewPayload['refs']): LatLon | null {
  const rad = Math.PI / 180
  let x = 0, y = 0, z = 0, located = 0
  for (const airport of airports) {
    const point = coordinates(refs.airports[airport.iata])
    if (!point) continue
    const lat = point.lat * rad, lon = point.lon * rad
    x += Math.cos(lat) * Math.cos(lon) * airport.count
    y += Math.cos(lat) * Math.sin(lon) * airport.count
    z += Math.sin(lat) * airport.count
    located += airport.count
  }
  if (!located) return null
  x /= located; y /= located; z /= located
  if (Math.hypot(x, y, z) < 1e-9) return null
  return { lat: Math.atan2(z, Math.hypot(x, y)) / rad, lon: Math.atan2(y, x) / rad }
}

export function globe(allRows: OverviewRow[], scopeRows: OverviewRow[], refs: OverviewPayload['refs']): GlobeData {
  const ranked = rankings(scopeRows)
  const routes = ranked.routes.map(({ key, count }) => ({ key, a: key.split('-')[0], b: key.split('-')[1], count }))
  const routeKeys = new Set(routes.map(route => route.key))
  const countries = new Map<string, number>()
  for (const row of scopeRows) for (const country of rowCountries(row, refs)) countries.set(country, (countries.get(country) ?? 0) + row.weight)
  const counted = allRows.filter(row => row.state === 'logged' || row.state === 'awaiting')
  const airports = ranked.airports.map(({ key, count }) => ({ iata: key, count }))
  return {
    routes, airports,
    ghostRoutes: [...new Set(counted.map(row => routeKey(row.origin, row.destination)))].filter(key => !routeKeys.has(key)).sort(),
    countries: [...countries].map(([code, visits]) => ({ code, visits }))
      .sort((a, b) => b.visits - a.visits || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)),
    ghostCountries: [...new Set(counted.flatMap(row => rowCountries(row, refs)))].filter(code => !countries.has(code)).sort(),
    ghosts: allRows.filter(row => row.state === 'upcoming').map(({ id, origin, destination, date }) => ({ id, origin, destination, date }))
      .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id),
    centroid: centroid(airports, refs),
  }
}
