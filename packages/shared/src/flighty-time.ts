import { isCalendarDate } from './flightValidation'
import { utcOffsetMinutes } from './timezones'

export interface LocalTimestamp {
  date: string
  time: string
  seconds: number
  offset: number | null
}

export type LocalResolution =
  | { kind: 'unique'; utc: string; offset: number }
  | { kind: 'ambiguous'; options: Array<{ utc: string; offset: number }> }
  | { kind: 'nonexistent' }
  | { kind: 'offset_mismatch'; utc: string; offset: number; zoneOffset: number | null }
  | { kind: 'unresolved' }

const TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/

export function parseLocalTimestamp(value: string): LocalTimestamp | null {
  const match = TIMESTAMP.exec(value.trim())
  if (!match || !isCalendarDate(match[1])) return null
  const zone = match[5]
  const offset =
    zone === undefined
      ? null
      : zone === 'Z'
        ? 0
        : (zone[0] === '-' ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)))
  return {
    date: match[1],
    time: `${match[2]}:${match[3]}`,
    seconds: match[4] ? Number(match[4]) : 0,
    offset,
  }
}

const MINUTE = 60_000
const DAY = 86_400_000

function wallClockMs(local: LocalTimestamp): number {
  const [year, month, day] = local.date.split('-').map(Number)
  const [hour, minute] = local.time.split(':').map(Number)
  return Date.UTC(year, month - 1, day, hour, minute, local.seconds)
}

export function resolveLocalTimestamp(
  local: LocalTimestamp,
  timeZone: string | null,
): LocalResolution {
  if (!timeZone) return { kind: 'unresolved' }
  const wall = wallClockMs(local)
  if (local.offset !== null) {
    const utcMs = wall - local.offset * MINUTE
    const zoneOffset = utcOffsetMinutes(timeZone, new Date(utcMs))
    const utc = new Date(utcMs).toISOString()
    return zoneOffset === local.offset
      ? { kind: 'unique', utc, offset: local.offset }
      : { kind: 'offset_mismatch', utc, offset: local.offset, zoneOffset }
  }
  const offsets = new Set<number>()
  for (const shift of [-2, -1, 0, 1, 2]) {
    const offset = utcOffsetMinutes(timeZone, new Date(wall + shift * DAY))
    if (offset === null) return { kind: 'unresolved' }
    offsets.add(offset)
  }
  const options = [...offsets]
    .map((offset) => ({ utcMs: wall - offset * MINUTE, offset }))
    .filter(({ utcMs, offset }) => utcOffsetMinutes(timeZone, new Date(utcMs)) === offset)
    .sort((a, b) => a.utcMs - b.utcMs)
    .map(({ utcMs, offset }) => ({ utc: new Date(utcMs).toISOString(), offset }))
  if (options.length === 0) return { kind: 'nonexistent' }
  if (options.length === 1) return { kind: 'unique', ...options[0] }
  return { kind: 'ambiguous', options }
}

export function minutesBetween(fromUtc: string, toUtc: string): number {
  return Math.round((Date.parse(toUtc) - Date.parse(fromUtc)) / MINUTE)
}
