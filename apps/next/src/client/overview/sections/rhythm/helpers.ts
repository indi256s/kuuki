export type HeatBucket = 0 | 1 | 2 | 3 | 4
/** A value the scale cannot place. It is never folded into bucket 0, so it cannot pass for a known zero. */
export const HEAT_MISSING = 'missing' as const

/**
 * Month share of the base: 0, then (0;25], (25;50], (50;75], (75;100] percent of `max`, anything above the base capped at 4.
 * A known zero stays 0 whatever the base is, so a journal whose base is zero shows zeros, not NaN.
 * A negative or non-finite value, an unusable base, or a positive value against a zero base returns `HEAT_MISSING`.
 */
export function heatBucket(value: number, max: number): HeatBucket | typeof HEAT_MISSING {
  if (!Number.isFinite(value) || value < 0) return HEAT_MISSING
  if (value === 0) return 0
  if (!Number.isFinite(max) || max <= 0) return HEAT_MISSING
  return Math.min(4, Math.ceil((4 * value) / max)) as 1 | 2 | 3 | 4
}
/**
 * Months that hold at least one flight with a usable value for the metric. `totals()` reads a missing measurement as 0,
 * so a month outside this set that has flights is unknown, not zero.
 */
export function measuredMonths(
  rows: ReadonlyArray<{ date: string; distanceKm: number | null; durationMinutes: number | null }>,
  metric: 'distanceKm' | 'durationMinutes',
): Set<string> {
  const months = new Set<string>()
  for (const row of rows) {
    const value = row[metric]
    if (value !== null && Number.isFinite(value) && value >= 0) months.add(row.date.slice(0, 7))
  }
  return months
}
export function monthStart(key: string): Date {
  return new Date(`${key.slice(0, 7)}-01T00:00:00Z`)
}
export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}
