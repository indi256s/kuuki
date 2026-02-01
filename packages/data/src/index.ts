// Re-export data files
import type { Aircraft, Airport, Airline } from '@kuuki/shared/types'
import aircraftData from './aircraft.json' with { type: 'json' }
import airportsData from './airports.json' with { type: 'json' }
import airlinesData from './airlines.json' with { type: 'json' }

// Aircraft data from OpenFlights
export const aircraft: Aircraft[] = aircraftData as Aircraft[]

// Airport data (major world airports)
export const airports: Airport[] = airportsData as Airport[]

// Airline data (major airlines)
export const airlines: Airline[] = airlinesData as Airline[]

// Aircraft lookup helpers
export function findAircraft(icao: string): Aircraft | undefined {
  return aircraft.find(a => a.icao.toUpperCase() === icao.toUpperCase())
}

export function findAircraftByIata(iata: string): Aircraft | undefined {
  return aircraft.find(a => a.iata?.toUpperCase() === iata.toUpperCase())
}

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
export function findAirport(iata: string): Airport | undefined {
  return airports.find(a => a.iata.toUpperCase() === iata.toUpperCase())
}

export function findAirportByIcao(icao: string): Airport | undefined {
  return airports.find(a => a.icao?.toUpperCase() === icao.toUpperCase())
}

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
  return airlines.find(a => a.iata.toUpperCase() === iata.toUpperCase())
}

export function findAirlineByIcao(icao: string): Airline | undefined {
  return airlines.find(a => a.icao?.toUpperCase() === icao.toUpperCase())
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
