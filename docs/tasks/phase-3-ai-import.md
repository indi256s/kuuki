# Phase 3: AI Import

**Status:** Pending
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
- Plain text (copy-pasted flight info)

**Features:**
- Drag-drop zone
- Paste support (Ctrl+V for images/text)
- Preview before parsing
- File size/type validation

**Loading feedback:**
1. "Reading file..."
2. "Extracting text..."
3. "Finding flights..."
- Animated plane + progress steps

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
