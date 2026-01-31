// Sample flight data for empty state preview
export interface SampleFlight {
  id: number
  date: string
  origin: string
  destination: string
  originCity: string
  destinationCity: string
  flightNumber: string
  airline: string
  distanceKm: number
  durationMinutes: number
}

export const sampleFlights: SampleFlight[] = [
  {
    id: 1,
    date: '2024-12-15',
    origin: 'JFK',
    destination: 'LHR',
    originCity: 'New York',
    destinationCity: 'London',
    flightNumber: 'BA178',
    airline: 'British Airways',
    distanceKm: 5555,
    durationMinutes: 420,
  },
  {
    id: 2,
    date: '2024-11-28',
    origin: 'LHR',
    destination: 'DXB',
    originCity: 'London',
    destinationCity: 'Dubai',
    flightNumber: 'EK002',
    airline: 'Emirates',
    distanceKm: 5495,
    durationMinutes: 410,
  },
  {
    id: 3,
    date: '2024-10-05',
    origin: 'NRT',
    destination: 'SIN',
    originCity: 'Tokyo',
    destinationCity: 'Singapore',
    flightNumber: 'SQ11',
    airline: 'Singapore Airlines',
    distanceKm: 5312,
    durationMinutes: 430,
  },
  {
    id: 4,
    date: '2024-09-12',
    origin: 'CDG',
    destination: 'JFK',
    originCity: 'Paris',
    destinationCity: 'New York',
    flightNumber: 'AF006',
    airline: 'Air France',
    distanceKm: 5834,
    durationMinutes: 510,
  },
]

export const sampleStats = {
  totalFlights: 47,
  totalDistanceKm: 127843,
  countriesVisited: 18,
  airlinesFlown: 12,
}

// Format distance for display
export function formatDistance(km: number): string {
  if (km >= 1000) {
    return `${(km / 1000).toFixed(1)}k km`
  }
  return `${km} km`
}

// Format duration for display
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) {
    return `${mins}m`
  }
  if (mins === 0) {
    return `${hours}h`
  }
  return `${hours}h ${mins}m`
}
