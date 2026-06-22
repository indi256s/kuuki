import { api } from './apiClient'
import type { Tables, TablesInsert } from './database.types'
import type { PassportEntry, CountryStats, GroundVisit, Continent, EntryMethod } from '@kuuki/shared'
import countriesData from '@kuuki/data/countries.json'

// Re-export types from database
export type CountryClaim = Tables<'country_claims'>
export type CountryClaimInsert = TablesInsert<'country_claims'>

// Type for the countries.json data
type CountryDataMap = Record<string, {
  name: string
  nativeName: string
  continent: string
  flagColors: string[]
  dominantColor: string
  stampShape: string
  timezone: string
}>

const countries = countriesData as CountryDataMap

// ---- Raw API row shapes (snake_case, as returned by /api/passport/*) ----

/** A visit row as returned by GET /api/passport/countries. */
interface ApiVisitRow {
  country_code: string
  first_visit: string
  last_visit: string
  visit_count: number | null
  airport_iata: string | null
  city?: string | null
}

/** A claim row as returned by GET /api/passport/countries (and /claims). */
interface ApiClaimRow {
  country_code: string
  claimed_at: string | null
}

/** A ground-visit-country row as returned by GET /api/passport/countries. */
interface ApiGroundVisitCountryRow {
  country_code: string
}

/** The aggregate response from GET /api/passport/countries. */
interface ApiPassportCountries {
  visits: ApiVisitRow[]
  claims: ApiClaimRow[]
  groundVisits: ApiGroundVisitCountryRow[]
}

/** A claim row as returned by GET /api/passport/claims (user_id stripped server-side). */
interface ApiClaimListRow {
  id: string
  country_code: string
  claimed_at: string | null
}

/** A ground visit DTO as returned by the API (camelCase, no userId). */
interface ApiGroundVisit {
  id: string
  countryCode: string
  visitYear: number | null
  entryMethod: string | null
  note: string | null
  createdAt: string
}

/** The CountryStats DTO as returned by GET /api/passport/countries/:cc/stats (countryName empty). */
interface ApiCountryStats {
  countryCode: string
  countryName: string
  firstVisit: string
  lastVisit: string
  totalVisits: number
  airports: Array<{ iata: string; name: string; city: string; visitCount: number }>
  isClaimed: boolean
  groundVisits: ApiGroundVisit[]
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
 * Get all passport entries for a user (combining visits from flights + manual claims)
 */
export async function getUserCountries(_userId: string): Promise<PassportEntry[]> {
  // Fetch visits (from flights), country claims, and ground visits in one call.
  const { visits, claims, groundVisits } = await api.get<ApiPassportCountries>('/api/passport/countries')

  // Count ground visits per country
  const groundVisitCounts = new Map<string, number>()
  for (const gv of groundVisits ?? []) {
    groundVisitCounts.set(gv.country_code, (groundVisitCounts.get(gv.country_code) ?? 0) + 1)
  }

  // Build a map of country code -> passport entry
  const countryMap = new Map<string, PassportEntry>()

  // Process visits from flights
  for (const visit of visits ?? []) {
    const countryCode = visit.country_code
    const countryInfo = countries[countryCode]
    if (!countryInfo) continue // Skip unknown countries

    const existing = countryMap.get(countryCode)
    if (existing) {
      // Update existing entry
      existing.visitCount += visit.visit_count ?? 1
      if (visit.airport_iata && !existing.airports.includes(visit.airport_iata)) {
        existing.airports.push(visit.airport_iata)
      }
      // Update first/last visit dates
      if (visit.first_visit < existing.firstVisit) {
        existing.firstVisit = visit.first_visit
      }
      if (visit.last_visit > existing.lastVisit) {
        existing.lastVisit = visit.last_visit
      }
    } else {
      countryMap.set(countryCode, {
        countryCode,
        countryName: countryInfo.name,
        nativeName: countryInfo.nativeName,
        continent: countryInfo.continent as Continent,
        stampShape: countryInfo.stampShape as 'circle' | 'rectangle',
        dominantColor: countryInfo.dominantColor,
        flagColors: countryInfo.flagColors,
        firstVisit: visit.first_visit,
        lastVisit: visit.last_visit,
        visitCount: visit.visit_count ?? 1,
        source: 'flight',
        airports: visit.airport_iata ? [visit.airport_iata] : [],
      })
    }
  }

  // Process manual claims
  for (const claim of claims ?? []) {
    const countryCode = claim.country_code
    const countryInfo = countries[countryCode]
    if (!countryInfo) continue

    const existing = countryMap.get(countryCode)
    if (existing) {
      // Country was also visited by flight - mark as 'both'
      existing.source = 'both'
      // Add ground visit count
      existing.visitCount += groundVisitCounts.get(countryCode) ?? 0
      // If claim is older, update first visit
      if (claim.claimed_at && claim.claimed_at < existing.firstVisit) {
        existing.firstVisit = claim.claimed_at
      }
    } else {
      // Country only from claim
      const gvCount = groundVisitCounts.get(countryCode) ?? 0
      countryMap.set(countryCode, {
        countryCode,
        countryName: countryInfo.name,
        nativeName: countryInfo.nativeName,
        continent: countryInfo.continent as Continent,
        stampShape: countryInfo.stampShape as 'circle' | 'rectangle',
        dominantColor: countryInfo.dominantColor,
        flagColors: countryInfo.flagColors,
        firstVisit: claim.claimed_at ?? new Date().toISOString(),
        lastVisit: claim.claimed_at ?? new Date().toISOString(),
        visitCount: Math.max(1, gvCount),
        source: 'claim',
        airports: [],
      })
    }
  }

  // Convert to array and sort by first visit (oldest first for chronological display)
  return Array.from(countryMap.values()).sort(
    (a, b) => new Date(a.firstVisit).getTime() - new Date(b.firstVisit).getTime()
  )
}

/**
 * Get all manual country claims for a user
 */
export async function getUserClaims(userId: string): Promise<CountryClaim[]> {
  const rows = await api.get<ApiClaimListRow[]>('/api/passport/claims')
  // The API strips user_id; refill it so the CountryClaim (Tables row) shape stays intact.
  return (rows ?? []).map((row) => ({
    id: row.id,
    user_id: userId,
    country_code: row.country_code,
    claimed_at: row.claimed_at,
  }))
}

/**
 * Claim a country (upsert stamp only — no visit details)
 */
export async function claimCountry(
  userId: string,
  countryCode: string,
): Promise<CountryClaim> {
  const claim = await api.put<ApiClaimListRow>(`/api/passport/claims/${countryCode}`)
  // The API strips user_id; refill it so the CountryClaim (Tables row) shape stays intact.
  return {
    id: claim.id,
    user_id: userId,
    country_code: claim.country_code,
    claimed_at: claim.claimed_at,
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
  } = {}
): Promise<GroundVisit> {
  const visit = await api.post<ApiGroundVisit>('/api/passport/ground-visits', {
    countryCode,
    visitYear: data.visitYear ?? null,
    note: data.note ?? null,
    entryMethod: data.entryMethod ?? null,
  })

  return toGroundVisit(visit, userId)
}

/**
 * Get ground visits for a specific country
 */
export async function getGroundVisits(userId: string, countryCode: string): Promise<GroundVisit[]> {
  const visits = await api.get<ApiGroundVisit[]>('/api/passport/ground-visits', { countryCode })
  return (visits ?? []).map((v) => toGroundVisit(v, userId))
}

/**
 * Delete a single ground visit
 */
export async function deleteGroundVisit(_userId: string, visitId: string): Promise<void> {
  await api.delete<{ ok: boolean }>(`/api/passport/ground-visits/${visitId}`)
}

/**
 * Remove a claimed country (stamp + all ground visits)
 */
export async function unclaimCountry(_userId: string, countryCode: string): Promise<void> {
  await api.delete<{ ok: boolean }>(`/api/passport/claims/${countryCode}`)
}

/**
 * Get detailed stats for a specific country
 */
export async function getCountryStats(userId: string, countryCode: string): Promise<CountryStats> {
  const countryInfo = countries[countryCode]
  if (!countryInfo) {
    throw new Error(`Unknown country code: ${countryCode}`)
  }

  const stats = await api.get<ApiCountryStats>(`/api/passport/countries/${countryCode}/stats`)

  let firstVisit = stats.firstVisit
  let lastVisit = stats.lastVisit
  let totalVisits = stats.totalVisits

  // If no flights but has claim/ground visits, use current date
  if (!firstVisit && (stats.isClaimed || stats.groundVisits.length > 0)) {
    firstVisit = new Date().toISOString()
    lastVisit = new Date().toISOString()
    if (totalVisits === 0) totalVisits = 1
  }

  return {
    countryCode,
    countryName: countryInfo.name,
    firstVisit,
    lastVisit,
    totalVisits,
    airports: stats.airports,
    isClaimed: stats.isClaimed,
    groundVisits: (stats.groundVisits ?? []).map((v) => toGroundVisit(v, userId)),
  }
}

/**
 * Get passport summary stats
 */
export async function getPassportStats(userId: string): Promise<{
  countriesCount: number
  continentsCount: number
  flightCountries: number
  groundCountries: number
  newThisYear: number
  lastStamp: {
    countryCode: string
    countryName: string
    date: string
  } | null
}> {
  const entries = await getUserCountries(userId)

  const continents = new Set(entries.map(e => e.continent))
  const currentYear = new Date().getFullYear()

  let flightCountries = 0
  let groundCountries = 0
  let newThisYear = 0
  let lastStamp: { countryCode: string; countryName: string; date: string } | null = null
  let latestDate = ''

  for (const entry of entries) {
    // Count by source
    if (entry.source === 'flight') {
      flightCountries++
    } else if (entry.source === 'claim') {
      groundCountries++
    } else {
      // 'both' — count as flight since it was also reached by air
      flightCountries++
    }

    // New this year
    const firstVisitYear = new Date(entry.firstVisit).getFullYear()
    if (firstVisitYear === currentYear) {
      newThisYear++
    }

    // Last stamp (most recent lastVisit)
    if (entry.lastVisit > latestDate) {
      latestDate = entry.lastVisit
      lastStamp = {
        countryCode: entry.countryCode,
        countryName: entry.countryName,
        date: entry.lastVisit,
      }
    }
  }

  return {
    countriesCount: entries.length,
    continentsCount: continents.size,
    flightCountries,
    groundCountries,
    newThisYear,
    lastStamp,
  }
}

/**
 * Check if a country is already claimed by the user
 */
export async function isCountryClaimed(_userId: string, countryCode: string): Promise<boolean> {
  const data = await api.get<{ exists: boolean }>(`/api/passport/claims/${countryCode}/exists`)
  return !!data.exists
}

/**
 * Get all country data (for map display)
 */
export function getAllCountries(): CountryDataMap {
  return countries
}

/**
 * Get country data by code
 */
export function getCountryByCode(countryCode: string) {
  return countries[countryCode] ?? null
}
