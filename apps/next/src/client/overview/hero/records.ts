// Data for the figures card's static illustration.

/** The stack grows at 25, 75 and 200 flights; individual stubs are illustrative, not a literal flight count. */
export function stubBucket(flights: number): 3 | 5 | 8 | 12 {
  return flights < 25 ? 3 : flights < 75 ? 5 : flights < 200 ? 8 : 12
}

/** The counter has at most eight drums. */
export function odometerDigits(km: number): string {
  return String(Math.min(99_999_999, Math.max(0, Math.round(km))))
}
