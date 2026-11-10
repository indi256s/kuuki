// Airport-local timestamps from a Flighty CSV, resolved to instants without guessing.
//
// The observed export writes `YYYY-MM-DDTHH:MM` with no offset (docs/research/2026-11-10-flighty-csv-format-research.md).
// Such a wall-clock time names zero, one or two instants in the airport's historical IANA zone: a DST gap has none,
// a DST fold has two. The resolver reports which, and never picks an offset on the caller's behalf.
import { isCalendarDate } from './flightValidation'
import { utcOffsetMinutes } from './timezones'

export interface LocalTimestamp {
  /** Calendar date as written, `YYYY-MM-DD`. */
  date: string
  /** Wall-clock time as written, `HH:MM`. Seconds, when present, are kept in `seconds`. */
  time: string
  seconds: number
  /** Explicit offset in minutes when the source wrote one (`Z`, `+09:00`); null for the observed naive form. */
  offset: number | null
}

export type LocalResolution =
  | { kind: 'unique'; utc: string; offset: number }
  /** DST fold: the wall clock repeats. Options are ordered earlier instant first. */
  | { kind: 'ambiguous'; options: Array<{ utc: string; offset: number }> }
  /** DST gap: the wall clock never showed this time. */
  | { kind: 'nonexistent' }
  /** The source wrote an offset that the airport's zone did not use at that instant. */
  | { kind: 'offset_mismatch'; utc: string; offset: number; zoneOffset: number | null }
  /** Unknown zone, or an instant the runtime cannot format. */
  | { kind: 'unresolved' }

const TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/

/** Strict parse of the timestamp shapes the importer accepts; anything else is null (reported, never coerced). */
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

/**
 * Resolve an airport-local timestamp in `timeZone`. A naive time is tried against every offset the zone used within
 * two days of it; each candidate instant must map back to the same wall clock. Explicit offsets are checked, not trusted.
 */
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

/** Whole minutes between two ISO instants (later minus earlier). */
export function minutesBetween(fromUtc: string, toUtc: string): number {
  return Math.round((Date.parse(toUtc) - Date.parse(fromUtc)) / MINUTE)
}
