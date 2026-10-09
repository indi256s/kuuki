# Two-Stage Text Import Design

Historical proposal. The current contract is [ADR 0001 §6](../adr/0001-flight-lifecycle-and-import-drafts.md#6-import-drafts-migration-0007_import_draftssql): supported structured text parses locally, other text uses one provider extraction, and absent years are never inferred. See the [recognition evaluation](../research/2026-10-07-import-recognition.md).

## Problem

Text imports (copy-paste from various sources) often fail because the data is messy:

- Markdown formatting (`**bold**`, tables, bullets)
- Special characters (`➝` arrows)
- Mixed formats (tables + lists)
- Airline names instead of IATA codes
- Partial dates requiring year inference

## Solution

Two-stage parsing for text input:

```
TEXT:  User paste → [Clean] → [Extract] → Flights (2 API calls)
PDF:   User upload → [Extract] → Flights (1 API call)
IMAGE: User upload → [Extract] → Flights (1 API call)
```

## Stage 1: Cleaning

Gemini normalizes messy text into consistent format:

**Input:**

```
| **2026-01-07** | LY5109 | TLV ➝ TBS | EL AL |
* **31 Dec:** IST ➝ TBS | TK378 (Turkish Airlines)
```

**Output:**

```
2026-01-07 | LY 5109 | TLV-TBS | LY
2024-12-31 | TK 378 | IST-TBS | TK
```

Responsibilities:

- Strip markdown
- Normalize arrows to `-`
- Convert airline names to IATA codes
- Infer years from context
- Remove noise (passengers, status)
- One flight per line

## Stage 2: Extraction

Existing `EXTRACTION_PROMPT` - unchanged. Outputs JSON with flights.

## UI Progress (Transparent)

**Text input:**

1. "Cleaning up your data..." - Normalizing dates, codes, formats
2. "Extracting flights..." - Found N potential flights
3. "Validating..." - N validated, M rejected
4. Review screen with optional "View normalized data"

**PDF/Image:**

1. "Reading document..."
2. "Extracting flights..." - Found N flights
3. Review screen

## Error Handling

| Scenario            | Handling                            |
| ------------------- | ----------------------------------- |
| Clean fails         | Return error                        |
| Clean returns empty | Pass original to extract (fallback) |
| Extract finds 0     | Show "No flights found"             |
| All rejected        | Show rejection reasons              |

## Files to Modify

- `functions/api/import/_shared.ts` - Add CLEANING_PROMPT
- `functions/api/import/parse.ts` - Add cleaning stage for text
- `apps/web/src/routes/ImportPage.tsx` - New parsing phases
- `apps/web/src/components/import/ImportReview.tsx` - Show cleaned text
