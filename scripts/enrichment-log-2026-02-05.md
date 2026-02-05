# Aircraft Enrichment Analysis Log
**Date:** 2026-02-05
**Type:** One-time backfill enrichment
**API Endpoint:** https://kuuki.pages.dev/api/enrich/aircraft
**Model:** Gemini 3 Flash Preview with grounded web search

---

## Executive Summary

| Metric | Value | Percentage |
|--------|-------|------------|
| Total flights in database | 259 | 100% |
| Successfully enriched | 174 | 67.2% |
| Skipped (low confidence) | 65 | 25.1% |
| Failed (API errors) | 20 | 7.7% |
| Remaining without aircraft | 85 | 32.8% |

---

## Run 1: Initial Enrichment

**Started:** ~20:30 UTC
**Batches:** 13 batches (20 flights each)
**Duration:** ~5 minutes

### Results
- **Processed:** 259 flights
- **Enriched:** 92 flights
- **Skipped:** 147 flights (low confidence)
- **Errors:** 20 flights (API timeouts)

### API Performance
- **Successful batches:** 11/13 (85%)
- **Failed batches:** 2/13 (15%)
  - Batch 7: 502 Bad Gateway
  - Batch 11: 524 Timeout

### Sample Successful Matches (High Confidence ≥90%)
```
LY5108 TBS-TLV → B738 (95%)  # El Al, Boeing 737-800
MU2075 PKX-SVO → A333 (95%)  # China Eastern, Airbus A330-300
QR806 DOH-NRT → B77W (95%)   # Qatar Airways, Boeing 777-300ER
JU890 BEG-TBS → A319 (95%)   # Air Serbia, Airbus A319
PC318 SAW-TBS → A21N (95%)   # Pegasus, Airbus A321neo
TG900 BKK-IST → A359 (98%)   # Thai Airways, Airbus A350-900
NQ001 NRT-BKK → B788 (95%)   # Nok Scoot, Boeing 787-8
```

### Sample Skipped (Low Confidence <70%)
```
LX4590 ZRH-LIS → skipped (0%)  # Multiple equipment types
VY1890 BCN-HAJ → skipped (0%)  # Route info unclear
SU1323 MMK-SVO → skipped (0%)  # Regional route variations
```

---

## Run 2: Retry Remaining Flights

**Started:** ~21:15 UTC
**Batches:** 9 batches
**Duration:** ~3 minutes
**Remaining flights:** 167 (after Run 1 enriched 92)

### Results
- **Processed:** 167 flights
- **Enriched:** 82 flights
- **Skipped:** 65 flights (low confidence)
- **Errors:** 20 flights (API timeout)

### API Performance
- **Successful batches:** 8/9 (89%)
- **Failed batches:** 1/9 (11%)
  - Batch 8: 502 Bad Gateway

### Notable Enrichments
```
QR859 ICN-DOH → A35K (95%)   # Qatar Airways, A350-1000
QR835 BKK-DOH → A388 (95%)   # Qatar Airways, A380-800
TG657 ICN-BKK → A359 (95%)   # Thai Airways, A350-900
EK132 DME-DXB → A388 (95%)   # Emirates, A380-800
SU1159 ROV-SVO → SU95 (95%)  # Aeroflot, Sukhoi Superjet 95
HY601 TAS-DME → B763 (75%)   # Uzbekistan Airways, Boeing 767-300
```

### Persistent Low Confidence Routes
```
J2 GYD-TBS → skipped (0%)     # Azerbaijan Airlines - multiple types
LH1778 MUC-LIS → skipped (0%) # Lufthansa - schedule variations
TP673 AMS-LIS → skipped (0%)  # TAP Portugal - equipment changes
W62490 VKO-BUD → skipped (0%) # Wizz Air - fleet variations
SU2607 LIS-SVO → skipped (0%) # Aeroflot - multiple configs
```

---

## Analysis

### Success Patterns

**High Success Routes (≥90% confidence):**
1. **Long-haul international** (e.g., Qatar, Emirates, Thai) - consistent equipment
2. **Major carriers on popular routes** (e.g., China Eastern, Turkish, Pegasus)
3. **Regional jets with dedicated routes** (e.g., Sukhoi Superjet on domestic Russian)

**Aircraft Types Identified:**
- Wide-body: A333, A359, A35K, A388, B77W, B788, B763
- Narrow-body: A319, A320, A321, A20N, A21N, B738, B739, B38M
- Regional: E190, E195, E75L, SU95, DH8D, BCS3

### Failure Patterns

**Low Confidence Categories:**
1. **LCCs with variable equipment** (Wizz Air, easyJet routes)
2. **Russian domestic routes** (multiple aircraft types on same route number)
3. **Seasonal/charter routes** (equipment varies by season)
4. **Code-share flights** (operator vs marketed airline mismatch)
5. **Regional carriers** (Red Wings, Georgian Airways - limited data)

**API Reliability:**
- **Overall success rate:** 87% of batches completed
- **Timeout pattern:** Occurs on batches 7-8 (after ~150-160 requests)
- **Likely cause:** Gemini API rate limiting or grounded search quota
- **Mitigation:** 2-second delay between batches (currently implemented)

---

## Recommendations

### 1. Improve Low Confidence Matches
```typescript
// Consider adding operator context for code-shares
airline_name: "Operated by X Airlines"  // vs marketed airline
```

### 2. Handle API Timeouts
- Increase batch delay from 2s to 3s
- Implement exponential backoff on 502/524 errors
- Retry failed batches at end of run

### 3. Data Quality Enhancements
For skipped routes, could add:
- Aircraft registration lookup (when available)
- Fleet data from airline databases
- Historical equipment probability (e.g., "LH usually operates A320 on MUC-LIS")

### 4. Monitoring Metrics
Track over time:
- Enrichment success rate by airline
- Confidence score distribution
- API timeout frequency
- Most common skipped routes

---

## Configuration Used

```typescript
const BATCH_SIZE = 20
const CONFIDENCE_THRESHOLD = 0.7
const API_BASE = 'https://kuuki.pages.dev'
const BATCH_DELAY = 2000  // ms

// Gemini Prompt Key Points:
// - "CURRENTLY operated" (not historical)
// - Confidence calibration (0.9-1.0, 0.8-0.89, 0.7-0.79)
// - Expanded ICAO reference (~80 types)
// - Airline name included for search context
```

---

## Next Steps

1. ✅ **Production deployed** - enrichment works during import
2. ⏳ **Manual review** - 85 flights need human assignment
3. 🔄 **Periodic retry** - Re-run script monthly for failed flights (APIs improve)
4. 📊 **Analytics** - Track enrichment quality in production imports
5. 🎯 **Optimize** - Fine-tune confidence thresholds based on accuracy

---

## Sample Query for Manual Review

```sql
-- Flights without aircraft, ordered by frequency (likely candidates for fleet data)
SELECT
  airline_iata,
  origin,
  destination,
  COUNT(*) as flight_count
FROM flights
WHERE aircraft_icao IS NULL
  AND airline_iata IS NOT NULL
GROUP BY airline_iata, origin, destination
ORDER BY flight_count DESC
LIMIT 20;
```

---

**Log completed by:** Claude Sonnet 4.5
**Script location:** `/scripts/enrich-existing-flights.ts`
**Next enrichment recommended:** 2026-03-05 (1 month)
