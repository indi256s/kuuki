import airlines from '@kuuki/data/airlines'
import { findAirport } from '@kuuki/data/airport-lookup'

let byIata: Map<string, string> | undefined
export function airlineName(iata: string): string | undefined {
  byIata ??= new Map(airlines.filter(row => row.iata).map(row => [row.iata.toUpperCase(), row.name]))
  return byIata.get(iata.toUpperCase())
}
export const cityOf = (iata: string): string => findAirport(iata)?.city ?? iata
