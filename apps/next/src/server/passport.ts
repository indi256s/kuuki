import 'server-only'
import { getRequestEnv, getRequestIdentity } from './identity'

export type Visit = { country_code: string; first_visit: string; last_visit: string; visit_count: number; airport_iata: string | null; city: string | null }
export type Claim = { country_code: string; claimed_at: string }
export type GroundVisit = { country_code: string; visit_year: number | null; entry_method: string | null }
export type PassportData = { visits: Visit[]; claims: Claim[]; groundVisits: GroundVisit[]; updatedAt: number; revision: number; publishedRevision: number }

export async function getOwnPassport() {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const env = await getRequestEnv()
  const results = await env.DB.batch([
    env.DB.prepare('SELECT country_code, first_visit, last_visit, visit_count, airport_iata, city FROM visits WHERE user_id = ?').bind(identity.id),
    env.DB.prepare('SELECT country_code, claimed_at FROM country_claims WHERE user_id = ?').bind(identity.id),
    env.DB.prepare('SELECT country_code, visit_year, entry_method FROM ground_visits WHERE user_id = ?').bind(identity.id),
    env.DB.prepare('SELECT revision, published_revision FROM user_derived_state WHERE user_id = ?').bind(identity.id),
  ])
  if (results.length !== 4 || results.some(result => !result.success || !Array.isArray(result.results))) throw new Error('Passport read failed')
  const state = results[3].results[0] as { revision: number; published_revision: number } | undefined
  const data: PassportData = {
    visits: results[0].results as Visit[], claims: results[1].results as Claim[], groundVisits: results[2].results as GroundVisit[],
    updatedAt: Date.now(), revision: state?.revision ?? 0, publishedRevision: state?.published_revision ?? 0,
  }
  return { ownerId: identity.id, data }
}
