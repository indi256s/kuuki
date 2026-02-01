import { supabase } from './supabase'
import type { Tables, TablesInsert } from './database.types'
import type { PassportEntry, CountryStats, Continent, EntryMethod } from '@kuuki/shared'
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
  // Fetch visits (from flights) and country claims in parallel
  const [visitsResult, claimsResult] = await Promise.all([
    supabase
      .from('visits')
      .select('country_code, first_visit, last_visit, visit_count, airport_iata')
      .eq('user_id', userId),
    supabase
      .from('country_claims')
      .select('country_code, claimed_at')
      .eq('user_id', userId),
  ])

  if (visitsResult.error) {
    throw new Error(`Failed to fetch visits: ${visitsResult.error.message}`)
  }
  if (claimsResult.error) {
    throw new Error(`Failed to fetch claims: ${claimsResult.error.message}`)
  }

  const visits = visitsResult.data ?? []
  const claims = claimsResult.data ?? []

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
      // If claim is older, update first visit
      if (claim.claimed_at && claim.claimed_at < existing.firstVisit) {
        existing.firstVisit = claim.claimed_at
      }
    } else {
      // Country only from claim
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
        visitCount: 1,
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
 * Claim a country manually (for ground travel)
 */
export async function claimCountry(
  userId: string,
  countryCode: string,
  data: {
    visitYear?: number | null
    note?: string | null
    entryMethod?: EntryMethod
  } = {}
): Promise<CountryClaim> {
  const { data: claim, error } = await supabase
    .from('country_claims')
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
    if (error.code === '23505') {
      throw new Error('You have already claimed this country')
    }
    throw new Error(`Failed to claim country: ${error.message}`)
  }

  return claim
}

/**
 * Update a country claim
 */
export async function updateClaim(
  claimId: string,
  updates: {
    visitYear?: number | null
    note?: string | null
    entryMethod?: EntryMethod
  }
): Promise<CountryClaim> {
  const { data, error } = await supabase
    .from('country_claims')
    .update({
      visit_year: updates.visitYear,
      note: updates.note,
      entry_method: updates.entryMethod,
    })
    .eq('id', claimId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update claim: ${error.message}`)
  }

  return data
}

/**
 * Remove a claimed country
 */
export async function unclaimCountry(userId: string, countryCode: string): Promise<void> {
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

  // Fetch visits and claims in parallel
  const [visitsResult, claimResult] = await Promise.all([
    supabase
      .from('visits')
      .select('first_visit, last_visit, visit_count, airport_iata, city')
      .eq('user_id', userId)
      .eq('country_code', countryCode),
    supabase
      .from('country_claims')
      .select('note, entry_method')
      .eq('user_id', userId)
      .eq('country_code', countryCode)
      .maybeSingle(),
  ])

  if (visitsResult.error) {
    throw new Error(`Failed to fetch visits: ${visitsResult.error.message}`)
  }
  if (claimResult.error) {
    throw new Error(`Failed to fetch claim: ${claimResult.error.message}`)
  }

  const visits = visitsResult.data ?? []
  const claim = claimResult.data

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
          name: visit.airport_iata, // Would need airport data for full name
          city: visit.city ?? '',
          visitCount: visit.visit_count ?? 1,
        })
      }
    }
  }

  // If no flights but has claim, use claim date
  if (!firstVisit && claim) {
    firstVisit = new Date().toISOString()
    lastVisit = new Date().toISOString()
    totalVisits = 1
  }

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
    note: claim?.note ?? null,
    entryMethod: (claim?.entry_method as EntryMethod) ?? null,
  }
}

/**
 * Get passport summary stats
 */
export async function getPassportStats(userId: string): Promise<{
  countriesCount: number
  continentsCount: number
  worldCompletion: number
}> {
  const entries = await getUserCountries(userId)

  const continents = new Set(entries.map(e => e.continent))

  return {
    countriesCount: entries.length,
    continentsCount: continents.size,
    worldCompletion: Math.round((entries.length / 249) * 100 * 100) / 100, // 2 decimal places
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
