// Shared types and utilities for import API

export type EnrichmentStatus = 'pending' | 'enriched' | 'failed' | 'skipped'

// ============================================================================
// Async Job System (KV-backed for persistence across Worker instances)
// ============================================================================

export type JobStatus = 'processing' | 'completed' | 'failed'
export type JobType = 'parse' | 'enrichment'

export interface ImportJob {
  id: string
  type: JobType
  status: JobStatus
  createdAt: number
  flights?: ExtractedFlight[]
  error?: string
  // Diagnostic info
  rejected?: RejectedFlight[]
  gemini_count?: number
  cleaned_text?: string
}

// KV TTL in seconds (10 minutes)
const JOB_TTL_SECONDS = 10 * 60

// KV-backed job functions
export async function createJob(kv: KVNamespace, type: JobType = 'parse'): Promise<ImportJob> {
  const id = crypto.randomUUID()
  const job: ImportJob = {
    id,
    type,
    status: 'processing',
    createdAt: Date.now(),
  }
  await kv.put(`job:${id}`, JSON.stringify(job), { expirationTtl: JOB_TTL_SECONDS })
  return job
}

export async function getJob(kv: KVNamespace, id: string): Promise<ImportJob | undefined> {
  const data = await kv.get(`job:${id}`)
  if (!data) return undefined
  return JSON.parse(data) as ImportJob
}

export async function updateJob(kv: KVNamespace, id: string, updates: Partial<ImportJob>): Promise<void> {
  const job = await getJob(kv, id)
  if (job) {
    const updated = { ...job, ...updates }
    await kv.put(`job:${id}`, JSON.stringify(updated), { expirationTtl: JOB_TTL_SECONDS })
  }
}

// Threshold for async mode
export const ASYNC_THRESHOLD = 10

export interface ExtractedFlight {
  date: string // YYYY-MM-DD
  origin: string // IATA code
  destination: string // IATA code
  airline_iata: string // IATA code
  flight_number?: string
  aircraft_icao?: string
  departure_time?: string // HH:mm
  arrival_time?: string // HH:mm
  confidence: number // 0-1 overall confidence
  enrichment_status?: EnrichmentStatus // Aircraft enrichment state
  field_confidence?: {
    date?: number
    date_year_explicit?: boolean // true if year was in source, false if inferred
    origin?: number
    destination?: number
    airline_iata?: number
    flight_number?: number
    aircraft_icao?: number
    departure_time?: number
    arrival_time?: number
  }
}

export interface ParseRequest {
  type: 'pdf' | 'image' | 'text'
  content: string // base64 for pdf/image, plain text for text
}

export interface RejectedFlight {
  index: number
  date?: string
  origin?: string
  destination?: string
  airline_iata?: string
  reason: string
}

export type EnrichmentStatusType = 'pending' | 'completed' | 'failed'

export interface ParseResponse {
  flights: ExtractedFlight[]
  raw_text?: string
  error?: string
  // Diagnostic info for debugging
  rejected?: RejectedFlight[]
  gemini_count?: number // How many flights Gemini found before validation
  cleaned_text?: string // Normalized text from Stage 1 (text input only)
  // Legacy async mode fields (for backwards compatibility)
  jobId?: string
  status?: JobStatus
  // Two-phase import fields
  enrichmentJobId?: string // Job ID for polling enrichment status
  enrichmentStatus?: EnrichmentStatusType // 'pending' | 'completed' | 'failed'
}

export function getMimeType(type: 'pdf' | 'image' | 'text'): string {
  switch (type) {
    case 'pdf':
      return 'application/pdf'
    case 'image':
      return 'image/jpeg' // Will be overridden if PNG detected
    default:
      return 'text/plain'
  }
}

export function detectImageMimeType(base64: string): string {
  // Check magic bytes in base64
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png'
  if (base64.startsWith('R0lGOD')) return 'image/gif'
  if (base64.startsWith('UklGR')) return 'image/webp'
  return 'image/jpeg' // Default fallback
}

export const EXTRACTION_PROMPT = `You are a flight data extraction assistant. Extract ALL flight information from the provided document (boarding pass, itinerary, confirmation email, or screenshot).

For EACH flight found, extract:
- date: Flight date in YYYY-MM-DD format
- origin: 3-letter IATA airport code for departure (e.g., JFK, LAX, TLV)
- destination: 3-letter IATA airport code for arrival
- airline_iata: 2-letter IATA airline code. CONVERT airline names to codes:
  "El Al" → "LY", "Qatar Airways" → "QR", "Turkish Airlines" → "TK",
  "Aeroflot" → "SU", "Lufthansa" → "LH", "Georgian Airways" → "A9",
  "China Eastern" → "MU", "Thai Airways" → "TG", "Pegasus" → "PC",
  "Air Serbia" → "JU", "Wizz Air" → "W6", "Yakutia" → "R3", etc.
- flight_number: Flight number (digits only, no airline prefix)
- aircraft_icao: 4-letter ICAO aircraft type code if visible (e.g., B738, A320)
- departure_time: Departure time in HH:mm 24-hour format
- arrival_time: Arrival time in HH:mm 24-hour format

Also provide confidence scores (0.0 to 1.0) for each field based on how clearly the information was visible/readable.

Important rules:
1. Extract ALL flights if multiple are present (round trips, connections)
2. ALWAYS use IATA codes: airports (3 letters like TLV, TBS) and airlines (2 letters like LY, QR)
3. If you see an airline NAME, you MUST convert it to its 2-letter IATA code using your knowledge
4. Use ICAO codes for aircraft (4 letters)
5. If a field is not visible or unclear, omit it rather than guessing
6. Dates should be in YYYY-MM-DD format
7. Times should be in HH:mm 24-hour format
8. Overall confidence should reflect how certain you are about the extraction
9. For date_year_explicit: Set to true ONLY if the year (4 digits like "2024" or "2025") was explicitly visible in the document. Set to false if you inferred the year from context (e.g., "Dec 15" with no year visible).

Return your response as a JSON object with this structure:
{
  "flights": [
    {
      "date": "2024-03-15",
      "origin": "JFK",
      "destination": "LAX",
      "airline_iata": "AA",
      "flight_number": "123",
      "aircraft_icao": "B738",
      "departure_time": "08:30",
      "arrival_time": "11:45",
      "confidence": 0.95,
      "field_confidence": {
        "date": 0.99,
        "date_year_explicit": true,
        "origin": 0.99,
        "destination": 0.99,
        "airline_iata": 0.95,
        "flight_number": 0.9,
        "aircraft_icao": 0.7,
        "departure_time": 0.85,
        "arrival_time": 0.85
      }
    }
  ],
  "raw_text": "Extracted text from the document for reference"
}

If no flights can be extracted, return: {"flights": [], "raw_text": "..."}`

// ============================================================================
// Regex Parser for Cleaned Text (Two-Phase Import - Phase 1)
// ============================================================================

// Parses the cleaned text output from Gemini into basic ExtractedFlight objects
// Format: YYYY-MM-DD | FLIGHT_NUMBER | ORIGIN-DESTINATION | AIRLINE_CODE | DEP_TIME | ARR_TIME
const CLEANED_LINE_REGEX = /^(\d{4}-\d{2}-\d{2})\s*\|\s*([A-Z0-9]{2,3}\s*\d+)?\s*\|\s*([A-Z]{3})-([A-Z]{3})\s*\|\s*([A-Z0-9]{2})(?:\s*\|\s*(\d{2}:\d{2}|-)\s*\|\s*(\d{2}:\d{2}|-))?$/i

export function parseCleanedText(cleanedText: string): ExtractedFlight[] {
  const lines = cleanedText.trim().split('\n')
  const flights: ExtractedFlight[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const match = trimmed.match(CLEANED_LINE_REGEX)
    if (match) {
      const [, date, flightNumberRaw, origin, destination, airlineIata, depTime, arrTime] = match

      // Parse flight number - extract just the digits if present
      let flightNumber: string | undefined
      if (flightNumberRaw) {
        const digits = flightNumberRaw.replace(/[^0-9]/g, '')
        if (digits) flightNumber = digits
      }

      // Parse times - treat "-" as missing
      const departureTime = depTime && depTime !== '-' ? depTime : undefined
      const arrivalTime = arrTime && arrTime !== '-' ? arrTime : undefined

      flights.push({
        date,
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        airline_iata: airlineIata.toUpperCase(),
        flight_number: flightNumber,
        departure_time: departureTime,
        arrival_time: arrivalTime,
        // Phase 1 flights have no aircraft - marked for enrichment
        confidence: 0.7, // Lower confidence since no full AI extraction yet
        enrichment_status: 'pending',
      })
    } else {
      // Log unparseable lines for debugging
      console.log(`[parseCleanedText] Could not parse line: "${trimmed}"`)
    }
  }

  console.log(`[parseCleanedText] Parsed ${flights.length} flights from ${lines.length} lines`)
  return flights
}

// ============================================================================
// Cleaning Prompt (Stage 1 of two-stage parsing)
// ============================================================================

// Cleaning prompt for messy text input (Stage 1 of two-stage parsing)
export const CLEANING_PROMPT = `You are a data cleaning assistant. Your job is to normalize messy flight data into a clean, consistent format.

The input may contain:
- Markdown formatting (**bold**, *italic*, tables, bullets)
- Special arrow characters (➝, →, ->, =>, etc.)
- Airline names instead of codes (e.g., "Turkish Airlines" instead of "TK")
- Partial dates (e.g., "31 Dec" with year in a section header like "### 2024")
- City names in parentheses like "KRR (Krasnodar)"
- Passenger names, booking status, citation markers
- Mixed formats (tables + bulleted lists)

Your task:
1. Extract each flight and output ONE LINE per flight in this exact format:
   YYYY-MM-DD | FLIGHT_NUMBER | ORIGIN-DESTINATION | AIRLINE_CODE | DEPARTURE_TIME | ARRIVAL_TIME

   - DEPARTURE_TIME and ARRIVAL_TIME are in HH:mm 24-hour format
   - If a time is not available, use a dash: -

2. Rules:
   - Dates: Always YYYY-MM-DD format. Infer year from context (section headers like "### 2024")
   - Flight numbers: Include airline prefix and number (e.g., "LY5109", "TK 378")
   - Airports: Use 3-letter IATA codes only (strip city names)
   - Airlines: Convert names to 2-letter IATA codes:
     * El Al, ELAL → LY
     * Turkish Airlines, Turkish → TK
     * Qatar Airways, Qatar → QR
     * Aeroflot → SU
     * S7 Airlines, S7 → S7
     * Ural Airlines → U6
     * Red Wings → WZ
     * Georgian Airways → A9
     * China Eastern → MU
     * Thai Airways → TG
     * Pegasus → PC
     * Air Serbia → JU
     * Wizz Air → W6
     * Nordwind → N4
     * Belavia → B2
     * AirJapan, Air Japan → NQ
     * FlyOne → 3F
   - Skip cancelled flights
   - Skip entries that aren't actual flights

3. Special airport codes:
   - MOW (Moscow) → use the specific airport if mentioned (SVO, DME, VKO), otherwise use SVO
   - If only city name given, use main airport code

Example input:
### 2024
* **31 Dec:** IST ➝ TBS | TK378 (Turkish Airlines) | *Sergei*
| **2026-01-07** | LY5109 | TLV ➝ TBS | EL AL | Confirmed |

Example output:
2024-12-31 | TK 378 | IST-TBS | TK | 14:30 | 17:45
2026-01-07 | LY 5109 | TLV-TBS | LY | 08:00 | 11:30

Output ONLY the cleaned lines, one per flight. No headers, no explanations.`
