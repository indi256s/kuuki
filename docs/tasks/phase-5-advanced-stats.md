# Phase 5: Advanced Stats

**Status:** ✅ Complete
**Depends on:** Phase 4 complete

## Tasks

### Overview Tier (Always Visible) ✅

**Stats:**
- Total flights with animated counter
- Total distance (km) with Moon progress visualization
- Countries visited with world completion %
- Airlines flown count

**Implementation:**
- `OverviewTier.tsx` with 4 stat cards in responsive grid
- Hover states reveal additional context
- Staggered entrance animations

### Avia Geek Tier ✅

**Unlock:** 5+ aircraft types flown

**Stats:**
- Most flown aircraft with flight count and percentage
- Manufacturer breakdown (Boeing, Airbus, Embraer, etc.)
- Widebody vs narrowbody ratio with visual bar
- Total unique aircraft types

**Implementation:**
- `AviaGeekTier.tsx` with aircraft analytics
- Sarcastic AI commentary with randomized quips
- Progress ring for widebody ratio

### Country Geek Tier ✅

**Unlock:** 5+ countries visited

**Stats:**
- Global completion percentage (out of 195 UN countries)
- Continent breakdown with visit counts
- Most visited continent identification
- Regional progress indicators

**Implementation:**
- `CountryGeekTier.tsx` with geographic analytics
- Continent badges with flag colors
- Progress bars for each continent

### Time Geek Tier ✅

**Unlock:** 10+ flights

**Stats:**
- Total time in air (days, hours, minutes)
- Longest single flight with route details
- Shortest flight with route details
- Average flight duration
- Departure pattern analysis (Night Owl, Early Bird, Business Hours, Evening)

**Implementation:**
- `DurationStatsTier.tsx` with time analytics
- `FlightPopover.tsx` for viewing flight details on click
- `formatDuration.ts` utility with full test coverage
- Departure pattern badges with percentage breakdown

### Fun Facts (Integrated) ✅

Comparative framing built into Overview tier:
- "Distance to the Moon: X% complete" (384,400 km)
- "X.X trips around Earth" (40,075 km each)
- AI commentary with sarcastic personality

## Files Created

```
apps/web/src/
├── components/
│   └── stats/
│       ├── AdvancedStats.tsx      # Main container with tier grid
│       ├── OverviewTier.tsx       # Always-visible stats
│       ├── AviaGeekTier.tsx       # Aircraft analytics
│       ├── CountryGeekTier.tsx    # Geographic analytics
│       ├── DurationStatsTier.tsx  # Time analytics
│       ├── TierContainer.tsx      # Unlock wrapper with locked state
│       ├── UnlockToast.tsx        # Celebration toast on unlock
│       ├── FlightPopover.tsx      # Flight details popover
│       └── index.ts               # Barrel exports
├── hooks/
│   ├── useAdvancedStats.ts        # Unlock progress hook
│   └── __tests__/
│       └── useAdvancedStats.test.ts
└── lib/
    ├── formatDuration.ts          # Duration formatting utility
    └── formatDuration.test.ts
```

## Unlock Logic

```typescript
const statsTiers = {
  overview: { unlocked: true },
  aviaGeek: {
    unlocked: stats.aircraftTypesCount >= 5,
    requirement: "5+ aircraft types"
  },
  countryGeek: {
    unlocked: stats.countriesCount >= 5,
    requirement: "5+ countries"
  },
  duration: {
    unlocked: stats.totalFlights >= 10,
    requirement: "10+ flights"
  }
};
```

## Verification

- [x] Overview tier shows on dashboard with flights
- [x] Locked tiers show progress toward unlock
- [x] Avia Geek unlocks at 5 aircraft types
- [x] Country Geek unlocks at 5 countries
- [x] Time Geek unlocks at 10 flights
- [x] Unlock toast appears on first unlock
- [x] AI commentary displays with personality
- [x] Flight popover shows details on click
- [x] Duration formatting works for all ranges
