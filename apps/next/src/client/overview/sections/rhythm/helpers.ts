export function heatBucket(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  return value <= 0 || !Number.isFinite(value) || max <= 0 || !Number.isFinite(max)
    ? 0
    : (Math.min(4, Math.ceil((4 * value) / max)) as 1 | 2 | 3 | 4)
}
export function monthStart(key: string): Date {
  return new Date(`${key.slice(0, 7)}-01T00:00:00Z`)
}
export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}
