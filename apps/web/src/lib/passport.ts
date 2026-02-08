import { supabase } from './supabase'
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

/**
 * Get all passport entries for a user (combining visits from flights + manual claims)
 */
export async function getUserCountries(userId: string): Promise<PassportEntry[]> {
  // Fetch visits (from flights), country claims, and ground visits in parallel
  const [visitsResult, claimsResult, groundVisitsResult] = await Promise.all([
    supabase
      .from('visits')
      .select('country_code, first_visit, last_visit, visit_count, airport_iata')
      .eq('user_id', userId),
    supabase
      .from('country_claims')
      .select('country_code, claimed_at')
      .eq('user_id', userId),
    supabase
      .from('ground_visits')
      .select('country_code')
      .eq('user_id', userId),
  ])

  if (visitsResult.error) {
    throw new Error(`Failed to fetch visits: ${visitsResult.error.message}`)
  }
  if (claimsResult.error) {
    throw new Error(`Failed to fetch claims: ${claimsResult.error.message}`)
  }
  if (groundVisitsResult.error) {
    throw new Error(`Failed to fetch ground visits: ${groundVisitsResult.error.message}`)
  }

  const visits = visitsResult.data ?? []
  const claims = claimsResult.data ?? []
  const groundVisits = groundVisitsResult.data ?? []

  // Count ground visits per country
  const groundVisitCounts = new Map<string, number>()
  for (const gv of groundVisits) {
    groundVisitCounts.set(gv.country_code, (groundVisitCounts.get(gv.country_code) ?? 0) + 1)
  }

  // Build a map of country code -> passport entry
  const countryMap = new Map<string, PassportEntry>()

  // Process visits from flights
  for (const visit of visits) {
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
  for (const claim of claims) {
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
  const { data, error } = await supabase
    .from('country_claims')
    .select('*')
    .eq('user_id', userId)
    .order('claimed_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch claims: ${error.message}`)
  }

  return data ?? []
}

/**
 * Claim a country (upsert stamp only — no visit details)
 */
export async function claimCountry(
  userId: string,
  countryCode: string,
): Promise<CountryClaim> {
  const { data: claim, error } = await supabase
    .from('country_claims')
    .upsert({
      user_id: userId,
      country_code: countryCode,
    }, { onConflict: 'user_id,country_code' })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to claim country: ${error.message}`)
  }

  return claim
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
  const { data: visit, error } = await supabase
    .from('ground_visits')
    .insert({
      user_id: userId,
      country_code: countryCode,
      visit_year: data.visitYear ?? null,
      note: data.note ?? null,
      entry_method: data.entryMethod ?? null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to add ground visit: ${error.message}`)
  }

  return {
    id: visit.id,
    userId: visit.user_id,
    countryCode: visit.country_code,
    visitYear: visit.visit_year,
    entryMethod: visit.entry_method as EntryMethod,
    note: visit.note,
    createdAt: visit.created_at,
  }
}

/**
 * Get ground visits for a specific country
 */
export async function getGroundVisits(userId: string, countryCode: string): Promise<GroundVisit[]> {
  const { data, error } = await supabase
    .from('ground_visits')
    .select('*')
    .eq('user_id', userId)
    .eq('country_code', countryCode)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch ground visits: ${error.message}`)
  }

  return (data ?? []).map(v => ({
    id: v.id,
    userId: v.user_id,
    countryCode: v.country_code,
    visitYear: v.visit_year,
    entryMethod: v.entry_method as EntryMethod,
    note: v.note,
    createdAt: v.created_at,
  }))
}

/**
 * Delete a single ground visit
 */
export async function deleteGroundVisit(visitId: string): Promise<void> {
  const { error } = await supabase
    .from('ground_visits')
    .delete()
    .eq('id', visitId)

  if (error) {
    throw new Error(`Failed to delete ground visit: ${error.message}`)
  }
}

/**
 * Remove a claimed country (stamp + all ground visits)
 */
export async function unclaimCountry(userId: string, countryCode: string): Promise<void> {
  // Delete ground visits first, then the claim
  const { error: gvError } = await supabase
    .from('ground_visits')
    .delete()
    .eq('user_id', userId)
    .eq('country_code', countryCode)

  if (gvError) {
    throw new Error(`Failed to delete ground visits: ${gvError.message}`)
  }

  const { error } = await supabase
    .from('country_claims')
    .delete()
    .eq('user_id', userId)
    .eq('country_code', countryCode)

  if (error) {
    throw new Error(`Failed to unclaim country: ${error.message}`)
  }
}

/**
 * Get detailed stats for a specific country
 */
export async function getCountryStats(userId: string, countryCode: string): Promise<CountryStats> {
  const countryInfo = countries[countryCode]
  if (!countryInfo) {
    throw new Error(`Unknown country code: ${countryCode}`)
  }

  // Fetch visits, claim, and ground visits in parallel
  const [visitsResult, claimResult, groundVisitsResult] = await Promise.all([
    supabase
      .from('visits')
      .select('first_visit, last_visit, visit_count, airport_iata, city')
      .eq('user_id', userId)
      .eq('country_code', countryCode),
    supabase
      .from('country_claims')
      .select('id')
      .eq('user_id', userId)
      .eq('country_code', countryCode)
      .maybeSingle(),
    supabase
      .from('ground_visits')
      .select('*')
      .eq('user_id', userId)
      .eq('country_code', countryCode)
      .order('created_at', { ascending: false }),
  ])

  if (visitsResult.error) {
    throw new Error(`Failed to fetch visits: ${visitsResult.error.message}`)
  }
  if (claimResult.error) {
    throw new Error(`Failed to fetch claim: ${claimResult.error.message}`)
  }
  if (groundVisitsResult.error) {
    throw new Error(`Failed to fetch ground visits: ${groundVisitsResult.error.message}`)
  }

  const visits = visitsResult.data ?? []
  const isClaimed = !!claimResult.data
  const rawGroundVisits = groundVisitsResult.data ?? []

  // Calculate totals
  let totalVisits = 0
  let firstVisit = ''
  let lastVisit = ''

  const airportStats: Map<string, { name: string; city: string; visitCount: number }> = new Map()

  for (const visit of visits) {
    totalVisits += visit.visit_count ?? 1

    // Track first and last visits
    if (!firstVisit || visit.first_visit < firstVisit) {
      firstVisit = visit.first_visit
    }
    if (!lastVisit || visit.last_visit > lastVisit) {
      lastVisit = visit.last_visit
    }

    // Track airport visits
    if (visit.airport_iata) {
      const existing = airportStats.get(visit.airport_iata)
      if (existing) {
        existing.visitCount += visit.visit_count ?? 1
      } else {
        airportStats.set(visit.airport_iata, {
          name: visit.airport_iata,
          city: visit.city ?? '',
          visitCount: visit.visit_count ?? 1,
        })
      }
    }
  }

  // Add ground visit count
  totalVisits += rawGroundVisits.length

  // If no flights but has claim/ground visits, use current date
  if (!firstVisit && (isClaimed || rawGroundVisits.length > 0)) {
    firstVisit = new Date().toISOString()
    lastVisit = new Date().toISOString()
    if (totalVisits === 0) totalVisits = 1
  }

  const groundVisits: GroundVisit[] = rawGroundVisits.map(v => ({
    id: v.id,
    userId: v.user_id,
    countryCode: v.country_code,
    visitYear: v.visit_year,
    entryMethod: v.entry_method as EntryMethod,
    note: v.note,
    createdAt: v.created_at,
  }))

  return {
    countryCode,
    countryName: countryInfo.name,
    firstVisit,
    lastVisit,
    totalVisits,
    airports: Array.from(airportStats.entries()).map(([iata, stats]) => ({
      iata,
      name: stats.name,
      city: stats.city,
      visitCount: stats.visitCount,
    })).sort((a, b) => b.visitCount - a.visitCount),
    isClaimed,
    groundVisits,
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
export async function isCountryClaimed(userId: string, countryCode: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('country_claims')
    .select('id')
    .eq('user_id', userId)
    .eq('country_code', countryCode)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to check claim: ${error.message}`)
  }

  return !!data
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
