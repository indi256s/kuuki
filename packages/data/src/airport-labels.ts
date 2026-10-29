import { airportLabels, type AirportLabel } from './airport-labels.generated'

export { airportLabels, type AirportLabel }

let byIata: Map<string, AirportLabel> | undefined

export function findAirportLabel(iata: string): AirportLabel | undefined {
  byIata ??= new Map(airportLabels.map((airport) => [airport.iata.toUpperCase(), airport]))
  return byIata.get(iata.toUpperCase())
}
