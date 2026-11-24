import { findAirport } from '@kuuki/data/airport-lookup'
import { greatCircleKm } from '@kuuki/shared/geo'
import type { FactFlight, Found } from './types'

export function foundOf(flights: FactFlight[]): Found {
  const countries = new Set<string>()
  let km = 0
  let since: number | undefined
  for (const flight of flights) {
    const from = findAirport(flight.origin)
    const to = findAirport(flight.destination)
    if (from?.countryCode) countries.add(from.countryCode)
    if (to?.countryCode) countries.add(to.countryCode)
    if (from && to)
      km += greatCircleKm(
        { lat: from.latitude, lon: from.longitude },
        { lat: to.latitude, lon: to.longitude },
      )
    const year = Number(flight.date.slice(0, 4))
    if (!flight.upcoming && year && (since === undefined || year < since)) since = year
  }
  return { flights: flights.length, countries: [...countries], km: Math.round(km), since }
}
