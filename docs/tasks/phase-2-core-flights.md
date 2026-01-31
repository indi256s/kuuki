# Phase 2: Core Flight Management

**Status:** Pending
**Depends on:** Phase 1.5 complete

## Tasks

### Flight CRUD

**Workflow:** `/superpowers:test-driven-development`
**MCP:** `supabase`

**Required fields:** date, origin, destination, airline
**Optional fields:** aircraft, flight number, departure/arrival times

**Schema updates needed:**
- `is_upcoming` boolean field
- Timezone fields (`origin_tz`, `dest_tz`)

### Flight Entry Form

**Skill:** `/interface-design`

**Layout:** Centered modal with progressive disclosure
- Required fields shown first
- "Add more details" expands optional fields

**Features:**
- Autocomplete for airports/airlines/aircraft (combined scoring)
- Date picker with calendar dropdown
- Keyboard shortcuts (Tab, Ctrl+S, Escape, Arrow keys)

### Future Flights

**Requirements:**
- Stored with `is_upcoming = true`
- Don't count toward stats until date passes
- Display countdown timers ("3 days until JFK → LHR")
- Auto-convert when date ≤ today

### Duplicate Detection

**Behavior:** Warn but allow
- Show "This looks like a duplicate" warning
- User decides to proceed or cancel

### Flight Deletion

**Behavior:** Confirm with consequences
- Hard delete
- Warn: "This may affect X badges and your leaderboard rank"

### Dashboard

**Skill:** `/interface-design`

**Layout priority:**
1. Big numbers (total flights, distance, countries, airlines)
2. Map below (private - not on public profile)
3. Recent flights list

### Route Map Visualization

**Skill:** `/frontend-design`
**MCP:** `context7` (Mapbox GL JS + react-map-gl docs)

**Features:**
- Flat world map (not 3D globe)
- Curved great-circle arcs
- Visited countries choropleth
- Color-coded by attribute (airline, time period, distance)

## Files to Create

```
apps/web/src/
├── components/
│   ├── flights/
│   │   ├── FlightForm.tsx
│   │   ├── FlightList.tsx
│   │   ├── FlightCard.tsx
│   │   └── FlightTable.tsx
│   ├── dashboard/
│   │   ├── Dashboard.tsx
│   │   ├── StatsCards.tsx
│   │   └── RecentFlights.tsx
│   └── map/
│       ├── RouteMap.tsx
│       └── FlightArc.tsx
├── hooks/
│   ├── useFlights.ts
│   └── useStats.ts
└── routes/
    ├── DashboardPage.tsx
    └── FlightsPage.tsx
```

## Database

```sql
-- New indexes
CREATE INDEX idx_flights_user_date ON flights(user_id, date DESC);
CREATE INDEX idx_flights_user_upcoming ON flights(user_id, is_upcoming) WHERE is_upcoming = true;
```
