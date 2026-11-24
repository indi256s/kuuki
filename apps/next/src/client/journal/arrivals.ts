import type { JournalFlight, JournalPayload } from './model'

type Arrival = { ordinal: number; city: string }

const cache = new WeakMap<JournalPayload, Map<number, Arrival>>()

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
