import { greatCircleKm } from '@kuuki/shared/geo'

export function calculateFlightDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  return Math.round(greatCircleKm({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }))
}

export function calculateFlightDuration(
  departureTime: string,
  arrivalTime: string,
  date?: string,
  departureTz?: string,
  arrivalTz?: string,
): number | null {
  try {
    const depParts = departureTime.split(':').map(Number)
    const arrParts = arrivalTime.split(':').map(Number)

    if (depParts.length < 2 || arrParts.length < 2) return null
    if (isNaN(depParts[0]) || isNaN(depParts[1]) || isNaN(arrParts[0]) || isNaN(arrParts[1]))
      return null

    const flightDate = date || new Date().toISOString().split('T')[0]

    if (departureTz && arrivalTz) {
      const depUtc = localTimeToUtcMs(flightDate, depParts[0], depParts[1], departureTz)
      let arrUtc = localTimeToUtcMs(flightDate, arrParts[0], arrParts[1], arrivalTz)

      if (depUtc === null || arrUtc === null) return null

      if (arrUtc <= depUtc) {
        arrUtc += 24 * 60 * 60 * 1000
      }

      const durationMinutes = Math.round((arrUtc - depUtc) / 60000)

      if (durationMinutes > 0 && durationMinutes <= 24 * 60) {
        return durationMinutes
      }
    }

    const depMinutes = depParts[0] * 60 + depParts[1]
    let arrMinutes = arrParts[0] * 60 + arrParts[1]

    if (arrMinutes <= depMinutes) {
      arrMinutes += 24 * 60
    }

    return arrMinutes - depMinutes
  } catch {
    return null
  }
}

export function localTimeToUtcMs(
  date: string,
  hours: number,
  minutes: number,
  timeZone: string,
): number | null {
  try {
    const [year, month, day] = date.split('-').map(Number)

    const naiveUtcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0)

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

    const parts = formatter.formatToParts(new Date(naiveUtcMs))
    const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10)

    const tzYear = get('year')
    const tzMonth = get('month')
    const tzDay = get('day')
    const tzHour = get('hour') === 24 ? 0 : get('hour')
    const tzMinute = get('minute')

    const tzMs = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0, 0)

    const offsetMs = tzMs - naiveUtcMs

    return naiveUtcMs - offsetMs
  } catch {
    return null
  }
}
