import { calculateFlightDuration } from '@kuuki/client/geo'

const clock = (value: string) => {
  const match = /^(\d{2}):(\d{2})/.exec(value)
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null
}
/** How far `timeZone` is ahead of UTC at `utcMs`. */
function offsetMs(utcMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(utcMs)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return (
    Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')) -
    Math.floor(utcMs / 60000) * 60000
  )
}
function localToUtc(day: string, hour: number, minute: number, timeZone: string) {
  const [year, month, date] = day.split('-').map(Number)
  const wall = Date.UTC(year, month - 1, date, hour, minute)
  const first = wall - offsetMs(wall, timeZone)
  return wall - offsetMs(first, timeZone)
}

/**
 * Whether the arrival's local clock falls on the day after departure. Uses both airports' time zones when known, the way
 * the saved duration does; otherwise an arrival at or before the departure clock is the next day.
 */
export function arrivesNextDay(
  date: string,
  departure: string,
  arrival: string,
  departureTz?: string,
  arrivalTz?: string,
) {
  const from = clock(departure),
    to = clock(arrival)
  if (!from || !to) return false
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && departureTz && arrivalTz) {
    const minutes = calculateFlightDuration(departure, arrival, date, departureTz, arrivalTz)
    if (minutes == null) return false
    try {
      const landed = localToUtc(date, from.hour, from.minute, departureTz) + minutes * 60000
      const landedDay = new Intl.DateTimeFormat('en-CA', {
        timeZone: arrivalTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(landed)
      return landedDay > date
    } catch {
      return false
    }
  }
  return to.hour * 60 + to.minute <= from.hour * 60 + from.minute
}
