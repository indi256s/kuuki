import { parsePlaceSnapshot, railRouteRuns } from '../../../packages/shared/src/groundTravel'

export interface GroundVisitRow {
  id: string
  user_id: string
  country_code: string
  visit_year: number | null
  note: string | null
  entry_method: string | null
  mode: string | null
  linked_flight_id?: number | null
  created_at: string
}

export function toGroundVisit(row: GroundVisitRow) {
  return {
    id: row.id,
    countryCode: row.country_code,
    visitYear: row.visit_year,
    entryMethod: row.entry_method,
    mode: row.mode,
    linkedFlightId: row.linked_flight_id ?? null,
    note: row.note,
    createdAt: row.created_at,
  }
}

export interface PassportJourney {
  id: string
  mode: 'rail' | 'road'
  title: string | null
  startDate: string | null
  endDate: string | null
  route: string
}

export interface PassportJourneyRow {
  id: string
  mode: 'rail' | 'road'
  title: string | null
  start_date: string | null
  end_date: string | null
}

function snapshotPlace(raw: unknown) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsePlaceSnapshot(value)
  } catch {
    return null
  }
}

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
