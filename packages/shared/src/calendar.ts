const LABEL = /^(\d{4})-(\d{2})-(\d{2})$/

function parseLabel(label: string): [number, number, number] {
  const match = LABEL.exec(label)
  if (!match) throw new RangeError(`Invalid calendar label: ${label}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function formatLabel(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function addDays(label: string, days: number): string {
  const [year, month, day] = parseLabel(label)
  const shifted = new Date(0)
  shifted.setUTCFullYear(year, month - 1, day + days)
  return formatLabel(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let cached = formatters.get(timeZone)
  if (!cached) {
    cached = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(timeZone, cached)
  }
  return cached
}

function wallClock(timeZone: string, instant: number) {
  const parts: Record<string, number> = {}
  for (const part of formatter(timeZone).formatToParts(new Date(instant))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return parts as {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    second: number
  }
}

function offsetAt(timeZone: string, instant: number): number {
  const wall = wallClock(timeZone, instant)
  const whole = Math.floor(instant / 1000) * 1000
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) - whole
}

export function localToday(timeZone: string, now: Date = new Date()): string {
  const wall = wallClock(timeZone, now.getTime())
  return formatLabel(wall.year, wall.month, wall.day)
}

export function startOfLocalDay(label: string, timeZone: string): string {
  const [year, month, day] = parseLabel(label)
  const base = Date.UTC(year, month - 1, day)
  const hour = 3_600_000
  const offsets = new Set([-48, -24, 0, 24, 48].map((h) => offsetAt(timeZone, base + h * hour)))
  const exact = [...offsets]
    .map((offset) => base - offset)
    .filter((instant) => offsetAt(timeZone, instant) === base - instant)
  if (exact.length) return new Date(Math.min(...exact)).toISOString()
  const candidates = [...offsets].map((offset) => base - offset)
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

export function canonicalTimeZone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 1 || value.length > 64) return null
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone
  } catch {
    return null
  }
}
