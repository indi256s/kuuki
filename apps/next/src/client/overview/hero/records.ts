export function stubBucket(flights: number): 3 | 5 | 8 | 12 {
  return flights < 25 ? 3 : flights < 75 ? 5 : flights < 200 ? 8 : 12
}

export function odometerDigits(km: number): string {
  return String(Math.min(99_999_999, Math.max(0, Math.round(km))))
}
