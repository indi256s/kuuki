import type { Airport } from '@kuuki/shared/types'
import airportData from './airports.json' with { type: 'json' }

const airports = airportData as Airport[]
let byIata: Map<string, Airport> | undefined

/** Import this subpath only in workflows that need the full offline corpus. */
export function findAirport(iata: string): Airport | undefined {
  byIata ??= new Map(airports.map((airport) => [airport.iata.toUpperCase(), airport]))
  return byIata.get(iata.toUpperCase())
}
