export { familyOf, findAircraft } from './aircraft-lookup'
export { findAirport } from './airport-lookup'
import type { Aircraft, Airport, Airline } from '@kuuki/shared/types'
import aircraftData from './aircraft.json' with { type: 'json' }
import airportsData from './airports.json' with { type: 'json' }
import airlinesData from './airlines.json' with { type: 'json' }

export const aircraft: Aircraft[] = aircraftData as Aircraft[]

export const airports: Airport[] = airportsData as Airport[]

export const airlines: Airline[] = airlinesData as Airline[]
