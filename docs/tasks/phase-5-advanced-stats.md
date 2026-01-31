# Phase 5: Advanced Stats

**Status:** Pending
**Depends on:** Phase 4 complete

## Tasks

### Overview Tier (Always Visible)

**Skill:** `/interface-design`

**Stats:**
- Total flights
- Total distance (km)
- Countries visited
- Airlines flown

**Interaction:** Hover to reveal additional details/breakdown

### Avia Geek Tier

**Skill:** `/interface-design`
**Unlock:** 5+ aircraft types flown

**Stats:**
- Aircraft types breakdown
- Manufacturers (Boeing vs Airbus vs others)
- Engine types (jet, turboprop, piston)
- Widebody vs narrowbody ratio
- Most flown aircraft

**Display:** Aircraft breakdown charts

### Country Geek Tier

**Skill:** `/interface-design`
**Unlock:** 5+ countries visited

**Stats:**
- Continents visited
- UN regions/subregions
- Hemispheres (N/S, E/W)
- Country completion % (out of 195)
- Regional completion (Europe: X%, Asia: Y%)

**Display:** Choropleth maps, completion progress bars

### Duration Stats Tier

**Skill:** `/interface-design`
**Unlock:** 10+ flights

**Stats:**
- Total time in air (days, hours, minutes)
- Longest single flight
- Shortest flight
- Average flight duration
- Duration trends over time

**Display:** Time visualizations, trend charts

### Fun Facts

**Skill:** `/frontend-design`

**Comparative framing:**
- "Distance to the Moon: 42% complete" (384,400 km)
- "You've flown X.X trips around Earth" (40,075 km each)
- "Time in air: X days, Y hours"
- "You've visited X% of all countries"

**Style:** Playful visualizations, delightful moments

## Files to Create

```
apps/web/src/
├── components/
│   └── stats/
│       ├── StatsPage.tsx
│       ├── OverviewTier.tsx
│       ├── AviaGeekTier.tsx
│       ├── CountryGeekTier.tsx
│       ├── DurationStatsTier.tsx
│       ├── FunFacts.tsx
│       ├── AircraftChart.tsx
│       ├── CountryMap.tsx
│       └── DurationChart.tsx
├── hooks/
│   └── useAdvancedStats.ts
└── routes/
    └── StatsPage.tsx
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
