import type { Airport } from '@kuuki/shared/types'
import { airportLabels } from './airport-labels.generated'
import { airportDetails } from './airport-details.generated'

let byIata: Map<string, Airport> | undefined

/** Import this subpath only in workflows that need the full offline corpus. */
export function findAirport(iata: string): Airport | undefined {
  byIata ??= new Map(
    airportLabels.map((label, index) => [
      label.iata.toUpperCase(),
      { ...label, ...airportDetails[index]! },
    ]),
  )
  return byIata.get(iata.toUpperCase())
}
