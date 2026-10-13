// Owner-safe Passport DTOs strip user_id and shape ground visits for browser consumers.

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
function snapshotName(raw: unknown): string | null {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    const name = (value as { name?: unknown } | null)?.name
    return typeof name === 'string' && name.trim() ? name.trim() : null
  } catch {
    return null
  }
}

/** Rail legs chain `from → to`; a leg that starts where the previous one ended adds only its destination. */
export function railRouteLabel(legs: Array<{ from_place: string; to_place: string }>): string {
  const names: string[] = []
  let previousTo: string | null = null
  for (const leg of legs) {
    const from = snapshotName(leg.from_place)
    const to = snapshotName(leg.to_place)
    if (from && !(previousTo !== null && previousTo === from && names.length > 0)) names.push(from)
    if (to) names.push(to)
    previousTo = to
  }
  return names.join(' → ')
}

export function roadRouteLabel(points: Array<{ place: string }>): string {
  return points
    .map((point) => snapshotName(point.place))
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
