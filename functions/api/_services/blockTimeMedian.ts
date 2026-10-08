export function medianFromSamples(values: number[]): number | null {
  if (values.length < 3) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2)
}

export function normalizeFlightNumber(airline: string | null, number: string | null): string | null {
  let normalized = number?.toUpperCase().replace(/\s/g, '') ?? ''
  const prefix = airline?.toUpperCase().replace(/\s/g, '')
  if (prefix && normalized.startsWith(prefix)) normalized = normalized.slice(prefix.length)
  return normalized.replace(/^0+/, '') || null
}

export async function readBlockTimeMedian(db: D1Database, key: {
  origin: string; destination: string; airlineIata: string | null; flightNumber: string | null; excludeFlightId?: number
}): Promise<number | null> {
  const { results } = await db.prepare(
    `SELECT airline_iata, flight_number, duration_minutes FROM flights INDEXED BY idx_flights_route_times
     WHERE origin = ? AND destination = ? AND duration_source = 'times' AND times_from_schedule = 0
       AND lifecycle_state IN ('awaiting', 'logged') AND duration_minutes > 0 AND duration_minutes <= 1200
       AND id != ? ORDER BY id DESC LIMIT 1000`,
  ).bind(key.origin, key.destination, key.excludeFlightId ?? -1)
    .all<{ airline_iata: string | null; flight_number: string | null; duration_minutes: number }>()
  const airline = key.airlineIata?.toUpperCase().trim()
  const number = normalizeFlightNumber(key.airlineIata, key.flightNumber)
  const matching = airline && number ? results.filter(row => row.airline_iata?.toUpperCase().trim() === airline
    && normalizeFlightNumber(row.airline_iata, row.flight_number) === number) : []
  return medianFromSamples(matching.map(row => row.duration_minutes)) ?? medianFromSamples(results.map(row => row.duration_minutes))
}
