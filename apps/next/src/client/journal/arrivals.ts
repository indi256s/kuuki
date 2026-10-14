// The detail sheet's one destination-history fact: which recorded arrival in the destination city this flight is.
// Counted over logged flights in this journal only (not claimed visits), so importing older flights can raise a count.
import type { JournalFlight, JournalPayload } from './model'

type Arrival = { ordinal: number; city: string }

const cache = new WeakMap<JournalPayload, Map<number, Arrival>>()

/** City grouping when the reference data names a city ("Moscow" covers SVO, VKO and DME); the airport alone otherwise. */
function placeOf(payload: JournalPayload, flight: JournalFlight): { key: string; city: string } {
  const ref = payload.refs.airports[flight.destination]
  const country = flight.destination_country ?? ref?.country ?? ''
  return ref?.city
    ? { key: `city:${country}:${ref.city}`, city: ref.city }
    : { key: `airport:${flight.destination}`, city: ref?.name ?? flight.destination }
}

const instant = (flight: JournalFlight) => {
  const value = Date.parse(flight.arrival_utc ?? flight.departure_utc ?? '')
  return Number.isNaN(value) ? null : value
}

/**
 * Chronological order, total so the sort is deterministic: the date; on the same date, flights with a known instant by that instant
 * before flights without one; then the id, the order they were recorded in.
 */
function compareArrivals(a: JournalFlight, b: JournalFlight): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const left = instant(a),
    right = instant(b)
  if (left !== right) {
    if (left === null) return 1
    if (right === null) return -1
    return left - right
  }
  return a.id - b.id
}

/** "4th recorded arrival in Tel Aviv" as numbers: null unless the flight itself is logged. */
export function arrivalOrdinal(payload: JournalPayload, flight: JournalFlight): Arrival | null {
  if (flight.lifecycle_state !== 'logged') return null
  let index = cache.get(payload)
  if (!index) {
    index = new Map()
    const counts = new Map<string, number>()
    const logged = payload.flights
      .filter((item) => item.lifecycle_state === 'logged')
      .sort(compareArrivals)
    for (const item of logged) {
      const place = placeOf(payload, item)
      const ordinal = (counts.get(place.key) ?? 0) + 1
      counts.set(place.key, ordinal)
      index.set(item.id, { ordinal, city: place.city })
    }
    cache.set(payload, index)
  }
  return index.get(flight.id) ?? null
}
