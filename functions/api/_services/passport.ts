import { assertRows } from '../_lib/d1'

export type Visit = { country_code: string; first_visit: string; last_visit: string; visit_count: number; airport_iata: string | null; city: string | null }
export type Claim = { country_code: string; claimed_at: string }
export type GroundVisit = { country_code: string; visit_year: number | null; entry_method: string | null }
export type PassportData = { visits: Visit[]; claims: Claim[]; groundVisits: GroundVisit[]; updatedAt: number; revision: number; publishedRevision: number }

/** One owner-scoped batch supplies collections and revision metadata. */
export async function readPassport(db: D1Database, userId: string): Promise<PassportData> {
  const statements = [
    db.prepare('SELECT country_code, first_visit, last_visit, visit_count, airport_iata, city FROM visits WHERE user_id = ?').bind(userId),
    db.prepare('SELECT country_code, claimed_at FROM country_claims WHERE user_id = ?').bind(userId),
    db.prepare('SELECT country_code, visit_year, entry_method FROM ground_visits WHERE user_id = ?').bind(userId),
    db.prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?').bind(userId),
  ]
  const results = await db.batch(statements)
  assertRows(results, 'Passport read failed', statements.length)
  const state = results[3].results[0] as { revision: number; published_revision: number } | undefined
  return {
    visits: results[0].results as Visit[],
    claims: results[1].results as Claim[],
    groundVisits: results[2].results as GroundVisit[],
    updatedAt: Date.now(),
    revision: state?.revision ?? 0,
    publishedRevision: state?.published_revision ?? 0,
  }
}
