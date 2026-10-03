// Shared types and utilities for import API

export type EnrichmentStatus = 'pending' | 'enriched' | 'failed' | 'skipped'

// ============================================================================
// Async Job System (KV-backed for persistence across Worker instances)
// ============================================================================

export type JobStatus = 'processing' | 'completed' | 'failed'
export type JobType = 'parse' | 'enrichment'

export interface ImportJob {
  id: string
  ownerId?: string // user id that created the job; pollers reject jobs owned by anyone else
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
export async function createJob(kv: KVNamespace, type: JobType = 'parse', ownerId?: string): Promise<ImportJob> {
  const id = crypto.randomUUID()
  const job: ImportJob = {
    id,
    ownerId,
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
  airline_was_placeholder?: boolean // Flag when ZZ was auto-applied
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
- airline_iata: 2-letter IATA airline code. Use "ZZ" if airline cannot be determined. CONVERT airline names to codes:
  "El Al" → "LY", "Qatar Airways" → "QR", "Turkish Airlines" → "TK",
  "Aeroflot" → "SU", "Lufthansa" → "LH", "Georgian Airways" → "A9",
  "China Eastern" → "MU", "Thai Airways" → "TG", "Pegasus" → "PC",
  "Air Serbia" → "JU", "Wizz Air" → "W6", "Yakutia" → "R3",
  "Smartavia" → "5N", etc.
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
5. For optional fields (flight_number, aircraft_icao), omit if not visible rather than guessing
6. For departure_time and arrival_time: ALWAYS extract if visible. Use empty string "" only if truly not present in the document
7. Dates with a year explicitly visible should be in YYYY-MM-DD format. If the
   year is absent or uncertain, return date as an empty string and set
   field_confidence.date_year_explicit to false. Never infer a year.
8. Times should be in HH:mm 24-hour format
9. Overall confidence should reflect how certain you are about the extraction
10. For date_year_explicit: Set to true ONLY if the year (4 digits like "2024" or "2025") was explicitly visible in the document. Otherwise set false and leave date empty for human review.

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
