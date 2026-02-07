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
let aircraftByIcaoMap: Map<string, Aircraft> | null = null
let aircraftByIataMap: Map<string, Aircraft> | null = null
let airportByIataMap: Map<string, Airport> | null = null
let airportByIcaoMap: Map<string, Airport> | null = null
let airlineByIataMap: Map<string, Airline> | null = null
let airlineByIcaoMap: Map<string, Airline> | null = null

function getAircraftByIcaoMap(): Map<string, Aircraft> {
  if (!aircraftByIcaoMap) {
    aircraftByIcaoMap = new Map(aircraft.map(a => [a.icao.toUpperCase(), a]))
  }
  return aircraftByIcaoMap
}

function getAircraftByIataMap(): Map<string, Aircraft> {
  if (!aircraftByIataMap) {
    aircraftByIataMap = new Map()
    for (const a of aircraft) {
      if (a.iata) aircraftByIataMap.set(a.iata.toUpperCase(), a)
    }
  }
  return aircraftByIataMap
}

function getAirportByIataMap(): Map<string, Airport> {
  if (!airportByIataMap) {
    airportByIataMap = new Map(airports.map(a => [a.iata.toUpperCase(), a]))
  }
  return airportByIataMap
}

function getAirportByIcaoMap(): Map<string, Airport> {
  if (!airportByIcaoMap) {
    airportByIcaoMap = new Map()
    for (const a of airports) {
      if (a.icao) airportByIcaoMap.set(a.icao.toUpperCase(), a)
    }
  }
  return airportByIcaoMap
}

function getAirlineByIataMap(): Map<string, Airline> {
  if (!airlineByIataMap) {
    airlineByIataMap = new Map(airlines.map(a => [a.iata.toUpperCase(), a]))
  }
  return airlineByIataMap
}

function getAirlineByIcaoMap(): Map<string, Airline> {
  if (!airlineByIcaoMap) {
    airlineByIcaoMap = new Map()
    for (const a of airlines) {
      if (a.icao) airlineByIcaoMap.set(a.icao.toUpperCase(), a)
    }
  }
  return airlineByIcaoMap
}

// Aircraft lookup helpers
export function findAircraft(icao: string): Aircraft | undefined {
  return getAircraftByIcaoMap().get(icao.toUpperCase())
}

export function findAircraftByIata(iata: string): Aircraft | undefined {
  return getAircraftByIataMap().get(iata.toUpperCase())
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
  return getAirportByIataMap().get(iata.toUpperCase())
}

export function findAirportByIcao(icao: string): Airport | undefined {
  return getAirportByIcaoMap().get(icao.toUpperCase())
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
  return getAirlineByIataMap().get(iata.toUpperCase())
}

export function findAirlineByIcao(icao: string): Airline | undefined {
  return getAirlineByIcaoMap().get(icao.toUpperCase())
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

// Country lookup helpers
export function findCountry(code: string): CountryData | undefined {
  return countries[code.toUpperCase()]
}

export function getCountryName(code: string): string {
  return countries[code.toUpperCase()]?.name || code
}

export function getCountryColor(code: string): string {
  return countries[code.toUpperCase()]?.dominantColor || '#6b7280'
}

// Airline logo from AirLabs CDN (free, no API call)
export function getAirlineLogoUrl(iataCode: string): string {
  return `https://airlabs.co/img/airline/m/${iataCode.toUpperCase()}.png`
}
