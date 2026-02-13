# Kuuki (空気) - Complete Product Specification

**Generated from user interview on 2026-01-31**

---

## Overview

Kuuki is a flight stats vault for aviation enthusiasts. Log journeys, build your collection, discover patterns, and compare with others.

| Attribute | Value |
|-----------|-------|
| **Name** | Kuuki (display as "Kuuki" only, no kanji) |
| **Domain** | kuuki.indi256.com |
| **Scale** | 50-500 users (first 6 months) |
| **Launch approach** | Feature-complete beta |

---

## Architecture Decisions

### Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React 19 + Vite + TypeScript | |
| Styling | Tailwind CSS + shadcn/ui | Dark mode via user toggle |
| State | Zustand + TanStack Query | |
| Maps | **Mapbox GL JS** + react-map-gl | Flat world map with great-circle arcs |
| i18n | react-i18next | EN primary, RU via AI-assisted translation |
| Hosting | Cloudflare Pages | |
| Edge API | Cloudflare Workers | **AI parsing only** - all other CRUD direct to Supabase |
| Database | Supabase PostgreSQL | |
| Auth | Supabase Auth (email/password) | 30-day sessions, optional email verification |
| AI | Google Gemini 3.0 Flash | Your key for beta, users bring their own post-launch |
| Forms | React Hook Form + Zod | Validation with TypeScript inference |
| Dates | Luxon | Best timezone support for UTC + local display |
| Charts | Recharts | React-native, good defaults |
| Icons | Lucide + custom aviation icons | shadcn default + custom |

### Server-Side Architecture

**Minimal server footprint:**
- Cloudflare Worker for Gemini API proxy (hides your API key)
- All flight CRUD, stats, profiles → client direct to Supabase
- Supabase RLS handles security

### Data Sources

| Data Type | Source | Storage |
|-----------|--------|---------|
| Aircraft | OpenFlights planes.dat | Static JSON bundle (173 aircraft) |
| Airports | Existing airports.json | Static JSON bundle |
| Airlines | Existing airlines.json | Static JSON bundle |
| Countries | Static JSON (basic geography) | name, ISO code, continent, UN region |
| Country enrichment | REST Countries API | On-demand lazy load for flags, etc. |

---

## Authentication & Onboarding

### Closed Beta Flow

1. User receives invite code (format: `KUUKI-XXXX-adjective-noun`)
2. Sign up: email + password + invite code
3. Code validated in real-time on blur
4. **Post-signup onboarding:**
   - Username picker (flexible format → normalized, e.g., "John Doe" → "john-doe")
   - Import CTA: "Import your flight history or add manually"
5. Profile auto-created via database trigger
6. Redirect to dashboard

### Invite System

- **Admin-only generation** (you create codes in Supabase)
- Single-use by default, configurable `max_uses`
- Format: `KUUKI-{4 chars}-{adjective}-{noun}`

### Email Verification

- **Optional** - unverified accounts work fine
- Verification unlocks password reset
- Reminder: Settings indicator (dot/badge on settings icon, not intrusive)

---

## Pre-Login Experience

### Landing Page

**Style:** Feature highlights (3-4 sections showing key features with screenshots/mockups)

Not elaborate - the showcase modals do the selling.

### Pre-Login Showcase (3 modals)

| Modal | Content |
|-------|---------|
| 1 | "Log Your Journeys - Build your flight collection. Every takeoff, every landing, remembered." |
| 2 | "Discover Your Stats - Distance flown, countries visited, airlines collected. See your patterns." |
| 3 | "Compare & Share - Join the leaderboard. Share your aviation story with the world." |

- **Skip button always visible** on every modal
- Remembered in localStorage (don't show again)

---

## Flight Data Model

### Core Flight Fields

| Field | Required | Notes |
|-------|----------|-------|
| date | ✅ | DATE |
| origin | ✅ | IATA code |
| destination | ✅ | IATA code |
| airline_iata | ✅ | Required for entry |
| aircraft_icao | ❌ | Optional - leave blank if unknown |
| flight_number | ❌ | |
| departure_utc | ❌ | Stored as UTC |
| arrival_utc | ❌ | Stored as UTC |
| origin_tz | ❌ | Timezone offset for display |
| dest_tz | ❌ | Timezone offset for display |
| distance_km | computed | Typical routing (+10% over great circle) |
| duration_minutes | computed | Per-aircraft estimates if times not provided |
| source | ✅ | 'manual' \| 'ai_import' |
| is_upcoming | ✅ | Future flights flagged separately |

### Not Tracked

- Cabin class (economy/business/first)
- Seat numbers
- Codeshare operating carrier (marketing carrier only)

### Distance Calculation

**Typical routing formula:** Great circle distance × 1.10

This approximates real flight paths better than pure Haversine.

### Duration Calculation (when times not provided)

Per-aircraft type estimates:
- Jet (narrow/widebody): ~850 km/h
- Regional jet: ~750 km/h
- Turboprop: ~500 km/h

### Future Flights

- Stored with `is_upcoming = true`
- **Don't count toward stats** until date passes
- Auto-convert to past flight when date ≤ today
- Display: **Countdown timers** ("3 days until JFK → LHR")

### Duplicate Handling

**Warn but allow:** Show "This looks like a duplicate" warning. User decides to proceed or cancel.

### Flight Deletion

**Confirm with consequences:** Hard delete, but warn user: "This may affect X badges and your leaderboard rank."

---

## AI Import (Gemini)

### Input Types

- PDF (boarding passes, itineraries)
- Screenshots
- Plain text (copy-pasted flight info)

### Processing Flow

1. **Upload → Preview** (user confirms before parsing)
2. Gemini OCR extracts text
3. Gemini semantic parsing + web search for enrichment
4. Multi-flight results: **Single list view** (all flights in scrollable list, edit inline, save all at once)

### AI Behavior

- **Allow inferences** (infer airline from flight number format, etc.)
- Enrichment scope: Airline + aircraft data (fill gaps like missing aircraft model)
- No loyalty program or service class info

### Confidence & Review

- All extracted data shown in review
- User confirms or corrects before saving

### API Key Management

- **Beta:** Your Gemini key (server-side proxy)
- **Post-launch:** User provides their own key (with instructions)

---

## Dashboard

### Layout Priority

**Stats summary first:**
1. Big numbers: total flights, distance, countries, airlines
2. Map below (private - not on public profile)
3. Recent flights list

### Empty State (new user)

**Sample data preview:** Show what dashboard WOULD look like with example data. "This could be you."

### Stats Tabs

**Progressive unlock:** Tabs appear as user has enough data.

| Tab | Unlock Criteria |
|-----|-----------------|
| Overview | Always visible |
| Avia Geek | 5+ aircraft types |
| Country Geek | 5+ countries |
| Duration Stats | 10+ flights |

---

## Stats System

### User Tiers (Progressive Unlock)

| Tier | Focus |
|------|-------|
| **Overview** | Flights, countries, distance, airlines |
| **Avia Geek** | Aircraft types, manufacturers, engine types, widebody vs narrowbody |
| **Country Geek** | Continents, regions, hemispheres, UN subregions, completion % |
| **Duration Stats** | Cumulative hours in air, longest flight, average duration trends |

### Time Metrics (replacing "streaks")

Focus on **Duration milestones:**
- Total hours/days in air
- Longest single flight
- Average flight duration
- Cumulative time in air visualization

### Aircraft Display

**Model primary:** "Boeing 737-800" displayed (manufacturer implied in name)

### Fun Facts

Comparative framing:
- "Distance to the Moon: 42% complete" (384,400 km)
- "You've flown X.X trips around Earth" (40,075 km each)
- "Time in air: X days, Y hours"
- "You've visited X% of all countries" (195 UN members)

### Units

**Kilometers only** (standard for aviation and most of the world)

---

## Visited Places

### Counting Rules

**Landed = visited:** If you landed there (origin or destination), it counts.

### Cities

- **Auto from airports:** Use airport city field directly
- Cities derived from flights vs manual entries: **Separate sections**
  - "Visited by flight"
  - "Also visited"

### Manual Place Addition

Users can:
1. Go to Visited Places view
2. Search for a town/city
3. Add it manually (appears in "Also visited" section)

---

## Passport Feature

### Overview

A personal "Nomad Passport" view at `/passport` with country stamps representing all visited countries. Countries are tracked from two sources:
- **Flight data:** Auto-derived from airport country codes (all touched airports, including layovers)
- **Manual claims:** For ground travel (land/sea entry methods)

**Visibility:** Always private (owner-only view)

### Stamp Design

| Element | Implementation |
|---------|----------------|
| **Shape** | Regional variation (circle for Asia, rectangle for EU/Americas/Africa/Oceania) |
| **Colors** | Flag colors as border/accent |
| **Text** | Native script name + English name |
| **Date** | Relative format ("2 years ago") |
| **Visit count** | Ink-stamped corner (×5) |
| **Background** | User's theme color as subtle tint |

### Stamp Interaction

- **Click/tap:** Mini popup with stats (first visit, last visit, total visits, airports)
- **No navigation:** Stays on passport view

### Country Claiming

Users can manually claim countries visited by ground travel:

1. Click "Add Country" button
2. Interactive map opens with country search
3. Select country from map or search
4. Optional: Add note, entry method (land/sea), visit year
5. Country appears as stamp in passport

### Data Model

**`country_claims` table:**
- `user_id` - Owner
- `country_code` - ISO 3166-1 alpha-2
- `claimed_at` - Timestamp
- `visit_year` - Optional approximate year
- `note` - Optional user note
- `entry_method` - 'land' | 'sea' | null

### Country Data

Static JSON with 246 countries/territories:
- ISO 3166-1 alpha-2 codes
- English and native names
- Flag colors (dominant + palette)
- Continent classification
- Stamp shape (circle/rectangle)
- Primary timezone

### Stats

Passport contributes to user stats:
- Countries count (visits + claims deduplicated)
- Continents count
- World completion % (countries / 246 × 100)
- Time zones crossed
- Most visited country

### Badges

Continent achievements (3+ countries required):
- **Europhile** - Europe
- **Asianaut** - Asia
- **Americas Wanderer** - Americas
- **Africa Explorer** - Africa
- **Pacific Voyager** - Oceania

---

## Map Visualization

### Library: Mapbox GL JS

- WebGL-based, smooth pan/zoom
- Great-circle arcs for flight routes
- React wrapper: `react-map-gl`

### Style

- **Flat world map** (not 3D globe)
- Curved arcs between airports
- Visited countries highlighted

### Privacy

- **Map is private** (not shown on public profiles)
- Only the user sees their route map

---

## Leaderboards

### Categories

| Category | Metric |
|----------|--------|
| countries | Unique countries visited |
| cities | Unique cities visited |
| flights | Total flight count |
| distance | Total km flown |
| airlines | Unique airlines |

### Display

**Percentile only:** "You're in the top 15%" (not exact rank - less intimidating)

### Anti-Gaming

**Community trust:** No hard limits. Public profiles + reporting. Gaming becomes obvious.

### Opt-In

User must enable `show_on_leaderboards` in settings to appear.

---

## Public Profiles

### URL

`/u/{username}`

### What's Public

- Username, display name, avatar, bio (140 chars max)
- Stats: flights, distance, countries, cities, airlines
- Badges earned
- Leaderboard percentile rankings

### What's Private

- **All individual flights** (only aggregate stats go public)
- **The route map** (stats only, no map on public profile)

### Actions for Visitors

**Compare stats:**
- Curated comparison by default (top 5 most interesting stats)
- Option for full side-by-side tables ("You vs Them")

---

## Badge System

### Style

**Mix of all:** Milestones + quirky achievements

### Categories

| Type | Examples |
|------|----------|
| **Milestones** | First Flight, Frequent Flyer (50), Centurion (100), Circumnavigator (40,075 km) |
| **Explorer** | Arctic Circle (flew above 66°N), Equator Hopper, Island Collector (10 island nations) |
| **Collector** | Fleet Master (20 aircraft types), Alliance Ace (all 3 major alliances), Retro (flew turboprop) |
| **Achievement** | Iron Butt (12+ hour flight), Night Owl (10 red-eyes), Jet Setter (3 continents in 30 days) |

### Display

**Minimal gamification:**
- Just show earned badges
- Don't display locked badges or progress toward next
- No active prompts like "Log 2 more to earn..."

### Evaluation

Badges evaluated via database trigger on flight insert.

---

## Flight Entry Form

### Required Fields

- Date
- Origin (IATA)
- Destination (IATA)
- Airline

### Optional Fields

- Aircraft type
- Flight number
- Departure/arrival times

### Autocomplete

**Combined scoring:** Match both code and name, rank by relevance. "NY" shows both NYC airports.

### List View

**Date descending** (most recent first)

### Keyboard UX

**Enhanced shortcuts:**
- Tab between fields
- Ctrl+S to save
- Escape to cancel
- Arrow keys in dropdowns

---

## Settings

### Configurable Preferences

| Setting | Notes |
|---------|-------|
| Language | EN / RU |
| Dark mode | User toggle |
| Profile visibility | Public / Private |
| Leaderboard opt-in | Yes / No |
| Display name | |
| Bio | 140 chars max |
| Gemini API key | For post-launch |
| Distance units | km only (future: user choice) |
| Date format | User preference |
| Email preferences | For future notification features |

---

## Error Handling

### Tone

**Aviation-themed:** "Flight log delayed on the tarmac. We're working to clear it for takeoff."

### Offline

**PWA later:** No offline support for MVP. Add PWA with caching in future phase.

---

## Data Export

**CSV export:** Simple download of all flights as CSV. Standard, portable.

---

## Notifications

**None for MVP:** User checks app when they want.

---

## Database Schema Updates

Based on interview decisions, schema adjustments:

```sql
-- Flights: add upcoming flag and timezone fields
flights (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  flight_number TEXT,
  date DATE,
  origin TEXT,
  destination TEXT,
  airline_iata TEXT NOT NULL,  -- now required
  aircraft_icao TEXT,          -- optional
  distance_km NUMERIC,
  duration_minutes INT,
  departure_utc TIMESTAMPTZ,
  arrival_utc TIMESTAMPTZ,
  origin_tz TEXT,              -- e.g., 'America/New_York'
  dest_tz TEXT,
  source TEXT,                 -- 'manual' | 'ai_import'
  is_upcoming BOOLEAN DEFAULT FALSE
)

-- Manual places (not from flights)
manual_places (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  country_code TEXT,
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Profiles: add settings
profiles (
  ...existing fields...
  bio TEXT CHECK (char_length(bio) <= 140),
  theme TEXT DEFAULT 'system',  -- 'light' | 'dark' | 'system'
  date_format TEXT DEFAULT 'ISO',
  -- Remove: home_airport (skipped for MVP)
)
```

---

## Implementation Priority

After core flight logging works:

1. **Stats** (build depth first)
2. **Profiles** (shareable layer)
3. **Leaderboards** (competition hook)

---

## Verification Checklist

1. **Auth:** Sign up with invite code, verify profile creation, 30-day session
2. **Flights:** Add flight manually with required fields (date, route, airline)
3. **AI Import:** Upload PDF/screenshot → preview → parse → review list → save
4. **Stats:** Check dashboard aggregations, progressive tab unlock
5. **Public Profile:** Visit `/u/{username}` logged out, verify stats-only (no map)
6. **Compare:** Compare your stats with another user
7. **Badges:** Add enough flights to trigger badge, verify earned (no progress shown)
8. **Dark mode:** Toggle theme, verify persistence
9. **i18n:** Switch to Russian, verify translations
10. **Upcoming flights:** Add future date, verify countdown, verify exclusion from stats
11. **Manual places:** Search and add city to "Also visited" section
12. **CSV export:** Download flight data, verify format
13. **Passport:** Navigate to `/passport`, verify stamps from flights, click stamp for popup
14. **Country claim:** Add country manually via map, verify stamp appears with note

---

## UI/UX Specifications

### Visual Design

| Aspect | Decision |
|--------|----------|
| **Aesthetic** | Modern but playful |
| **Responsiveness** | Truly responsive (distinct mobile/desktop layouts) |
| **Animations** | Subtle polish + delightful moments |
| **Loading states** | Skeleton placeholders |
| **Color themes** | Light, Dark, + 3 colorful themes (design with /interface-design) |
| **Dashboard layout** | Hybrid (decide with /interface-design) |

### Navigation

**Desktop:** Left sidebar with grouped sections
- Personal: Dashboard, Flights, Passport
- Explore: Stats, Leaderboard
- Account: Profile, Settings

**Sidebar behavior:** Collapsible with icons (user toggleable)

**Mobile:** Bottom tab bar with 5 items
- Dashboard | Flights | **Add** (center, prominent) | Stats | Profile

### Components

| Component | Implementation |
|-----------|----------------|
| **Toasts** | shadcn toast (built-in) |
| **Autocomplete** | shadcn Combobox |
| **Date picker** | Calendar dropdown |
| **Flight list (desktop)** | Table view |
| **Flight list (mobile)** | Card view |
| **List pagination** | "Load more" button |
| **Confirmation dialogs** | Inline confirmation ("Click again to confirm") |
| **Badges display** | Cards with icon + name + date earned |

### Flight Entry Form

**Layout:** Centered modal with progressive disclosure
- Required fields shown first (date, route, airline)
- "Add more details" expands optional fields (aircraft, times, flight number)

### Stats Cards

**Interaction:** Hover to reveal additional details/breakdown

### Compare View

**Layout:** Overlaid bar charts showing both users' stats

### Leaderboard

**Style:** Simple ranked list (no podium)

### Map Visualization

**Flight arcs:** Color-coded by attribute (user toggleable: airline, time period, distance)
**Countries:** Filled choropleth (visited countries colored)
**Controls:** Standard Mapbox controls (zoom, pan)

### Empty States

**Style:** Playful hand-drawn doodles + helpful text

### AI Import Loading

**Feedback:** Animated plane + progress steps
- "Reading file..."
- "Extracting text..."
- "Finding flights..."

### Showcase Modals (Pre-login)

**Illustrations:** AI-generated custom illustrations

### Avatars

**Default:** FaceHash.dev generated avatar
**Optional:** User can upload custom image

### Keyboard Shortcuts

**Essential only:**
- Cmd+K: Search
- Escape: Close modals

### Search/Filter (Flights)

**Capabilities:** Filter dropdowns
- Filter by year
- Filter by airline
- Filter by aircraft type

---

## Technical Specifications

### TypeScript

**Strictness:** Strict mode (all strict flags enabled)

### Error Handling

**Strategy:** Per-route error boundaries
- Each route has its own error boundary
- Global fallback for unexpected errors
- Errors don't crash entire app

### Bundle Optimization

**Strategy:** Route-based code splitting
- Lazy load Dashboard, Flights, Settings, Profile routes
- Map component lazy-loaded within routes

### Database

**Query pattern:** TanStack Query + Supabase
- useQuery/useMutation wrapping Supabase calls
- Automatic caching, retry, loading states
- Optimistic updates for snappy UX

**RLS strategy:** Strict owner-only
- Users can only CRUD their own data
- Leaderboard/profiles use separate RLS for public read

**Stats computation:** Materialized views with trigger refresh
- Views refresh on flight INSERT/UPDATE/DELETE
- Always accurate, acceptable at 50-500 user scale

### Testing

**Strategy:** Unit + component tests
- Vitest + Testing Library
- Test hooks, utilities, business logic
- Render tests for key components

### CI/CD

**Pipeline:** GitHub Actions + preview deployments

On PR:
1. Lint
2. Type-check
3. Test
4. Deploy preview to CF Pages

On merge to main:
- Auto-deploy to production

### Environments

**Strategy:** Dev + Prod
- Preview deployments for PRs
- Main branch = production

### Monitoring

**Strategy:** Sentry for error tracking
- Error tracking dashboard
- Console logging for development

### Account Deletion

**Available:** Yes, in settings
- Full GDPR-style delete
- Remove all user data

---

## Open Questions (for future consideration)

- Home airport feature (skipped for MVP)
- Calendar integration for upcoming flights
- Email notifications / monthly recaps
- Additional languages beyond EN/RU
- Mobile app (PWA first)
- Additional keyboard shortcuts for power users
