// Calendar-label arithmetic for flight lifecycle deadlines (ADR 0001 §1 "Calendar rule").
// A flight `date` is a YYYY-MM-DD label, never an instant: it is never passed to `new Date(date)`
// for presentation, and days are added as labels, never as 24-hour spans.

const LABEL = /^(\d{4})-(\d{2})-(\d{2})$/

function parseLabel(label: string): [number, number, number] {
  const match = LABEL.exec(label)
  if (!match) throw new RangeError(`Invalid calendar label: ${label}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function formatLabel(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** `label` shifted by `days` calendar days. */
export function addDays(label: string, days: number): string {
  const [year, month, day] = parseLabel(label)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return formatLabel(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let cached = formatters.get(timeZone)
  if (!cached) {
    cached = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    formatters.set(timeZone, cached)
  }
  return cached
}

/** Local wall-clock fields at `instant` (ms) in `timeZone`. */
function wallClock(timeZone: string, instant: number) {
  const parts: Record<string, number> = {}
  for (const part of formatter(timeZone).formatToParts(new Date(instant))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return parts as { year: number; month: number; day: number; hour: number; minute: number; second: number }
}

/** Local wall clock at `instant` read as if it were UTC, minus the instant: the zone offset in ms. */
function offsetAt(timeZone: string, instant: number): number {
  const wall = wallClock(timeZone, instant)
  const whole = Math.floor(instant / 1000) * 1000
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) - whole
}

/** The calendar date at `now` in `timeZone`. */
export function localToday(timeZone: string, now: Date = new Date()): string {
  const wall = wallClock(timeZone, now.getTime())
  return formatLabel(wall.year, wall.month, wall.day)
}

/**
 * The UTC instant (canonical ISO) of local 00:00 on `label` in `timeZone`. In a DST gap it is the
 * first existing instant after midnight; when midnight occurs twice it is the earlier instant.
 */
export function startOfLocalDay(label: string, timeZone: string): string {
  const [year, month, day] = parseLabel(label)
  const base = Date.UTC(year, month - 1, day)
  const hour = 3_600_000
  // Every offset in effect within two days of the label; at most one transition lies in between.
  const offsets = new Set([-48, -24, 0, 24, 48].map(h => offsetAt(timeZone, base + h * hour)))
  const exact = [...offsets].map(offset => base - offset).filter(instant => offsetAt(timeZone, instant) === base - instant)
  if (exact.length) return new Date(Math.min(...exact)).toISOString()
  // Gap: local time is monotonic across a spring-forward, so search for the first instant
  // whose wall clock has reached the label's midnight.
  const candidates = [...offsets].map(offset => base - offset)
  let low = Math.min(...candidates)
  let high = Math.max(...candidates)
  const reached = (instant: number) => instant + offsetAt(timeZone, instant) >= base
  while (high - low > 1000) {
    const middle = low + Math.floor((high - low) / 2000) * 1000
    if (reached(middle)) high = middle
    else low = middle
  }
  return new Date(reached(low) ? low : high).toISOString()
}

/** A valid IANA zone in canonical spelling, or null. */
export function canonicalTimeZone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 1 || value.length > 64) return null
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone
  } catch {
    return null
  }
}
