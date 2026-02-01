# Phase 3: AI Import

**Status:** ✅ Complete
**Depends on:** Phase 2 complete

## Tasks

### Cloudflare Worker (Gemini Proxy)

**Skill:** `/cloudflare:wrangler`
**MCP:** `cloudflare-docs`, `context7` (Gemini SDK)

**Purpose:** Hide your API key during beta

**Location:** `functions/api/import/parse.ts`

**Features:**
- Receive file/text from client
- Call Gemini 3.0 Flash for OCR + semantic parsing
- Return structured flight data
- Error handling with aviation-themed messages

**Secrets:**
- `GEMINI_API_KEY` - stored in Workers secrets

### Upload UI

**Skill:** `/interface-design`

**Input types:**
- PDF (boarding passes, itineraries)
- Screenshots (PNG, JPG)
- Plain text (copy-pasted flight info, Gemini output)

**Smart Context Detection (v2):**

The Import UI adapts based on user context:

| User Type | Default Mode | Primary Action |
|-----------|--------------|----------------|
| New user (no flights) | Text mode | Bulk import via Gemini prompt |
| Returning user (has flights) | File mode | Quick boarding pass scan |

**Text Mode Features:**
- Gemini prompt helper always visible (not collapsed)
- "Copy" button for the optimized prompt
- Large textarea for pasting results
- Auto-switch from file mode when text is pasted
- Drag-drop files still works (shows overlay)

**File Mode Features:**
- Camera icon dropzone for boarding passes
- Ctrl+V paste support for screenshots
- "Or paste text" link to switch modes

**Gemini Prompt (optimized for bulk extraction):**
```
@Gmail @Google Calendar Search for all flight bookings, boarding passes, itineraries, and travel confirmations.

For each flight, try to find (include only what you can find):
- Date (any format is fine)
- Origin and destination airports (city names or airport codes)
- Airline name or code
- Flight number (if available)
- Departure/arrival times (if available)

Format: one flight per line, include whatever info you found.
```

**Loading feedback:**
1. "Reading file..."
2. "Extracting text..."
3. "Finding flights..."
- WindLoader animation with phase indicators

### Import Review

**Skill:** `/interface-design`

**Layout:** Single scrollable list with all extracted flights

**Features:**
- Edit inline (all fields editable)
- "Save all" button
- Allow AI inferences (airline from flight number, etc.)
- Confidence indicators (optional)
- Discard individual flights

## Files to Create

```
apps/web/src/
├── components/
│   └── import/
│       ├── ImportUpload.tsx
│       ├── ImportPreview.tsx
│       ├── ImportReview.tsx
│       ├── FlightEditRow.tsx
│       └── ImportProgress.tsx
├── hooks/
│   └── useImport.ts
└── routes/
    └── ImportPage.tsx

functions/
└── api/
    └── import/
        └── parse.ts
```

## API Design

### POST /api/import/parse

**Request:**
```json
{
  "type": "pdf" | "image" | "text",
  "content": "base64 or plain text"
}
```

**Response:**
```json
{
  "flights": [
    {
      "date": "2026-01-15",
      "origin": "JFK",
      "destination": "LHR",
      "airline_iata": "BA",
      "flight_number": "BA178",
      "aircraft_icao": "B77W",
      "departure_utc": "2026-01-15T18:00:00Z",
      "arrival_utc": "2026-01-16T06:30:00Z",
      "confidence": 0.95
    }
  ],
  "raw_text": "extracted text for debugging"
}
```

## Post-Launch: User API Keys

When users provide their own Gemini key:
1. Store encrypted in `profiles.gemini_api_key`
2. Client sends key with request (or use stored key)
3. Worker uses user's key instead of yours
