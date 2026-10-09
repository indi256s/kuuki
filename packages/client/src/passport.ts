import { api } from './apiClient'
import type { DerivedAck } from './derivedState'
import type { GroundVisit, EntryMethod } from '@kuuki/shared'

export interface CountryClaim {
  id: string
  user_id: string
  country_code: string
  claimed_at: string | null
}

/** A claim row as returned by GET /api/passport/claims (user_id stripped server-side). */
interface ApiClaimListRow {
  id: string
  country_code: string
  claimed_at: string | null
}

/** A ground visit DTO as returned by the API (camelCase, no userId). */
interface ApiGroundVisit extends DerivedAck {
  id: string
  countryCode: string
  visitYear: number | null
  entryMethod: string | null
  note: string | null
  createdAt: string
}

/**
 * Map an API GroundVisit DTO into the frontend GroundVisit shape.
 * The API strips userId, so it is refilled from the authenticated caller's id.
 */
function toGroundVisit(v: ApiGroundVisit, userId: string): GroundVisit {
  return {
    id: v.id,
    userId,
    countryCode: v.countryCode,
    visitYear: v.visitYear,
    entryMethod: v.entryMethod as EntryMethod,
    note: v.note,
    createdAt: v.createdAt,
  }
}

/**
 * Claim a country (upsert stamp only — no visit details)
 */
export async function claimCountry(
  userId: string,
  countryCode: string,
): Promise<CountryClaim & DerivedAck> {
  const claim = await api.put<ApiClaimListRow & DerivedAck>(`/api/passport/claims/${countryCode}`)
  // The API strips user_id; refill it for the caller's row shape.
  return {
    id: claim.id,
    user_id: userId,
    country_code: claim.country_code,
    claimed_at: claim.claimed_at,
    derived_state: claim.derived_state,
    revision: claim.revision,
  }
}

/**
 * Add a ground visit record for a country
 */
export async function addGroundVisit(
  userId: string,
  countryCode: string,
  data: {
    visitYear?: number | null
    note?: string | null
    entryMethod?: EntryMethod
  } = {},
): Promise<GroundVisit & DerivedAck> {
  const visit = await api.post<ApiGroundVisit>('/api/passport/ground-visits', {
    countryCode,
    visitYear: data.visitYear ?? null,
    note: data.note ?? null,
    entryMethod: data.entryMethod ?? null,
  })

  return {
    ...toGroundVisit(visit, userId),
    derived_state: visit.derived_state,
    revision: visit.revision,
  }
}

/**
 * Delete a single ground visit
 */
export async function deleteGroundVisit(_userId: string, visitId: string): Promise<DerivedAck> {
  return api.delete<DerivedAck>(`/api/passport/ground-visits/${visitId}`)
}

/**
 * Remove a claimed country (stamp + all ground visits)
 */
export async function unclaimCountry(_userId: string, countryCode: string): Promise<DerivedAck> {
  return api.delete<DerivedAck>(`/api/passport/claims/${countryCode}`)
}
