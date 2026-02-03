// Shared types and utilities for import API

export type EnrichmentStatus = 'pending' | 'enriched' | 'failed' | 'skipped'

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

export interface ParseResponse {
  flights: ExtractedFlight[]
  raw_text?: string
  error?: string
  // Diagnostic info for debugging
  rejected?: RejectedFlight[]
  gemini_count?: number // How many flights Gemini found before validation
  cleaned_text?: string // Normalized text from Stage 1 (text input only)
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
   YYYY-MM-DD | FLIGHT_NUMBER | ORIGIN-DESTINATION | AIRLINE_CODE

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
2024-12-31 | TK 378 | IST-TBS | TK
2026-01-07 | LY 5109 | TLV-TBS | LY

Output ONLY the cleaned lines, one per flight. No headers, no explanations.`
