import { api } from './apiClient'
import type { DerivedAck } from './derivedState'
import type { GroundVisit, EntryMethod, GroundVisitMode } from '@kuuki/shared'

export interface CountryClaim {
  id: string
  user_id: string
  country_code: string
  claimed_at: string | null
}

interface ApiClaimListRow {
  id: string
  country_code: string
  claimed_at: string | null
}

interface ApiGroundVisit extends DerivedAck {
  id: string
  countryCode: string
  visitYear: number | null
  entryMethod: string | null
  mode: string | null
  linkedFlightId?: number | null
  note: string | null
  createdAt: string
}

function toGroundVisit(v: ApiGroundVisit, userId: string): GroundVisit {
  return {
    id: v.id,
    userId,
    countryCode: v.countryCode,
    visitYear: v.visitYear,
    entryMethod: v.entryMethod as EntryMethod,
    mode: v.mode as GroundVisitMode,
    linkedFlightId: v.linkedFlightId ?? null,
    note: v.note,
    createdAt: v.createdAt,
  }
}

export async function claimCountry(
  userId: string,
  countryCode: string,
): Promise<CountryClaim & DerivedAck> {
  const claim = await api.put<ApiClaimListRow & DerivedAck>(`/api/passport/claims/${countryCode}`)
  return {
    id: claim.id,
    user_id: userId,
    country_code: claim.country_code,
    claimed_at: claim.claimed_at,
    derived_state: claim.derived_state,
    revision: claim.revision,
  }
}

export async function addGroundVisit(
  userId: string,
  countryCode: string,
  data: {
    visitYear?: number | null
    note?: string | null
    entryMethod?: EntryMethod
    mode?: GroundVisitMode
  } = {},
  visitId?: string,
): Promise<GroundVisit & DerivedAck> {
  const visit = await api.post<ApiGroundVisit>('/api/passport/ground-visits', {
    countryCode,
    ...(visitId ? { id: visitId } : {}),
    visitYear: data.visitYear ?? null,
    note: data.note ?? null,
    entryMethod: data.entryMethod ?? null,
    mode: data.mode ?? null,
  })

  return {
    ...toGroundVisit(visit, userId),
    derived_state: visit.derived_state,
    revision: visit.revision,
  }
}

export async function updateGroundVisit(
  userId: string,
  visitId: string,
  patch: {
    visitYear?: number | null
    note?: string | null
    entryMethod?: EntryMethod
    mode?: GroundVisitMode
  },
): Promise<GroundVisit & DerivedAck> {
  const visit = await api.patch<ApiGroundVisit>(`/api/passport/ground-visits/${visitId}`, patch)
  return {
    ...toGroundVisit(visit, userId),
    derived_state: visit.derived_state,
    revision: visit.revision,
  }
}

export async function deleteGroundVisit(_userId: string, visitId: string): Promise<DerivedAck> {
  return api.delete<DerivedAck>(`/api/passport/ground-visits/${visitId}`)
}

export async function unclaimCountry(_userId: string, countryCode: string): Promise<DerivedAck> {
  return api.delete<DerivedAck>(`/api/passport/claims/${countryCode}`)
}
