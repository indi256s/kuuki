import { supabase } from './supabase'
import type { Tables, TablesInsert, TablesUpdate } from './database.types'
import { isUpcomingFlight } from './geo'

export type Flight = Tables<'flights'>
export type FlightInsert = TablesInsert<'flights'>
export type FlightUpdate = TablesUpdate<'flights'>

export interface FlightFilters {
  year?: number
  airlineIata?: string
  aircraftIcao?: string
  isUpcoming?: boolean
  origin?: string
  destination?: string
}

export type SortField = 'date' | 'origin' | 'destination' | 'airline_iata' | 'aircraft_icao' | 'distance_km' | 'duration_minutes'
export type SortOrder = 'asc' | 'desc'

export interface SortConfig {
  field: SortField
  order: SortOrder
}

export interface FlightStats {
  totalFlights: number
  totalDistance: number
  countriesVisited: number
  airlinesFlown: number
  uniqueAirports: number
  upcomingFlights: number
}

/**
 * Fetch paginated flights for a user
 */
export async function getFlights(
  userId: string,
  options: {
    limit?: number
    offset?: number
    filters?: FlightFilters
    sort?: SortConfig
  } = {}
): Promise<{ flights: Flight[]; total: number }> {
  const { limit = 20, offset = 0, filters = {}, sort } = options

  let query = supabase
    .from('flights')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)

  // Apply sorting
  const sortField = sort?.field ?? 'date'
  const sortAscending = sort?.order === 'asc'
  query = query.order(sortField, { ascending: sortAscending })
  // Secondary sort by id for stable ordering
  query = query.order('id', { ascending: sortAscending })

  // Apply filters
  if (filters.year) {
    const startDate = `${filters.year}-01-01`
    const endDate = `${filters.year}-12-31`
    query = query.gte('date', startDate).lte('date', endDate)
  }

  if (filters.airlineIata) {
    query = query.eq('airline_iata', filters.airlineIata)
  }

  if (filters.aircraftIcao) {
    query = query.eq('aircraft_icao', filters.aircraftIcao)
  }

  if (filters.isUpcoming !== undefined) {
    query = query.eq('is_upcoming', filters.isUpcoming)
  }

  if (filters.origin) {
    query = query.eq('origin', filters.origin.toUpperCase())
  }

  if (filters.destination) {
    query = query.eq('destination', filters.destination.toUpperCase())
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch flights: ${error.message}`)
  }

  return {
    flights: data ?? [],
    total: count ?? 0,
  }
}

/**
 * Get a single flight by ID
 */
export async function getFlight(flightId: number): Promise<Flight | null> {
  const { data, error } = await supabase
    .from('flights')
    .select('*')
    .eq('id', flightId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw new Error(`Failed to fetch flight: ${error.message}`)
  }

  return data
}

/**
 * Create a new flight
 */
export async function createFlight(flight: Omit<FlightInsert, 'id' | 'created_at'>): Promise<Flight> {
  // Auto-detect upcoming flights
  const isUpcoming = isUpcomingFlight(flight.date)

  const { data, error } = await supabase
    .from('flights')
    .insert({
      ...flight,
      is_upcoming: isUpcoming,
      source: flight.source ?? 'manual',
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create flight: ${error.message}`)
  }

  return data
}

/**
 * Update an existing flight
 */
export async function updateFlight(flightId: number, updates: FlightUpdate): Promise<Flight> {
  // If date is being updated, recalculate is_upcoming
  const updateData: FlightUpdate = { ...updates }
  if (updates.date) {
    updateData.is_upcoming = isUpcomingFlight(updates.date)
  }

  const { data, error } = await supabase
    .from('flights')
    .update(updateData)
    .eq('id', flightId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update flight: ${error.message}`)
  }

  return data
}

/**
 * Delete a flight
 */
export async function deleteFlight(flightId: number): Promise<void> {
  const { error } = await supabase
    .from('flights')
    .delete()
    .eq('id', flightId)

  if (error) {
    throw new Error(`Failed to delete flight: ${error.message}`)
  }
}

/**
 * Delete multiple flights at once
 */
export async function deleteFlights(flightIds: number[]): Promise<number> {
  if (flightIds.length === 0) return 0

  const { error, count } = await supabase
    .from('flights')
    .delete({ count: 'exact' })
    .in('id', flightIds)

  if (error) {
    throw new Error(`Failed to delete flights: ${error.message}`)
  }

  return count ?? 0
}

/**
 * Check for duplicate flights (same date + origin + destination)
 */
export async function checkDuplicateFlight(
  userId: string,
  date: string,
  origin: string,
  destination: string,
  excludeId?: number
): Promise<boolean> {
  let query = supabase
    .from('flights')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('origin', origin)
    .eq('destination', destination)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query.limit(1)

  if (error) {
    throw new Error(`Failed to check duplicate: ${error.message}`)
  }

  return (data?.length ?? 0) > 0
}

/**
 * Get flight statistics for a user
 */
export async function getFlightStats(userId: string): Promise<FlightStats> {
  // Get all completed flights for stats (exclude upcoming)
  const { data: flights, error } = await supabase
    .from('flights')
    .select('origin, destination, distance_km, airline_iata, is_upcoming')
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to fetch flight stats: ${error.message}`)
  }

  if (!flights || flights.length === 0) {
    return {
      totalFlights: 0,
      totalDistance: 0,
      countriesVisited: 0,
      airlinesFlown: 0,
      uniqueAirports: 0,
      upcomingFlights: 0,
    }
  }

  // Separate upcoming vs completed
  const completedFlights = flights.filter(f => !f.is_upcoming)
  const upcomingFlights = flights.filter(f => f.is_upcoming)

  // Calculate stats from completed flights only
  const uniqueAirports = new Set<string>()
  const uniqueAirlines = new Set<string>()
  let totalDistance = 0

  for (const flight of completedFlights) {
    uniqueAirports.add(flight.origin)
    uniqueAirports.add(flight.destination)
    if (flight.airline_iata) {
      uniqueAirlines.add(flight.airline_iata)
    }
    totalDistance += flight.distance_km ?? 0
  }

  // Countries visited - we'd need airport data to calculate this properly
  // For now, estimate based on unique airports (rough approximation)
  // This will be replaced with proper calculation using visits table
  const countriesVisited = Math.floor(uniqueAirports.size / 3) || 0

  return {
    totalFlights: completedFlights.length,
    totalDistance: Math.round(totalDistance),
    countriesVisited,
    airlinesFlown: uniqueAirlines.size,
    uniqueAirports: uniqueAirports.size,
    upcomingFlights: upcomingFlights.length,
  }
}

/**
 * Get recent flights for dashboard display
 */
export async function getRecentFlights(userId: string, limit = 5): Promise<Flight[]> {
  const { data, error } = await supabase
    .from('flights')
    .select('*')
    .eq('user_id', userId)
    .eq('is_upcoming', false)
    .order('date', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch recent flights: ${error.message}`)
  }

  return data ?? []
}

/**
 * Get upcoming flights for dashboard display
 */
export async function getUpcomingFlights(userId: string, limit = 3): Promise<Flight[]> {
  const { data, error } = await supabase
    .from('flights')
    .select('*')
    .eq('user_id', userId)
    .eq('is_upcoming', true)
    .order('date', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch upcoming flights: ${error.message}`)
  }

  return data ?? []
}

/**
 * Get unique years from user's flights (for filter dropdown)
 */
export async function getFlightYears(userId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('flights')
    .select('date')
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to fetch flight years: ${error.message}`)
  }

  const years = new Set<number>()
  for (const flight of data ?? []) {
    years.add(new Date(flight.date).getFullYear())
  }

  return Array.from(years).sort((a, b) => b - a)
}

/**
 * Get unique airlines from user's flights (for filter dropdown)
 */
export async function getFlightAirlines(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('flights')
    .select('airline_iata')
    .eq('user_id', userId)
    .not('airline_iata', 'is', null)

  if (error) {
    throw new Error(`Failed to fetch flight airlines: ${error.message}`)
  }

  const airlines = new Set<string>()
  for (const flight of data ?? []) {
    if (flight.airline_iata) {
      airlines.add(flight.airline_iata)
    }
  }

  return Array.from(airlines).sort()
}

/**
 * Get unique aircraft from user's flights (for filter dropdown)
 */
export async function getFlightAircraft(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('flights')
    .select('aircraft_icao')
    .eq('user_id', userId)
    .not('aircraft_icao', 'is', null)

  if (error) {
    throw new Error(`Failed to fetch flight aircraft: ${error.message}`)
  }

  const aircraft = new Set<string>()
  for (const flight of data ?? []) {
    if (flight.aircraft_icao) {
      aircraft.add(flight.aircraft_icao)
    }
  }

  return Array.from(aircraft).sort()
}

/**
 * Get all flights for a user (for export)
 * No pagination - returns everything
 */
export async function getAllFlights(userId: string): Promise<Flight[]> {
  const { data, error } = await supabase
    .from('flights')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch all flights: ${error.message}`)
  }

  return data ?? []
}

/**
 * Convert upcoming flights to completed when their date has passed
 * Call this on app load or periodically
 */
export async function syncUpcomingFlights(userId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('flights')
    .update({ is_upcoming: false })
    .eq('user_id', userId)
    .eq('is_upcoming', true)
    .lte('date', today)
    .select('id')

  if (error) {
    throw new Error(`Failed to sync upcoming flights: ${error.message}`)
  }

  return data?.length ?? 0
}
