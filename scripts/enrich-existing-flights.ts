#!/usr/bin/env npx tsx
/**
 * One-time script to enrich existing flights with aircraft data.
 *
 * Usage:
 *   cd ~/Documents/kuuki/kuuki
 *   npx tsx scripts/enrich-existing-flights.ts
 *
 * Or with dry-run (no updates):
 *   DRY_RUN=1 npx tsx scripts/enrich-existing-flights.ts
 */

import { createClient } from '@supabase/supabase-js'

// Configuration
const SUPABASE_URL = 'https://cwmotwkvpdkfrtjxmoce.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const API_BASE = process.env.API_BASE || 'https://kuuki.pages.dev'
const BATCH_SIZE = 20
const DRY_RUN = process.env.DRY_RUN === '1'
const CONFIDENCE_THRESHOLD = 0.7

// Types
interface Flight {
  id: number
  date: string
  origin: string
  destination: string
  airline_iata: string | null
  flight_number: string | null
  aircraft_icao: string | null
}

interface FlightToEnrich {
  id: string
  flight_number: string | null
  airline_iata: string | null
  date: string
  origin: string
  destination: string
}

interface EnrichmentResult {
  flight_id: string
  aircraft_icao: string | null
  aircraft_name: string | null
  confidence: number
}

interface EnrichmentResponse {
  results: EnrichmentResult[]
  error?: string
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function fetchFlightsWithoutAircraft(): Promise<Flight[]> {
  console.log('📋 Fetching flights without aircraft data...')

  // First, get total count
  const { count: totalCount, error: countError } = await supabase
    .from('flights')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.log(`⚠️  Could not count total flights: ${countError.message}`)
  } else {
    console.log(`   Total flights in database: ${totalCount}`)
  }

  // Count flights with aircraft
  const { count: withAircraftCount, error: withError } = await supabase
    .from('flights')
    .select('*', { count: 'exact', head: true })
    .not('aircraft_icao', 'is', null)

  if (!withError && withAircraftCount !== null) {
    console.log(`   Flights with aircraft: ${withAircraftCount}`)
  }

  const { data, error } = await supabase
    .from('flights')
    .select('id, date, origin, destination, airline_iata, flight_number, aircraft_icao')
    .is('aircraft_icao', null)
    .not('airline_iata', 'is', null)
    .order('date', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch flights: ${error.message}`)
  }

  return data || []
}

async function enrichBatch(flights: FlightToEnrich[]): Promise<EnrichmentResult[]> {
  console.log(`  🔍 Enriching batch of ${flights.length} flights...`)

  const response = await fetch(`${API_BASE}/api/enrich/aircraft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flights }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Enrichment API error: ${response.status} - ${text}`)
  }

  const data: EnrichmentResponse = await response.json()

  if (data.error) {
    throw new Error(`Enrichment error: ${data.error}`)
  }

  return data.results
}

async function updateFlight(id: number, aircraft_icao: string): Promise<void> {
  if (DRY_RUN) {
    console.log(`    [DRY RUN] Would update flight ${id} with aircraft: ${aircraft_icao}`)
    return
  }

  const { error } = await supabase
    .from('flights')
    .update({ aircraft_icao })
    .eq('id', id)

  if (error) {
    console.error(`    ❌ Failed to update flight ${id}: ${error.message}`)
  }
}

async function main() {
  console.log('🚀 Starting one-time aircraft enrichment')
  console.log(`   API: ${API_BASE}`)
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no updates)' : 'LIVE'}`)
  console.log('')

  if (!SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY environment variable')
    console.error('   Set it with: export SUPABASE_SERVICE_KEY="your-key"')
    process.exit(1)
  }

  // Fetch flights
  const flights = await fetchFlightsWithoutAircraft()
  console.log(`📊 Found ${flights.length} flights without aircraft data`)

  if (flights.length === 0) {
    console.log('✅ No flights need enrichment!')
    return
  }

  // Process in batches
  let enrichedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (let i = 0; i < flights.length; i += BATCH_SIZE) {
    const batch = flights.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(flights.length / BATCH_SIZE)

    console.log(`\n📦 Batch ${batchNum}/${totalBatches}`)

    // Prepare batch for enrichment
    const flightsToEnrich: FlightToEnrich[] = batch.map(f => ({
      id: String(f.id),
      flight_number: f.flight_number,
      airline_iata: f.airline_iata,
      date: f.date,
      origin: f.origin,
      destination: f.destination,
    }))

    try {
      const results = await enrichBatch(flightsToEnrich)

      // Process results
      for (const result of results) {
        const flight = batch.find(f => String(f.id) === result.flight_id)
        if (!flight) continue

        if (result.aircraft_icao && result.confidence >= CONFIDENCE_THRESHOLD) {
          console.log(`    ✅ ${flight.airline_iata}${flight.flight_number || ''} ${flight.origin}-${flight.destination}: ${result.aircraft_icao} (${Math.round(result.confidence * 100)}%)`)
          await updateFlight(flight.id, result.aircraft_icao)
          enrichedCount++
        } else {
          console.log(`    ⏭️  ${flight.airline_iata}${flight.flight_number || ''} ${flight.origin}-${flight.destination}: skipped (confidence: ${Math.round(result.confidence * 100)}%)`)
          skippedCount++
        }
      }
    } catch (error) {
      console.error(`    ❌ Batch error: ${error instanceof Error ? error.message : error}`)
      errorCount += batch.length
    }

    // Rate limiting - wait between batches
    if (i + BATCH_SIZE < flights.length) {
      console.log('    ⏳ Waiting 2s before next batch...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 SUMMARY')
  console.log('='.repeat(50))
  console.log(`   Total flights processed: ${flights.length}`)
  console.log(`   ✅ Enriched: ${enrichedCount}`)
  console.log(`   ⏭️  Skipped (low confidence): ${skippedCount}`)
  console.log(`   ❌ Errors: ${errorCount}`)

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN - No actual updates were made')
    console.log('   Remove DRY_RUN=1 to apply changes')
  }
}

main().catch(error => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
