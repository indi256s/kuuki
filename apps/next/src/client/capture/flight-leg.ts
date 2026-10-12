import { calculateFlightDuration, localTimeToUtcMs } from '@kuuki/client/geo'
import { localToday } from '@kuuki/shared/calendar'

const clock = /^(\d{2}):(\d{2})$/

/**
 * One leg from local departure and arrival clocks: its duration, the way the saved flight computes it, and whether the
 * arrival's local clock falls on the day after departure. Without both time zones, an arrival at or before the
 * departure clock is the next day.
 */
export function legSummary(
  date: string,
  departure: string,
  arrival: string,
  departureTz?: string,
  arrivalTz?: string,
) {
  const from = clock.exec(departure),
    to = clock.exec(arrival)
  if (!from || !to) return null
  const minutes = calculateFlightDuration(departure, arrival, date, departureTz, arrivalTz)
  if (minutes == null) return null
  const departed =
    departureTz && arrivalTz
      ? localTimeToUtcMs(date, Number(from[1]), Number(from[2]), departureTz)
      : null
  const nextDay =
    departed != null && arrivalTz
      ? localToday(arrivalTz, new Date(departed + minutes * 60000)) > date
      : Number(to[1]) * 60 + Number(to[2]) <= Number(from[1]) * 60 + Number(from[2])
  return { minutes, nextDay }
}
