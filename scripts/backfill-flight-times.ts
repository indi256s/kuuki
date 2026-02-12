#!/usr/bin/env npx tsx
/**
 * One-time script to backfill departure/arrival times for existing flights.
 *
 * Strategy:
 * 1. AirLabs Routes API (primary) — for flights with flight numbers
 *    Returns scheduled dep_time/arr_time in local HH:MM format
 * 2. Gemini with web search (fallback) — for flights without flight numbers
 *    or when AirLabs has no data
 * 3. Calculates duration_minutes, departure_utc, arrival_utc inline using
 *    timezone-aware logic (same algorithm as geo.ts)
 *
 * Usage:
 *   export SUPABASE_SERVICE_KEY="your-key"
 *   export GEMINI_API_KEY="your-key"
 *   npx tsx scripts/backfill-flight-times.ts
 *
 * Dry run (no DB updates):
 *   DRY_RUN=1 npx tsx scripts/backfill-flight-times.ts
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI, Type } from '@google/genai'

// ─── Configuration ───────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://cwmotwkvpdkfrtjxmoce.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const AIRLABS_API_KEY = process.env.AIRLABS_API_KEY || '2ce38033-3fcb-47db-8b4b-151974f9db6f'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

const DRY_RUN = process.env.DRY_RUN === '1'
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '50', 10)
const BATCH_PAUSE_MS = parseInt(process.env.BATCH_PAUSE_MS || '1000', 10)
const AIRLABS_DELAY_MS = 350 // ~3 req/s to stay well under limits
const GEMINI_BATCH_SIZE = 10
const GEMINI_DELAY_MS = 2000

// ─── Types ───────────────────────────────────────────────────────────────────

interface FlightRow {
  id: number
  date: string
  flight_number: string | null
  airline_iata: string | null
  origin: string
  destination: string
  departure_time: string | null
  arrival_time: string | null
  origin_tz: string | null
  dest_tz: string | null
  duration_minutes: number | null
}

interface AirLabsRoute {
  dep_time: string | null
  arr_time: string | null
  dep_iata: string
  arr_iata: string
  aircraft_icao: string | null
  duration: number | null
}

interface TimeResult {
  departure_time: string // HH:MM
  arrival_time: string // HH:MM
  source: 'airlabs' | 'gemini'
}

// ─── Stats ───────────────────────────────────────────────────────────────────

const stats = {
  total: 0,
  airlabsHits: 0,
  airlabsMisses: 0,
  airlabsErrors: 0,
  geminiHits: 0,
  geminiMisses: 0,
  geminiErrors: 0,
  updated: 0,
  skipped: 0,
  alreadyHas: 0,
}

// ─── Supabase client ─────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── AirLabs Routes API ──────────────────────────────────────────────────────

const airLabsCache = new Map<string, AirLabsRoute[] | null>()

function buildRouteKey(flight: FlightRow): string | null {
  if (!flight.flight_number || !flight.airline_iata) return null
  return `${flight.airline_iata}${flight.flight_number}`
}

async function queryAirLabsRoutes(flightIata: string): Promise<AirLabsRoute[] | null> {
  // Check in-memory cache
  if (airLabsCache.has(flightIata)) {
    return airLabsCache.get(flightIata)!
  }

  const url = `https://airlabs.co/api/v9/routes?flight_iata=${encodeURIComponent(flightIata)}&api_key=${AIRLABS_API_KEY}`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`  AirLabs HTTP ${res.status} for ${flightIata}`)
      airLabsCache.set(flightIata, null)
      return null
    }

    const data = await res.json() as { response: AirLabsRoute[] }
    const routes = data.response

    if (!routes || routes.length === 0) {
      airLabsCache.set(flightIata, null)
      return null
    }

    airLabsCache.set(flightIata, routes)
    return routes
  } catch (err) {
    console.error(`  AirLabs error for ${flightIata}:`, err instanceof Error ? err.message : err)
    airLabsCache.set(flightIata, null)
    return null
  }
}

function findMatchingRoute(routes: AirLabsRoute[], origin: string, destination: string): AirLabsRoute | null {
  // Exact match on origin/destination
  const exact = routes.find(r => r.dep_iata === origin && r.arr_iata === destination)
  if (exact) return exact

  // Fallback: first route (usually there's only one for a flight number)
  return routes[0] || null
}

async function tryAirLabs(flight: FlightRow): Promise<TimeResult | null> {
  const flightIata = buildRouteKey(flight)
  if (!flightIata) return null

  const routes = await queryAirLabsRoutes(flightIata)
  if (!routes) {
    stats.airlabsMisses++
    return null
  }

  const route = findMatchingRoute(routes, flight.origin, flight.destination)
  if (!route || !route.dep_time || !route.arr_time) {
    stats.airlabsMisses++
    return null
  }

  // AirLabs returns times like "14:30" or "02:50"
  const depTime = route.dep_time.slice(0, 5) // ensure HH:MM
  const arrTime = route.arr_time.slice(0, 5)

  if (!/^\d{2}:\d{2}$/.test(depTime) || !/^\d{2}:\d{2}$/.test(arrTime)) {
    stats.airlabsMisses++
    return null
  }

  stats.airlabsHits++
  return { departure_time: depTime, arrival_time: arrTime, source: 'airlabs' }
}

// ─── Gemini fallback ─────────────────────────────────────────────────────────

const GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.NUMBER, description: 'Flight index from the input list (1-based)' },
          departure_time: { type: Type.STRING, description: 'Local departure time in HH:MM format', nullable: true },
          arrival_time: { type: Type.STRING, description: 'Local arrival time in HH:MM format', nullable: true },
          confidence: { type: Type.NUMBER, description: 'Confidence score between 0 and 1' },
        },
        required: ['index', 'confidence'],
      },
    },
  },
  required: ['results'],
}

function buildGeminiPrompt(flights: FlightRow[]): string {
  const lines = flights.map((f, i) => {
    const flightId = f.flight_number
      ? `${f.airline_iata || ''}${f.flight_number}`
      : `${f.airline_iata || 'Unknown'} flight`
    return `${i + 1}. ${flightId} ${f.origin}-${f.destination} ${f.date}`
  }).join('\n')

  return `You are an aviation schedule expert. For each flight below, find the scheduled local departure and arrival times.

IMPORTANT NOTES:
- Return times in the LOCAL timezone of each airport (departure time in origin timezone, arrival time in destination timezone)
- Use HH:MM format (24-hour)
- These are HISTORICAL flights, so look up the actual scheduled times for the specific date given
- If a flight number operates at different times on different days, find the time for the specific date

Flights:
${lines}

Confidence scoring:
- 0.9-1.0: Found exact schedule from reliable source (airline website, FlightAware, etc.)
- 0.7-0.89: Found likely schedule but not 100% certain of the exact date
- Below 0.7: Cannot determine with confidence → return null times

Return ONLY a JSON object (no markdown, no explanation) with this exact structure:
{"results": [{"index": 1, "departure_time": "HH:MM", "arrival_time": "HH:MM", "confidence": 0.9}, ...]}`
}

let geminiClient: GoogleGenAI | null = null

async function tryGeminiBatch(flights: FlightRow[]): Promise<Map<number, TimeResult>> {
  const results = new Map<number, TimeResult>()

  if (!GEMINI_API_KEY) {
    console.log('  No GEMINI_API_KEY, skipping Gemini fallback')
    return results
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  }

  const prompt = buildGeminiPrompt(flights)

  try {
    // Note: Gemini doesn't support responseSchema + googleSearch together,
    // so we use googleSearch for grounding and parse JSON from text output
    const response = await geminiClient.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    })

    const text = response.text
    if (!text) {
      console.error('  Gemini returned empty response')
      stats.geminiErrors++
      return results
    }

    // Extract JSON from text (may be wrapped in ```json ... ``` blocks)
    let jsonStr = text
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    } else {
      // Try to find raw JSON object
      const braceMatch = text.match(/\{[\s\S]*\}/)
      if (braceMatch) jsonStr = braceMatch[0]
    }

    const parsed: {
      results: Array<{
        index: number
        departure_time: string | null
        arrival_time: string | null
        confidence: number
      }>
    } = JSON.parse(jsonStr)

    for (const r of parsed.results) {
      const flightIndex = r.index - 1 // convert 1-based to 0-based
      if (flightIndex < 0 || flightIndex >= flights.length) continue

      const flight = flights[flightIndex]

      if (r.departure_time && r.arrival_time && r.confidence >= 0.7) {
        const depTime = r.departure_time.slice(0, 5)
        const arrTime = r.arrival_time.slice(0, 5)

        if (/^\d{2}:\d{2}$/.test(depTime) && /^\d{2}:\d{2}$/.test(arrTime)) {
          results.set(flight.id, { departure_time: depTime, arrival_time: arrTime, source: 'gemini' })
          stats.geminiHits++
        } else {
          stats.geminiMisses++
        }
      } else {
        stats.geminiMisses++
      }
    }
  } catch (err) {
    console.error('  Gemini error:', err instanceof Error ? err.message : err)
    stats.geminiErrors++
  }

  return results
}

// ─── Timezone-aware duration calculation ─────────────────────────────────────
// Same algorithm as apps/web/src/lib/geo.ts:calculateFlightDuration

function localTimeToUtcMs(
  date: string,
  hours: number,
  minutes: number,
  timeZone: string,
): number | null {
  try {
    const [year, month, day] = date.split('-').map(Number)
    const naiveUtcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0)

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    const parts = formatter.formatToParts(new Date(naiveUtcMs))
    const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10)

    const tzHour = get('hour') === 24 ? 0 : get('hour')
    const tzMs = Date.UTC(get('year'), get('month') - 1, get('day'), tzHour, get('minute'), 0, 0)
    const offsetMs = tzMs - naiveUtcMs

    return naiveUtcMs - offsetMs
  } catch {
    return null
  }
}

function calculateDuration(
  depTime: string,
  arrTime: string,
  date: string,
  originTz: string | null,
  destTz: string | null,
): number | null {
  const depParts = depTime.split(':').map(Number)
  const arrParts = arrTime.split(':').map(Number)
  if (depParts.length < 2 || arrParts.length < 2) return null

  if (originTz && destTz) {
    const depUtc = localTimeToUtcMs(date, depParts[0], depParts[1], originTz)
    let arrUtc = localTimeToUtcMs(date, arrParts[0], arrParts[1], destTz)
    if (depUtc === null || arrUtc === null) return null

    if (arrUtc <= depUtc) arrUtc += 24 * 60 * 60 * 1000
    const mins = Math.round((arrUtc - depUtc) / 60000)
    if (mins > 0 && mins <= 24 * 60) return mins
  }

  // Fallback: naive local-time subtraction
  const depMins = depParts[0] * 60 + depParts[1]
  let arrMins = arrParts[0] * 60 + arrParts[1]
  if (arrMins <= depMins) arrMins += 24 * 60
  return arrMins - depMins
}

function toUtcIso(date: string, time: string, tz: string): string | null {
  const parts = time.split(':').map(Number)
  if (parts.length < 2) return null
  const ms = localTimeToUtcMs(date, parts[0], parts[1], tz)
  if (ms === null) return null
  return new Date(ms).toISOString()
}

// ─── Database update ─────────────────────────────────────────────────────────

async function updateFlightTimes(
  flight: FlightRow,
  depTime: string,
  arrTime: string,
): Promise<boolean> {
  if (DRY_RUN) {
    return true
  }

  // Calculate duration and UTC timestamps
  const duration = calculateDuration(depTime, arrTime, flight.date, flight.origin_tz, flight.dest_tz)
  const departureUtc = flight.origin_tz ? toUtcIso(flight.date, depTime, flight.origin_tz) : null
  // For arrival UTC, if the naive UTC is before departure, it's next day
  let arrivalUtc: string | null = null
  if (flight.dest_tz) {
    arrivalUtc = toUtcIso(flight.date, arrTime, flight.dest_tz)
    if (arrivalUtc && departureUtc && arrivalUtc <= departureUtc) {
      // Next day: add 24h
      const nextDay = new Date(flight.date)
      nextDay.setDate(nextDay.getDate() + 1)
      const nextDateStr = nextDay.toISOString().split('T')[0]
      arrivalUtc = toUtcIso(nextDateStr, arrTime, flight.dest_tz)
    }
  }

  const update: Record<string, unknown> = {
    departure_time: depTime,
    arrival_time: arrTime,
  }

  if (duration !== null) update.duration_minutes = duration
  if (departureUtc) update.departure_utc = departureUtc
  if (arrivalUtc) update.arrival_utc = arrivalUtc

  const { error } = await supabase
    .from('flights')
    .update(update)
    .eq('id', flight.id)
    .select()

  if (error) {
    console.error(`  Failed to update flight ${flight.id}: ${error.message}`)
    return false
  }

  return true
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Flight Times Backfill ===')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Batch size: ${BATCH_SIZE} (pause ${BATCH_PAUSE_MS}ms between batches)`)
  console.log(`AirLabs: ${AIRLABS_API_KEY ? 'configured' : 'MISSING'}`)
  console.log(`Gemini: ${GEMINI_API_KEY ? 'configured' : 'not configured (fallback disabled)'}`)
  console.log('')

  if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_KEY environment variable')
    process.exit(1)
  }

  // Fetch flights missing times
  console.log('Fetching flights missing departure/arrival times...')
  const { data: flights, error } = await supabase
    .from('flights')
    .select('id, date, flight_number, airline_iata, origin, destination, departure_time, arrival_time, origin_tz, dest_tz, duration_minutes')
    .or('departure_time.is.null,arrival_time.is.null')
    .order('date', { ascending: false })

  if (error) {
    console.error('Failed to fetch flights:', error.message)
    process.exit(1)
  }

  if (!flights || flights.length === 0) {
    console.log('No flights need backfilling!')
    return
  }

  stats.total = flights.length
  console.log(`Found ${flights.length} flights to backfill\n`)

  // Deduplicate by route key for AirLabs (same flight number = same schedule)
  const routeKeyToFlights = new Map<string, FlightRow[]>()
  const noFlightNumberFlights: FlightRow[] = []

  for (const flight of flights as FlightRow[]) {
    // Skip flights that already have both times
    if (flight.departure_time && flight.arrival_time) {
      stats.alreadyHas++
      continue
    }

    const key = buildRouteKey(flight)
    if (key) {
      const group = routeKeyToFlights.get(key)
      if (group) group.push(flight)
      else routeKeyToFlights.set(key, [flight])
    } else {
      noFlightNumberFlights.push(flight)
    }
  }

  const uniqueRoutes = Array.from(routeKeyToFlights.keys())
  console.log(`Routes with flight numbers: ${uniqueRoutes.length} unique (covering ${flights.length - noFlightNumberFlights.length - stats.alreadyHas} flights)`)
  console.log(`Flights without flight numbers: ${noFlightNumberFlights.length}`)
  if (stats.alreadyHas > 0) {
    console.log(`Already have both times: ${stats.alreadyHas}`)
  }
  console.log('')

  // ─── Phase 1: AirLabs Routes API ────────────────────────────────────────

  console.log('--- Phase 1: AirLabs Routes API ---\n')

  const geminiQueue: FlightRow[] = [...noFlightNumberFlights] // start with flights that can't use AirLabs

  // Process AirLabs routes in batches to avoid OOM
  for (let batchStart = 0; batchStart < uniqueRoutes.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, uniqueRoutes.length)
    const batchRoutes = uniqueRoutes.slice(batchStart, batchEnd)
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(uniqueRoutes.length / BATCH_SIZE)

    if (totalBatches > 1) {
      console.log(`\n[Batch ${batchNum}/${totalBatches}] Routes ${batchStart + 1}-${batchEnd} of ${uniqueRoutes.length}`)
    }

    for (let i = 0; i < batchRoutes.length; i++) {
      const globalIndex = batchStart + i
      const flightIata = batchRoutes[i]
      const flightGroup = routeKeyToFlights.get(flightIata)!
      const sample = flightGroup[0]

      process.stdout.write(`[${globalIndex + 1}/${uniqueRoutes.length}] ${flightIata} ${sample.origin}-${sample.destination}... `)

      const result = await tryAirLabs(sample)

      if (result) {
        console.log(`${result.departure_time}-${result.arrival_time}`)

        // Apply to all flights in this group
        for (const flight of flightGroup) {
          // If flight already has one time, only fill the missing one
          const depTime = flight.departure_time || result.departure_time
          const arrTime = flight.arrival_time || result.arrival_time

          const ok = await updateFlightTimes(flight, depTime, arrTime)
          if (ok) {
            stats.updated++
            if (DRY_RUN) {
              console.log(`  [DRY RUN] Would update flight ${flight.id} (${flight.date}): ${depTime}-${arrTime}`)
            }
          }
        }
      } else {
        console.log('no data')
        // Queue all flights in this group for Gemini
        geminiQueue.push(...flightGroup)
      }

      // Rate limit
      if (globalIndex < uniqueRoutes.length - 1) {
        await sleep(AIRLABS_DELAY_MS)
      }
    }

    // Pause between batches to let GC run and avoid OOM
    if (batchEnd < uniqueRoutes.length) {
      console.log(`  Pausing ${BATCH_PAUSE_MS}ms between batches...`)
      // Clear AirLabs cache for processed routes to free memory
      for (const route of batchRoutes) {
        airLabsCache.delete(route)
      }
      await sleep(BATCH_PAUSE_MS)
    }
  }

  // Clear remaining cache
  airLabsCache.clear()

  console.log(`\nAirLabs: ${stats.airlabsHits} hits, ${stats.airlabsMisses} misses, ${stats.airlabsErrors} errors`)

  // ─── Phase 2: Gemini fallback ───────────────────────────────────────────

  if (geminiQueue.length > 0 && GEMINI_API_KEY) {
    console.log(`\n--- Phase 2: Gemini Fallback (${geminiQueue.length} flights) ---\n`)

    for (let i = 0; i < geminiQueue.length; i += GEMINI_BATCH_SIZE) {
      const batch = geminiQueue.slice(i, i + GEMINI_BATCH_SIZE)
      const batchNum = Math.floor(i / GEMINI_BATCH_SIZE) + 1
      const totalBatches = Math.ceil(geminiQueue.length / GEMINI_BATCH_SIZE)

      console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} flights)`)

      const results = await tryGeminiBatch(batch)

      for (const flight of batch) {
        const result = results.get(flight.id)
        if (result) {
          const depTime = flight.departure_time || result.departure_time
          const arrTime = flight.arrival_time || result.arrival_time

          const ok = await updateFlightTimes(flight, depTime, arrTime)
          if (ok) {
            stats.updated++
            const flightId = flight.flight_number
              ? `${flight.airline_iata}${flight.flight_number}`
              : `${flight.airline_iata} flight`
            if (DRY_RUN) {
              console.log(`  [DRY RUN] Would update ${flightId} ${flight.origin}-${flight.destination} (${flight.date}): ${depTime}-${arrTime}`)
            } else {
              console.log(`  Updated ${flightId} ${flight.origin}-${flight.destination}: ${depTime}-${arrTime}`)
            }
          }
        } else {
          stats.skipped++
          const flightId = flight.flight_number
            ? `${flight.airline_iata}${flight.flight_number}`
            : `${flight.airline_iata} flight`
          console.log(`  Skipped ${flightId} ${flight.origin}-${flight.destination} (${flight.date}) — no data`)
        }
      }

      // Rate limit between batches
      if (i + GEMINI_BATCH_SIZE < geminiQueue.length) {
        console.log(`  Waiting ${GEMINI_DELAY_MS / 1000}s...`)
        await sleep(GEMINI_DELAY_MS)
      }
    }
  } else if (geminiQueue.length > 0) {
    console.log(`\nSkipping ${geminiQueue.length} flights (no GEMINI_API_KEY)`)
    stats.skipped += geminiQueue.length
  }

  // ─── Phase 3: Note about user stats ──────────────────────────────────────

  if (stats.updated > 0 && !DRY_RUN) {
    console.log('\nDurations calculated inline with timezone-aware logic.')
    console.log('NOTE: Run the user_stats refresh SQL after this script completes.')
    console.log('The script will print the SQL below for convenience.')
  }

  // ─── Summary ────────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(50))
  console.log('SUMMARY')
  console.log('='.repeat(50))
  console.log(`Total flights processed: ${stats.total}`)
  console.log(`Already had both times:  ${stats.alreadyHas}`)
  console.log(`Updated:                 ${stats.updated}`)
  console.log(`  AirLabs routes found:  ${stats.airlabsHits} (of ${uniqueRoutes.length} unique)`)
  console.log(`  Gemini resolved:       ${stats.geminiHits}`)
  console.log(`Skipped (no data):       ${stats.skipped}`)
  console.log(`AirLabs no data:         ${stats.airlabsMisses}`)
  console.log(`Errors:                  ${stats.airlabsErrors + stats.geminiErrors}`)

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No actual updates were made')
    console.log('Remove DRY_RUN=1 to apply changes')
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
