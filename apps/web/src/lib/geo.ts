import type { AircraftType } from '@kuuki/shared/types'

const EARTH_RADIUS_KM = 6371
const ROUTING_ADJUSTMENT = 1.10

// Speed estimates (km/h) for different aircraft types
const SPEED_BY_AIRCRAFT_TYPE: Record<AircraftType, number> = {
  widebody: 850,
  narrowbody: 850,
  regional: 750,
  bizjet: 800,
  turboprop: 500,
  piston: 300,
}

// Default speed when aircraft type unknown
const DEFAULT_SPEED_KMH = 800

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Calculate great circle distance between two points using Haversine formula
 * @returns Distance in kilometers
 */
export function greatCircleDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_KM * c
}

/**
 * Calculate flight distance with routing adjustment
 * Typical flight routes are ~10% longer than great circle due to airways, wind routing, etc.
 */
export function calculateFlightDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const gcDistance = greatCircleDistance(lat1, lon1, lat2, lon2)
  return Math.round(gcDistance * ROUTING_ADJUSTMENT)
}

/**
 * Estimate flight duration when departure/arrival times not provided
 * @param distanceKm Flight distance in kilometers
 * @param aircraftType Type of aircraft (affects cruise speed)
 * @returns Duration in minutes
 */
export function estimateFlightDuration(
  distanceKm: number,
  aircraftType?: AircraftType
): number {
  const speed = aircraftType ? SPEED_BY_AIRCRAFT_TYPE[aircraftType] : DEFAULT_SPEED_KMH

  // Add fixed time for taxi, takeoff, climb, descent, landing
  // Short haul: ~30min overhead, long haul: ~45min overhead
  const overheadMinutes = distanceKm > 3000 ? 45 : 30

  const cruiseMinutes = (distanceKm / speed) * 60
  return Math.round(cruiseMinutes + overheadMinutes)
}

/**
 * Calculate actual flight duration from departure and arrival times
 * @param departureTime ISO time string (local time)
 * @param arrivalTime ISO time string (local time)
 * @param departureTz Timezone of departure (e.g., "America/New_York")
 * @param arrivalTz Timezone of arrival
 * @returns Duration in minutes, or null if times invalid
 */
export function calculateFlightDuration(
  departureTime: string,
  arrivalTime: string,
  _departureTz?: string,
  _arrivalTz?: string
): number | null {
  try {
    // For now, simple calculation assuming times are local without timezone conversion
    // In future, use _departureTz/_arrivalTz to calculate properly
    const depDate = new Date(departureTime)
    const arrDate = new Date(arrivalTime)

    if (isNaN(depDate.getTime()) || isNaN(arrDate.getTime())) {
      return null
    }

    const durationMs = arrDate.getTime() - depDate.getTime()

    // Handle overnight flights (arrival appears before departure)
    if (durationMs < 0) {
      // Assume next day arrival
      return Math.round((durationMs + 24 * 60 * 60 * 1000) / 60000)
    }

    return Math.round(durationMs / 60000)
  } catch {
    return null
  }
}

/**
 * Generate points along a great circle arc for map visualization
 * @param lat1 Start latitude
 * @param lon1 Start longitude
 * @param lat2 End latitude
 * @param lon2 End longitude
 * @param numPoints Number of points to generate (default 50)
 * @returns Array of [longitude, latitude] coordinates (GeoJSON format)
 */
export function generateGreatCircleArc(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  numPoints = 50
): [number, number][] {
  const points: [number, number][] = []

  const lat1Rad = toRadians(lat1)
  const lon1Rad = toRadians(lon1)
  const lat2Rad = toRadians(lat2)
  const lon2Rad = toRadians(lon2)

  // Calculate angular distance
  const d = 2 * Math.asin(
    Math.sqrt(
      Math.sin((lat2Rad - lat1Rad) / 2) ** 2 +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin((lon2Rad - lon1Rad) / 2) ** 2
    )
  )

  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints

    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)

    const x = A * Math.cos(lat1Rad) * Math.cos(lon1Rad) + B * Math.cos(lat2Rad) * Math.cos(lon2Rad)
    const y = A * Math.cos(lat1Rad) * Math.sin(lon1Rad) + B * Math.cos(lat2Rad) * Math.sin(lon2Rad)
    const z = A * Math.sin(lat1Rad) + B * Math.sin(lat2Rad)

    const lat = Math.atan2(z, Math.sqrt(x ** 2 + y ** 2))
    const lon = Math.atan2(y, x)

    // Return as [longitude, latitude] for GeoJSON
    points.push([lon * (180 / Math.PI), lat * (180 / Math.PI)])
  }

  return points
}

/**
 * Check if a flight date is in the future
 */
export function isUpcomingFlight(date: string): boolean {
  const flightDate = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return flightDate > today
}

/**
 * Calculate days until a future flight
 */
export function daysUntilFlight(date: string): number {
  const flightDate = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  flightDate.setHours(0, 0, 0, 0)
  const diffMs = flightDate.getTime() - today.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Format distance for display
 * Shows full number with thousand separators: "1,542 km"
 */
export function formatDistance(km: number): string {
  return `${Math.round(km).toLocaleString()} km`
}

/**
 * Format duration for display
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) {
    return `${mins}m`
  }
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}
