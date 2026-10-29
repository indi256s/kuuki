export { familyOf, findAircraft } from './aircraft-lookup'
export { findAirport } from './airport-lookup'
// Re-export data files
import type { Aircraft, Airport, Airline } from '@kuuki/shared/types'
import aircraftData from './aircraft.json' with { type: 'json' }
import airportsData from './airports.json' with { type: 'json' }
import airlinesData from './airlines.json' with { type: 'json' }

// Aircraft data from OpenFlights
export const aircraft: Aircraft[] = aircraftData as Aircraft[]

// Airport references admitted from the checked-in source, with manual corrections.
export const airports: Airport[] = airportsData as Airport[]

// Airline data (major airlines)
export const airlines: Airline[] = airlinesData as Airline[]
