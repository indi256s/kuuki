import type { AircraftType } from '@kuuki/shared/types'
import { greatCircleKm } from '@kuuki/shared/geo'

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

/** Rounded great-circle flight distance in km. */
export function calculateFlightDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return Math.round(greatCircleKm({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }))
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
 * Calculate actual flight duration from local departure and arrival times,
 * accounting for timezone differences between origin and destination airports.
 *
 * @param departureTime Local departure time as "HH:MM" or ISO string
 * @param arrivalTime Local arrival time as "HH:MM" or ISO string
 * @param date Flight date as "YYYY-MM-DD" (needed to resolve DST correctly)
 * @param departureTz IANA timezone of departure airport (e.g., "America/New_York")
 * @param arrivalTz IANA timezone of arrival airport (e.g., "Europe/London")
 * @returns Duration in minutes, or null if inputs are invalid
 */
export function calculateFlightDuration(
  departureTime: string,
  arrivalTime: string,
  date?: string,
  departureTz?: string,
  arrivalTz?: string
): number | null {
  try {
    // Parse HH:MM format
    const depParts = departureTime.split(':').map(Number)
    const arrParts = arrivalTime.split(':').map(Number)

    if (depParts.length < 2 || arrParts.length < 2) return null
    if (isNaN(depParts[0]) || isNaN(depParts[1]) || isNaN(arrParts[0]) || isNaN(arrParts[1])) return null

    const flightDate = date || new Date().toISOString().split('T')[0]

    // If we have timezone info for both airports, do a proper UTC-based calculation
    if (departureTz && arrivalTz) {
      const depUtc = localTimeToUtcMs(flightDate, depParts[0], depParts[1], departureTz)
      let arrUtc = localTimeToUtcMs(flightDate, arrParts[0], arrParts[1], arrivalTz)

      if (depUtc === null || arrUtc === null) return null

      // Handle cross-day flights: if arrival UTC is before departure UTC,
      // the flight arrived the next day in arrival-local time
      if (arrUtc <= depUtc) {
        arrUtc += 24 * 60 * 60 * 1000
      }

      const durationMinutes = Math.round((arrUtc - depUtc) / 60000)

      // Sanity check: commercial flights are typically 30min–20h
      // If duration exceeds 24h, something is off — fall back to naive calc
      if (durationMinutes > 0 && durationMinutes <= 24 * 60) {
        return durationMinutes
      }
    }

    // Fallback: naive local-time subtraction (no timezone info)
    const depMinutes = depParts[0] * 60 + depParts[1]
    let arrMinutes = arrParts[0] * 60 + arrParts[1]

    // Handle overnight flights
    if (arrMinutes <= depMinutes) {
      arrMinutes += 24 * 60
    }

    return arrMinutes - depMinutes
  } catch {
    return null
  }
}

/**
 * Convert a local date+time in a given IANA timezone to UTC milliseconds.
 * Uses the Intl API (no external libraries needed).
 */
function localTimeToUtcMs(
  date: string,     // "YYYY-MM-DD"
  hours: number,
  minutes: number,
  timeZone: string
): number | null {
  try {
    // Build an ISO-ish string and parse it as if it were UTC,
    // then find the actual UTC offset for that timezone on that date.
    const [year, month, day] = date.split('-').map(Number)

    // Create a date in UTC with the given wall-clock values
    const naiveUtcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0)

    // Use Intl to find what UTC offset the timezone has at this moment
    // by formatting a known UTC instant and comparing
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    // Format naiveUtcMs (treated as UTC) in the target timezone
    // The difference between the formatted time and the naive UTC time gives us the offset
    const parts = formatter.formatToParts(new Date(naiveUtcMs))
    const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10)

    const tzYear = get('year')
    const tzMonth = get('month')
    const tzDay = get('day')
    const tzHour = get('hour') === 24 ? 0 : get('hour')
    const tzMinute = get('minute')

    // Reconstruct what UTC ms the timezone thinks this is
    const tzMs = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0, 0)

    // The offset is: tzMs - naiveUtcMs (positive means timezone is ahead of UTC)
    const offsetMs = tzMs - naiveUtcMs

    // The actual UTC time for "hours:minutes in timeZone on date" is:
    // naiveUtcMs - offsetMs
    return naiveUtcMs - offsetMs
  } catch {
    return null
  }
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
