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
