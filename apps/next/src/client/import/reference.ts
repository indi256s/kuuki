import airlines from '@kuuki/data/airlines' with { type: 'json' }
import { findAirportLabel } from '@kuuki/data/airport-labels'

let byIata: Map<string, string> | undefined
export function airlineName(iata: string): string | undefined {
  byIata ??= new Map(
    airlines.filter((row) => row.iata).map((row) => [row.iata.toUpperCase(), row.name]),
  )
  return byIata.get(iata.toUpperCase())
}
export const cityOf = (iata: string): string => findAirportLabel(iata)?.city ?? iata
