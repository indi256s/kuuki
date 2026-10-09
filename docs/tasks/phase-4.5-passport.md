# Phase 4.5: Passport Feature

> **Status:** ✅ Complete
> **Started:** 2026-01-31
> **Completed:** 2026-02-01

---

## Overview

A personal "Nomad Passport" view with country stamps representing all visited countries. Countries are tracked from two sources: **flight data** (automatic from visits table) and **manual claims** (for ground travel). Feature is **always private** - personal travel visualization.

---

## Completed Tasks

### Database Schema ✅

- [x] Created `country_claims` table with RLS policies
- [x] Extended `user_stats` with new fields:
  - `time_zones_count`
  - `most_visited_country`
  - `most_visited_count`
  - `world_completion_pct`
- [x] Added 5 continent achievement badges to `badge_definitions`

### Static Data ✅

- [x] Created `packages/data/src/countries.json` (246 entries)
  - ISO 3166-1 alpha-2 codes
  - Native names for all countries
  - Flag colors (dominant + palette)
  - Continent classification
  - Regional stamp shapes (circle/rectangle)
  - Primary timezone

### Shared Types ✅

- [x] Added `PassportEntry` type
- [x] Added `CountryStats` type
- [x] Added `Continent` type
- [x] Added `EntryMethod` type ('land' | 'sea')

### API Layer ✅

Created `apps/web/src/lib/passport.ts`:

- [x] `getUserCountries()` - Combines visits + claims into passport entries
- [x] `getUserClaims()` - Get all manual claims for a user
- [x] `claimCountry()` - Create manual country claim
- [x] `updateClaim()` - Update existing claim
- [x] `unclaimCountry()` - Delete a claim
- [x] `getCountryStats()` - Detailed stats for a country
- [x] `getPassportStats()` - Summary stats (countries, continents, world %)
- [x] `isCountryClaimed()` - Check if country already claimed
- [x] `getAllCountries()` - Get static country data
- [x] `getCountryByCode()` - Get single country data

### React Hooks ✅

Created `apps/web/src/hooks/usePassport.ts`:

- [x] `usePassportCountries()` - TanStack Query for passport entries
- [x] `usePassportStats()` - TanStack Query for summary stats
- [x] `useClaimCountry()` - Mutation for claiming
- [x] `useUnclaimCountry()` - Mutation for unclaiming
- [x] `useCountryStats()` - TanStack Query for country details

### Components ✅

Created `apps/web/src/components/passport/`:

- [x] `PassportStamps.tsx` - Virtualized stamp grid with loading skeletons
- [x] `CountryStamp.tsx` - SVG stamp with regional shapes, flag colors, native script
- [x] `StampPopup.tsx` - Popover with detailed country stats
- [x] `ClaimDialog.tsx` - Modal form for manual claims (note, entry method, year)
- [x] `CountryClaimMap.tsx` - Interactive world map with country search
- [x] `EmptyPassport.tsx` - Empty state with CTA to add first country

### Routes ✅

- [x] Created `PassportPage.tsx` with header, stats summary, stamp grid
- [x] Added `/passport` route to `App.tsx`
- [x] Added Passport nav link to `DashboardPage.tsx`

### i18n ✅

- [x] Added English translations in `en.json`
- [x] Added Russian translations in `ru.json`

### Tests ✅

Created `apps/web/src/lib/passport.test.ts` with 31 tests:

- [x] Pure functions: `getAllCountries`, `getCountryByCode`
- [x] Data fetching: `getUserCountries`, `getUserClaims`, `getCountryStats`, `getPassportStats`
- [x] Mutations: `claimCountry`, `updateClaim`, `unclaimCountry`
- [x] Queries: `isCountryClaimed`
- [x] Error handling for all database operations
- [x] Edge cases: duplicate claims, unknown countries, empty states

---

## File Structure

```
apps/web/src/
├── routes/
│   └── PassportPage.tsx           # Main passport view
├── components/
│   └── passport/
│       ├── PassportStamps.tsx     # Virtualized stamp grid
│       ├── CountryStamp.tsx       # Individual stamp component
│       ├── StampPopup.tsx         # Click popup with stats
│       ├── CountryClaimMap.tsx    # Interactive claim map
│       ├── ClaimDialog.tsx        # Claim form modal
│       └── EmptyPassport.tsx      # Empty state
├── hooks/
│   └── usePassport.ts             # Passport data fetching
├── lib/
│   ├── passport.ts                # Passport API functions
│   └── passport.test.ts           # 31 unit tests
packages/data/src/
│   └── countries.json             # Country data (246 entries)
packages/shared/src/
│   └── types.ts                   # PassportEntry, CountryStats types
```

---

## Database Schema

### `country_claims` Table

```sql
CREATE TABLE country_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  visit_year INT,
  note TEXT,
  entry_method TEXT,
  UNIQUE(user_id, country_code)
);
```

### `user_stats` Extensions

```sql
ALTER TABLE user_stats ADD COLUMN
  time_zones_count INT DEFAULT NULL,
  most_visited_country TEXT DEFAULT NULL,
  most_visited_count INT DEFAULT NULL,
  world_completion_pct DECIMAL(5,2) DEFAULT NULL;
```

### Continent Badges

| Code                 | Name              | Description                 |
| -------------------- | ----------------- | --------------------------- |
| `continent-europe`   | Europhile         | Visit 3+ European countries |
| `continent-asia`     | Asianaut          | Visit 3+ Asian countries    |
| `continent-americas` | Americas Wanderer | Visit 3+ American countries |
| `continent-africa`   | Africa Explorer   | Visit 3+ African countries  |
| `continent-oceania`  | Pacific Voyager   | Visit 3+ Oceanian countries |

---

## Key Design Decisions

### Stamp Shapes by Region

| Region   | Shape     | Rationale                                |
| -------- | --------- | ---------------------------------------- |
| Asia     | Circle    | Resembles traditional Asian seals/stamps |
| Europe   | Rectangle | European passport stamp style            |
| Americas | Rectangle | Western style                            |
| Africa   | Rectangle | Western style                            |
| Oceania  | Rectangle | Western style                            |

### Data Combination Logic

1. Fetch visits (from flights) and claims in parallel
2. Build map keyed by country code
3. For countries with both: mark source as "both", use earliest first_visit date
4. For flights only: source = "flight"
5. For claims only: source = "claim"
6. Sort by first visit date (chronological passport)

### Test Coverage

| Function           | Tests | Scenarios                                        |
| ------------------ | ----- | ------------------------------------------------ |
| `getAllCountries`  | 2     | Data structure, count                            |
| `getCountryByCode` | 3     | Valid/invalid codes, regional shapes             |
| `getUserCountries` | 7     | Empty, visits, claims, combined, sorting, errors |
| `claimCountry`     | 4     | Minimal/full data, duplicate, errors             |
| `unclaimCountry`   | 2     | Success, errors                                  |
| `isCountryClaimed` | 3     | True/false/error                                 |
| `getPassportStats` | 2     | Calculation, empty                               |
| `getCountryStats`  | 3     | Invalid code, visits, claims                     |
| `getUserClaims`    | 3     | Normal, empty, errors                            |
| `updateClaim`      | 2     | Success, errors                                  |

---

## Verification Checklist

- [x] `/passport` route loads without errors
- [x] Stamps display for countries from existing flights
- [x] "Add Country" button opens claim map
- [x] Country search works in claim dialog
- [x] Claiming a country adds stamp to passport
- [x] Stamp popup shows correct stats
- [x] Empty state displays for users with no countries
- [x] TypeScript compilation passes
- [x] All 89 tests pass (31 new passport tests)
- [x] Build succeeds
