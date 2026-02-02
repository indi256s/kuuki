# Kuuki DNA: Feature Decisions

> Specific product decisions organized by feature area.
> References PRINCIPLES.md for foundational beliefs.

---

## Flights

### Data Model

| Field | Required | Notes |
|-------|----------|-------|
| date | ✅ | DATE type |
| origin | ✅ | IATA code (3 letters) |
| destination | ✅ | IATA code (3 letters) |
| airline_iata | ✅ | Required for every flight |
| aircraft_icao | ❌ | Optional — leave blank if unknown |
| flight_number | ❌ | Optional |
| departure_utc | ❌ | Stored as UTC timestamp |
| arrival_utc | ❌ | Stored as UTC timestamp |
| distance_km | computed | Great circle × 1.10 (typical routing) |
| duration_minutes | computed | Per-aircraft estimates if times not provided |
| source | ✅ | 'manual' or 'ai_import' |
| is_upcoming | ✅ | Future flights flagged separately |

### Distance Calculation

**Formula:** Great circle distance × 1.10

**Rationale:** Real flight paths are ~10% longer than straight lines due to routing, weather, and airspace.

### Duration Estimation (when times not provided)

| Aircraft type | Speed estimate |
|---------------|----------------|
| Jet (narrow/widebody) | ~850 km/h |
| Regional jet | ~750 km/h |
| Turboprop | ~500 km/h |

### Future Flights

- Stored with `is_upcoming = true`
- **DON'T count toward stats** until date passes
- Auto-convert when date ≤ today
- Display with **countdown timers** ("3 days until JFK → LHR")

### Duplicate Handling

**Approach:** Warn but allow.

Show "This looks like a duplicate" warning. User decides to proceed or cancel. Don't block — user might have legitimate reason (repositioned flights, re-entered with corrections).

### Flight Deletion

**Approach:** Confirm with consequences.

Hard delete, but warn: "This may affect X badges and your leaderboard rank."

---

## AI Import

### Supported Formats

- PDF (boarding passes, itineraries)
- Screenshots (any image with flight info)
- Plain text (copy-pasted flight info)

### Processing Flow

1. **Upload → Preview** (user confirms before parsing)
2. Gemini OCR extracts text
3. Gemini semantic parsing + web search for enrichment
4. Results shown in **single scrollable list** (all flights together)
5. User reviews, edits inline, saves all at once

### AI Behavior Rules

| Rule | Details |
|------|---------|
| Allow inferences | Infer airline from flight number format (e.g., "UA123" → United) |
| Enrichment scope | Airline + aircraft data only |
| No personal data | Never extract loyalty numbers, seat assignments, service class |
| Confidence display | Show all extracted data with confidence colors |
| User confirmation | ALWAYS require human review before saving |

### Two-Stage Text Import

For plain text input, use two-stage processing:

1. **Clean stage:** Remove noise, normalize formatting
2. **Extract stage:** Parse flight details from cleaned text

**Rationale:** Cleaner input = better extraction accuracy.

### API Key Management

| Phase | Approach |
|-------|----------|
| Beta | Your Gemini key (server-side proxy) |
| Post-launch | User provides their own key (with setup instructions) |

---

## Stats System

### Progressive Unlock Tiers

| Tier | Unlock criteria | Focus |
|------|-----------------|-------|
| **Overview** | Always visible | Flights, countries, distance, airlines |
| **Avia Geek** | 5+ aircraft types | Aircraft, manufacturers, widebody vs narrowbody |
| **Country Geek** | 5+ countries | Continents, regions, world completion % |
| **Time Geek** | 10+ flights | Hours in air, longest flight, departure patterns |

**Unlock UX:** Toast notification with blur-to-clear reveal animation. Celebration moment, not intrusive.

### Time Metrics (NOT Streaks)

Focus on **duration milestones:**
- Total hours/days in air
- Longest single flight
- Average flight duration
- Cumulative time visualization

**Why not streaks:** Streaks create anxiety and punish breaks. Duration milestones are positive-sum.

### Fun Facts Framing

Use comparative framing for delight:
- "Distance to the Moon: 42% complete" (384,400 km)
- "You've flown X.X trips around Earth" (40,075 km each)
- "Time in air: X days, Y hours"
- "You've visited X% of all countries" (195 UN members)

### Units

**Kilometers only** — standard for aviation and most of the world.

Future consideration: User preference for miles, but not MVP.

---

## Social Features

### Public Profiles

**URL format:** `/u/{username}`

**What's public (if profile is public):**
- Username, display name, avatar
- Bio (140 chars max)
- Stats: flights, distance, countries, cities, airlines
- Badges earned
- Leaderboard percentile rankings

**What's ALWAYS private:**
- All individual flights
- The route map
- Passport stamps

### Compare Feature

**Default view:** Curated comparison (top 5 most interesting stats)

**Optional:** Full side-by-side tables ("You vs Them")

**Rationale:** Curated feels like a conversation starter. Full tables are for power users.

### Leaderboards

**Categories:**
- countries (unique countries visited)
- cities (unique cities visited)
- flights (total flight count)
- distance (total km flown)
- airlines (unique airlines)

**Display:** Percentile only ("You're in the top 15%")

**NOT displayed:** Exact rank position

**Eligibility:** 10 flight minimum to appear on leaderboards

**Opt-in required:** User must enable `show_on_leaderboards` in settings

---

## Passport Feature

### Overview

Personal "Nomad Passport" at `/passport` with country stamps. Always private.

**Data sources:**
1. Flight data (auto-derived from airport countries)
2. Manual claims (for ground travel)

### Stamp Design

| Element | Implementation |
|---------|----------------|
| Shape | Regional: circle for Asia, rectangle for EU/Americas/Africa/Oceania |
| Colors | Flag colors as border/accent |
| Text | Native script name + English name |
| Date | Relative format ("2 years ago") |
| Visit count | Ink-stamped corner (×5) |

**Rationale for shapes:** Circle for Asia evokes traditional seal/stamp aesthetic. Rectangle for Western regions is more familiar passport stamp shape.

### Stamp Interaction

- **Click/tap:** Mini popup with stats (first visit, last visit, total visits, airports)
- **No navigation:** Stays on passport view

### Country Claiming (Manual)

Users can claim countries visited by ground travel:

1. Click "Add Country" button
2. Interactive map opens with country search
3. Select country
4. Optional: Add note, entry method (land/sea), visit year
5. Country appears as stamp

### Country Data

246 countries/territories with:
- ISO 3166-1 alpha-2 codes
- English and native names
- Flag colors (dominant + palette)
- Continent classification
- Stamp shape assignment
- Primary timezone

---

## Badges

### Categories

| Type | Examples |
|------|----------|
| **Milestones** | First Flight, Frequent Flyer (50), Centurion (100), Circumnavigator (40,075 km) |
| **Explorer** | Arctic Circle (flew above 66°N), Equator Hopper, Island Collector (10 island nations) |
| **Collector** | Fleet Master (20 aircraft types), Alliance Ace (all 3 major alliances), Retro (flew turboprop) |
| **Achievement** | Iron Butt (12+ hour flight), Night Owl (10 red-eyes), Jet Setter (3 continents in 30 days) |
| **Continent** | Europhile, Asianaut, Americas Wanderer, Africa Explorer, Pacific Voyager (3+ countries each) |

### Badge Count

**20 total badges** across 6 categories.

### Display Rules

- Show earned badges only
- DON'T show locked badges
- DON'T show progress toward next badge
- DON'T prompt "X more to unlock..."

### Evaluation

Badges evaluated via database trigger on flight insert. Trigger chain: flight → stats → badges.

---

## Visited Places

### Counting Rule

**Landed = visited.** If you landed there (origin or destination), it counts.

### Cities

- Auto-derived from airport city field
- Separate sections:
  - "Visited by flight"
  - "Also visited" (manual entries)

### Manual Place Addition

1. Go to Visited Places view
2. Search for a town/city
3. Add it manually
4. Appears in "Also visited" section

---

## Settings

| Setting | Options | Notes |
|---------|---------|-------|
| Language | EN / RU | i18n with react-i18next |
| Theme | Light / Dark / System | 3-way toggle |
| Profile visibility | Public / Private | |
| Leaderboard opt-in | Yes / No | Must be enabled to appear |
| Display name | Text | |
| Bio | Text | 140 chars max |
| Gemini API key | Text | For post-launch BYOK |
| Date format | User preference | |

### Data Export

**CSV export:** Simple download of all flights. Standard, portable format.

### Account Deletion

Available in settings. Full GDPR-style delete — removes all user data.

---

## Navigation

### Desktop

Left sidebar with grouped sections:
- **Personal:** Dashboard, Flights, Passport
- **Explore:** Stats, Leaderboard
- **Account:** Profile, Settings

Sidebar behavior: Collapsible with icons (user toggleable)

### Mobile

Bottom tab bar with 5 items:
- Dashboard | Flights | **Add** (center, prominent) | Stats | Profile

---

## Error Handling

### Tone

Aviation-themed personality:
- "Flight log delayed on the tarmac. We're working to clear it for takeoff."
- "That route doesn't exist in our flight plan."

### Offline

No offline support for MVP. Future: PWA with caching.
