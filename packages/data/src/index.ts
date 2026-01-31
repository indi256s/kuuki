// Re-export data files
import type { Aircraft, Airport, Airline } from '@kuuki/shared/types'
import aircraftData from './aircraft.json' with { type: 'json' }

// These will be populated with actual airport/airline data later
export const airports: Airport[] = []
export const airlines: Airline[] = []

// Aircraft data from OpenFlights
export const aircraft: Aircraft[] = aircraftData as Aircraft[]

// Lookup helpers
export function findAircraft(icao: string): Aircraft | undefined {
  return aircraft.find(a => a.icao === icao)
}

export function findAircraftByIata(iata: string): Aircraft | undefined {
  return aircraft.find(a => a.iata === iata)
}
