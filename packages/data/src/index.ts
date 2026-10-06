export { findAircraft } from './aircraft-lookup'
export { findAirport } from './airport-lookup'
// Re-export data files
import type { Aircraft, Airport, Airline } from '@kuuki/shared/types'
import aircraftData from './aircraft.json' with { type: 'json' }
import airportsData from './airports.json' with { type: 'json' }
import airlinesData from './airlines.json' with { type: 'json' }
import countriesData from './countries.json' with { type: 'json' }

// Aircraft data from OpenFlights
export const aircraft: Aircraft[] = aircraftData as Aircraft[]

// Airport data (major world airports)
export const airports: Airport[] = airportsData as Airport[]

// Airline data (major airlines)
export const airlines: Airline[] = airlinesData as Airline[]

// Lazy-initialized lookup Maps
let airlineByIataMap: Map<string, Airline> | null = null

function getAirlineByIataMap(): Map<string, Airline> {
  if (!airlineByIataMap) {
    airlineByIataMap = new Map(airlines.map(a => [a.iata.toUpperCase(), a]))
  }
  return airlineByIataMap
}

// Aircraft lookup helpers
export function searchAircraft(query: string): Aircraft[] {
  const q = query.toLowerCase()
  return aircraft.filter(a =>
    a.icao.toLowerCase().includes(q) ||
    a.iata?.toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    a.manufacturer.toLowerCase().includes(q) ||
    a.model.toLowerCase().includes(q)
  )
}

// Airport lookup helpers
export function searchAirports(query: string): Airport[] {
  const q = query.toLowerCase()
  return airports.filter(a =>
    a.iata.toLowerCase().includes(q) ||
    a.icao?.toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    a.city.toLowerCase().includes(q) ||
    a.country.toLowerCase().includes(q)
  )
}

// Airline lookup helpers
export function findAirline(iata: string): Airline | undefined {
  return getAirlineByIataMap().get(iata.toUpperCase())
}

export function searchAirlines(query: string): Airline[] {
  const q = query.toLowerCase()
  return airlines.filter(a =>
    a.iata.toLowerCase().includes(q) ||
    a.icao?.toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    a.country.toLowerCase().includes(q)
  )
}

// Country data
export interface CountryData {
  name: string
  nativeName: string
  continent: string
  flagColors: string[]
  dominantColor: string
  stampShape: 'circle' | 'rectangle'
  timezone: string
  region: string
  subregion: string
}

export const countries = countriesData as Record<string, CountryData>

// Airline logo from AirLabs CDN (free, no API call)
export function getAirlineLogoUrl(iataCode: string): string {
  return `https://airlabs.co/img/airline/m/${iataCode.toUpperCase()}.png`
}
