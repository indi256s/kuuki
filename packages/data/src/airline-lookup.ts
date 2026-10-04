import type { Airline } from '@kuuki/shared/types'
import airlineData from './airlines.json' with { type: 'json' }

const airlines = airlineData as Airline[]
let byIata: Map<string, Airline> | undefined

export function findAirline(iata: string): Airline | undefined {
  byIata ??= new Map(airlines.map(item => [item.iata.toUpperCase(), item]))
  return byIata.get(iata.toUpperCase())
}
