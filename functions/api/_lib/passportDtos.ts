// Owner-safe Passport DTOs strip user_id and shape ground visits for browser consumers.
import { parsePlaceSnapshot, railRouteRuns } from '../../../packages/shared/src/groundTravel'

export interface GroundVisitRow {
  id: string
  user_id: string
  country_code: string
  visit_year: number | null
  note: string | null
  entry_method: string | null
  created_at: string
}

/** camelCase GroundVisit DTO (no userId) consumed by packages/client/src/passport.ts. */
export function toGroundVisit(row: GroundVisitRow) {
  return {
    id: row.id,
    countryCode: row.country_code,
    visitYear: row.visit_year,
    entryMethod: row.entry_method,
    note: row.note,
    createdAt: row.created_at,
  }
}

/** A confirmed rail/road journey that supports a country; distinct from manual ground visits. */
export interface PassportJourney {
  id: string
  mode: 'rail' | 'road'
  title: string | null
  startDate: string | null
  endDate: string | null
  /** "Tbilisi → Kars → Tbilisi" from the journey's own place snapshots; empty when none are readable. */
  route: string
}

export interface PassportJourneyRow {
  id: string
  mode: 'rail' | 'road'
  title: string | null
  start_date: string | null
  end_date: string | null
}

/** Source name of a stored place snapshot; a malformed legacy value is skipped, never thrown on. */
function snapshotPlace(raw: unknown) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsePlaceSnapshot(value)
  } catch {
    return null
  }
}

/** Rail legs chain `from → to`; a leg that starts where the previous one ended adds only its destination. */
export function railRouteLabel(legs: Array<{ from_place: string; to_place: string }>): string {
  return railRouteRuns(
    legs.map((leg) => ({ from: snapshotPlace(leg.from_place), to: snapshotPlace(leg.to_place) })),
  )
    .map((run) => run.flatMap((place) => (place ? [place.name] : [])).join(' → '))
    .filter(Boolean)
    .join(' · ')
}

export function roadRouteLabel(points: Array<{ place: string }>): string {
  return points
    .map((point) => snapshotPlace(point.place)?.name ?? null)
    .filter((name): name is string => name !== null)
    .join(' → ')
}

export function toPassportJourney(row: PassportJourneyRow, route: string): PassportJourney {
  return {
    id: row.id,
    mode: row.mode,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    route,
  }
}
