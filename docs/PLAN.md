---
title: "Kuuki (空気) - Implementation Plan"
created: 2026-01-31
tags: [project, kuuki, travel, flights, cloudflare, supabase]
type: plan
---

# Kuuki (空気) - Implementation Plan

## Workflow Instructions

**IMPORTANT**: Before implementing each step or feature from this plan:
1. Discuss and brainstorm the feature details with the user
2. Clarify any design decisions, edge cases, or alternatives
3. Get user approval before writing code
4. Use `/interface-design` skill for UI/UX decisions

This ensures collaborative development and avoids rework.

---

## Overview

**Kuuki** is a flight stats vault for aviation enthusiasts — log your journeys,
build your collection, discover patterns, and compare with others.

| Attribute | Value |
|-----------|-------|
| **Name** | Kuuki (空気) - "Air/Atmosphere" |
| **Domain** | kuuki.indi256.com |
| **Architecture** | Cloudflare Pages/Workers + Supabase |

---

## Core Features

1. **Flight Logging** - AI (Gemini) + manual entry for past flights
2. **Stats Vault** - Your complete aviation history in one place
3. **Visited Places** - Auto-extracted from flights (countries, cities, airports)
4. **Multi-Category Leaderboards** - Countries, cities, flights, distance, airlines (opt-in)
5. **Public Profiles** - Shareable pages with stats, map, badges
6. **Achievements** - Badge system for milestones
7. **Pre-Login Showcase** - 2-3 modal walkthrough before login
8. **Multi-Tier Stats** - For normal users, frequent travelers, avia geeks, country geeks, and time geeks

---

## Internationalization

| Language | Code | Status |
|----------|------|--------|
| English | en | Primary |
| Russian | ru | Full support |

**Implementation:**
- Library: `react-i18next`
- Translations: `packages/shared/src/i18n/{en,ru}.json`
- Detection: Browser locale, with manual override in settings
- RTL: Not needed for en/ru

---

## Pre-Login Onboarding

Before the login screen, show a 3-modal feature walkthrough:

| Modal | Content |
|-------|---------|
| 1. Log Your Journeys | "Build your flight collection. Every takeoff, every landing, remembered." |
| 2. Discover Your Stats | "Distance flown, countries visited, airlines collected. See your patterns." |
| 3. Compare & Share | "Join the leaderboard. Share your aviation story with the world." |

- Skip button **always visible** on every modal
- Remembered in localStorage (don't show again)
- Clean, visual design with illustrations

---

## Stats System

### User Tiers

| Tier | Target User | Focus |
|------|-------------|-------|
| **Overview** | Everyone | Clean summary: flights, countries, distance, airlines |
| **Frequent Traveler** | Road warriors | Most-flown routes, flights per period, airline loyalty, travel streaks |
| **Avia Geek** | Aviation enthusiasts | Aircraft types, manufacturers, engine types, widebody vs narrowbody |
| **Country Geek** | Geography lovers | Continents, regions, hemispheres, UN subregions, completion % |
| **Time Geek** | Pattern seekers | Hours in air, streaks, busiest months, day vs night, time zones |

### Stats Categories

**Basic Stats**
- Total flights, distance (km), time in air
- Countries, cities, airports visited
- Airlines, aircraft types flown

**Aviation Deep Dive**
- Aircraft breakdown (widebody vs narrowbody vs regional)
- Top manufacturers (Boeing, Airbus, Embraer)
- Engine types flown (jet, turboprop, piston)
- Longest/shortest flights
- Most flown routes

**Geographic Deep Dive**
- Continents visited (with completion %)
- UN regions and subregions
- Hemispheres (N/S, E/W)
- Furthest point from home airport
- Climate zones crossed
- Countries by region map

**Time & Patterns**
- Total hours/days in the air
- Longest travel streak
- Busiest year/month/day of week
- Morning vs evening flights
- Timezone crossings
- Seasonal patterns

### Fun Facts (Comparative)

Auto-generated insights with comparative framing:
- "Distance to the Moon: 42% complete" (384,400 km)
- "You've flown X.X trips around Earth" (40,075 km each)
- "Time in air: X days, Y hours"
- "You've crossed X time zones"
- "Furthest from home: X,XXX km (City, Country)"
- "You've visited X% of all countries" (195 UN members)

### Comparison Stats
- "You've flown further than X% of users"
- "Top 10% in countries visited"
- Personal bests and records

*(UI layout decided via /interface-design)*

---

## Reference Data: Aircraft

### Data Source
Static JSON bundled in `packages/data/` (~50KB)

**Primary:** OpenFlights planes.dat (173 common commercial aircraft)
- Covers 90%+ of actual passenger flights
- Free, curated, reliable

**Future expansion:** ADS-B Exchange for rare aircraft

### Schema (TypeScript)
```typescript
interface Aircraft {
  icao: string;           // "B738" - primary key
  iata: string | null;    // "738"
  manufacturer: string;   // "Boeing"
  model: string;          // "737-800"
  name: string;           // "Boeing 737-800"
  type: 'widebody' | 'narrowbody' | 'regional' | 'turboprop';
  engineType: 'jet' | 'turboprop' | 'piston';
  engineCount: number;
  capacity: number | null;
}
```

### File Location
```
packages/
├── data/
│   └── src/
│       ├── aircraft.json    # 173 aircraft
│       ├── airports.json    # existing
│       └── airlines.json    # existing
```

### Usage
```typescript
import aircraft from '@kuuki/data/aircraft.json';

const find = (icao: string) => aircraft.find(a => a.icao === icao);
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui (design via /interface-design later) |
| State | Zustand + TanStack Query |
| Maps | Mapbox GL JS or deck.gl |
| i18n | react-i18next |
| Hosting | Cloudflare Pages |
| Edge API | Cloudflare Workers + KV (caching) |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (Google OAuth) |
| AI | Google Gemini (user's own key) |

---

## Database Schema

### Core Tables

```sql
-- User profiles (extends auth.users)
profiles (
  id UUID PRIMARY KEY,     -- = auth.uid
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  home_airport TEXT,       -- IATA
  is_public BOOLEAN,
  show_on_leaderboards BOOLEAN,
  gemini_api_key TEXT,     -- encrypted
  locale TEXT              -- 'en' | 'ru'
)

-- Flights
flights (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  flight_number TEXT,
  date DATE,
  origin TEXT,             -- IATA
  destination TEXT,        -- IATA
  airline_iata TEXT,
  aircraft_icao TEXT,
  distance_km NUMERIC,
  duration_minutes INT,
  source TEXT              -- 'manual' | 'ai_import'
)

-- Visited places (computed from flights)
visits (
  user_id UUID,
  country_code TEXT,
  city TEXT,
  airport_iata TEXT,
  first_visit DATE,
  last_visit DATE,
  visit_count INT
)

-- Leaderboard cache (materialized)
leaderboard_cache (
  category TEXT,           -- 'countries' | 'cities' | 'flights' | 'distance' | 'airlines'
  user_id UUID,
  rank INT,
  value NUMERIC,
  metadata JSONB
)

-- Badges
badge_definitions (code, name, description, category, criteria JSONB)
user_badges (user_id, badge_id, earned_at)

-- Reference data
airports (iata, icao, name, city, country, country_code, lat, lng)
airlines (iata, icao, name, logo_url)
```

### Key Indexes
```sql
CREATE INDEX idx_flights_user_date ON flights(user_id, date DESC);
CREATE INDEX idx_leaderboard_category_rank ON leaderboard_cache(category, rank);
CREATE INDEX idx_profiles_username ON profiles(username);
```

### Row-Level Security
- Flights: Private to owner
- Profiles: Public if `is_public = true`
- Leaderboard: Only shows opted-in users

---

## Project Structure

```
kuuki/
├── apps/
│   └── web/                    # React SPA
│       └── src/
│           ├── routes/         # Pages (dashboard, flights, import, leaderboards, profile)
│           ├── components/     # UI, flights, maps, charts, leaderboard
│           ├── hooks/          # useAuth, useFlights, useStats
│           ├── lib/            # supabase client, api helpers
│           └── stores/         # Zustand stores
├── packages/
│   ├── shared/                 # Types, constants
│   │   └── src/
│   │       └── i18n/
│   │           ├── en.json
│   │           └── ru.json
│   └── data/                   # Static reference data
│       └── src/
│           ├── aircraft.json
│           ├── airports.json
│           └── airlines.json
├── functions/                  # CF Workers (edge API)
│   └── api/
│       ├── leaderboard/[category].ts
│       ├── profile/[username].ts
│       └── import/parse.ts
└── supabase/
    ├── migrations/             # SQL migrations
    └── functions/              # Edge functions (leaderboard compute)
```

---

## API Architecture

### Edge Layer (Cloudflare Workers)
- **GET /api/leaderboard/:category** - Cached in KV (5min TTL)
- **GET /api/profile/:username** - Cached public profiles
- **POST /api/import/parse** - AI parsing proxy

### Direct Supabase (Authenticated)
- Flight CRUD
- User settings
- Private stats

---

## Leaderboard System

### Categories
| Category | Metric |
|----------|--------|
| countries | Unique countries visited |
| cities | Unique cities visited |
| flights | Total flight count |
| distance | Total km flown |
| airlines | Unique airlines |

### Computation
- PostgreSQL functions with `RANK() OVER`
- Scheduled via pg_cron every 15 minutes
- Results cached in `leaderboard_cache` table + Cloudflare KV

---

## Public Profiles

### URLs
- `/u/{username}` - Profile page
- `/u/{username}/map` - Full-screen travel map
- `/u/{username}/badges` - Achievements

### Exposed Data
- Username, display name, avatar, bio
- Stats: flights, distance, countries, cities, airlines
- Visited countries map
- Top airlines
- Badges earned
- Leaderboard rankings

---

## Badge System

### Examples
| Badge | Criteria |
|-------|----------|
| First Flight | 1 flight |
| Frequent Flyer | 50 flights |
| Centurion | 100 flights |
| Circumnavigator | 40,075 km total |
| Globe Trotter | 10 countries |
| Continental | 6 continents |
| Airline Hopper | 10 airlines |

Badges evaluated via database trigger on flight insert.

---

## Authentication Flow

1. User clicks "Sign in with Google"
2. Supabase OAuth redirect
3. Callback at `/auth/callback`
4. If no profile → onboarding (pick username)
5. Redirect to dashboard

---

## Deployment

### Cloudflare Pages
```yaml
# GitHub Actions
- pnpm install
- pnpm build
- wrangler pages deploy apps/web/dist --project-name=kuuki
```

### Supabase
```bash
supabase link --project-ref <id>
supabase db push
supabase gen types typescript > packages/shared/src/database.types.ts
```

### Domain
- Add `kuuki.indi256.com` CNAME to CF Pages
- SSL automatic

---

## Step 0: Project Setup

### Create New Repository
```bash
# Create project directory
mkdir ~/kuuki && cd ~/kuuki

# Initialize git
git init

# Create GitHub repo
gh repo create indi256s/kuuki --public --source=. --push
```

### Initialize Monorepo
```bash
# Initialize pnpm workspace
pnpm init

# Create workspace config
echo 'packages:
  - "apps/*"
  - "packages/*"' > pnpm-workspace.yaml

# Add Turborepo
pnpm add -D turbo

# Create initial structure
mkdir -p apps/web packages/shared packages/data functions/api supabase/migrations
```

### Create Supabase Project
1. Go to supabase.com → New Project
2. Name: `kuuki`
3. Region: Choose closest to target users
4. Save project URL and anon key

### Configure Cloudflare Pages
1. CF Dashboard → Pages → Create project
2. Connect to `indi256s/kuuki` repo
3. Build settings: `pnpm build`, output: `apps/web/dist`
4. Add custom domain: `kuuki.indi256.com`

---

## Implementation Phases

### Phase 0.5: Reference Data
- [ ] Download OpenFlights planes.dat
- [ ] Parse and convert to aircraft.json
- [ ] Add TypeScript types
- [ ] Create aircraft lookup utilities

### Phase 1: Foundation
- [ ] Create GitHub repo `indi256s/kuuki`
- [ ] Initialize monorepo (pnpm + Turborepo)
- [ ] Create Supabase project + apply schema
- [ ] Set up Cloudflare Pages
- [ ] Implement auth flow
- [ ] Set up react-i18next with en/ru translations

### Phase 1.5: Onboarding & Landing
- [ ] Pre-login modal showcase (3 slides)
- [ ] Landing page design
- [ ] Post-login onboarding (username, home airport)
- [ ] Empty states for new users

### Phase 2: Core
- [ ] Flight CRUD
- [ ] Manual entry form
- [ ] Dashboard with stats
- [ ] Route map visualization

### Phase 3: AI Import
- [ ] Gemini integration
- [ ] Image/text upload
- [ ] Import review UI

### Phase 4: Social
- [ ] Public profiles
- [ ] Leaderboard system
- [ ] Badge evaluation
- [ ] Share functionality

### Phase 5: Advanced Stats
- [ ] Basic stats dashboard
- [ ] Frequent Traveler stats (routes, loyalty, streaks)
- [ ] Avia geek stats (aircraft, manufacturers, engines)
- [ ] Country geek stats (regions, continents, completion %)
- [ ] Time stats (patterns, streaks)
- [ ] Fun facts (Moon distance, Earth circumnavigations, etc.)
- [ ] Comparison stats ("better than X%")

### Phase 6: Polish
- [ ] Edge caching optimization
- [ ] Mobile responsiveness
- [ ] Error handling
- [ ] Design system (/interface-design)

---

## Verification

1. **Auth**: Sign in with Google, verify profile creation
2. **Flights**: Add flight manually, verify appears in list
3. **AI Import**: Paste boarding pass, verify extraction
4. **Stats**: Check dashboard aggregations match flight data
5. **Leaderboard**: Opt-in, verify ranking appears
6. **Public Profile**: Visit `/u/{username}` logged out
7. **Badges**: Add enough flights to trigger badge, verify earned
8. **i18n**: Switch locale, verify all strings translated
9. **Aircraft Data**: Add flight with aircraft, verify type/manufacturer displayed
