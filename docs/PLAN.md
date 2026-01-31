---
title: "Kuuki - Implementation Plan"
created: 2026-01-31
tags: [project, kuuki, travel, flights, cloudflare, supabase]
type: plan
---

# Kuuki - Implementation Plan

> **Full specification:** See [SPEC.md](./SPEC.md) for complete product requirements.

## Workflow Instructions

**IMPORTANT**: Before implementing each step or feature from this plan:
1. Discuss and brainstorm the feature details with the user
2. Clarify any design decisions, edge cases, or alternatives
3. Get user approval before writing code
4. Use the recommended skills and MCP servers listed in each phase

This ensures collaborative development and avoids rework.

---

## Available Tools Reference

### Skills (Claude Code)

| Skill | Use Case |
|-------|----------|
| `/frontend-design` | Creative, distinctive UI — landing pages, shareable profiles, playful visualizations |
| `/interface-design` | App interfaces — dashboards, forms, data tables, admin panels |
| `/interface-design:init` | Initialize design system (tokens, patterns) |
| `/interface-design:audit` | Check consistency against design system |
| `/interface-design:extract` | Extract patterns from existing code |
| `/playground` | Interactive HTML prototypes — explorers, configurators |

### Development Workflow Skills

| Skill | Use Case |
|-------|----------|
| `/superpowers:brainstorming` | Before any feature work — explore intent, requirements, design before implementation |
| `/superpowers:test-driven-development` | Before writing implementation — RED/GREEN/REFACTOR cycle |
| `/superpowers:systematic-debugging` | When encountering bugs — structured diagnosis before proposing fixes |
| `/superpowers:verification-before-completion` | Before claiming work is done — run tests, verify output, evidence before assertions |
| `/code-review:code-review` | Review PRs against requirements and coding standards |
| `/superpowers:writing-skills` | Creating or editing skills for this project |

### MCP Servers

| Server | Capabilities |
|--------|--------------|
| `supabase` | DB schema, migrations, RLS policies, edge functions, TypeScript types |
| `context7` | Up-to-date docs for libraries (Mapbox, react-map-gl, Gemini SDK, etc.) |
| `playwright` | Browser automation — E2E tests, visual regression, screenshot generation |

---

## Overview

**Kuuki** is a flight stats vault for aviation enthusiasts — log your journeys,
build your collection, discover patterns, and compare with others.

| Attribute | Value |
|-----------|-------|
| **Name** | Kuuki (display as "Kuuki" only, no kanji) |
| **Domain** | kuuki.indi256.com |
| **Scale** | 50-500 users (first 6 months) |
| **Launch** | Feature-complete beta |

---

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React 19 + Vite + TypeScript | Strict mode |
| Styling | Tailwind CSS + shadcn/ui | Dark mode via user toggle |
| State | Zustand + TanStack Query | |
| Maps | **Mapbox GL JS** + react-map-gl | Flat world map with great-circle arcs |
| i18n | react-i18next | EN primary, RU via AI-assisted translation |
| Forms | React Hook Form + Zod | Validation with TypeScript inference |
| Dates | Luxon | Best timezone support for UTC + local display |
| Charts | Recharts | React-native, good defaults |
| Icons | Lucide + custom aviation icons | shadcn default + custom |
| Hosting | Cloudflare Pages | |
| Edge API | Cloudflare Workers | **AI parsing only** - all other CRUD direct to Supabase |
| Database | Supabase PostgreSQL | |
| Auth | Supabase Auth (email/password) | 30-day sessions, optional email verification |
| AI | Google Gemini 3.0 Flash | Your key for beta, users bring their own post-launch |

---

## Core Features

1. **Flight Logging** - AI (Gemini) + manual entry
2. **Stats Vault** - Complete aviation history with progressive unlock tiers
3. **Visited Places** - Auto-extracted from flights + manual additions
4. **Leaderboards** - Countries, cities, flights, distance, airlines (opt-in, percentile-based)
5. **Public Profiles** - Shareable stats + badges (map is private)
6. **Badges** - Milestones + quirky achievements (minimal gamification)
7. **Pre-Login Showcase** - 3 modal walkthrough

---

## Stats System (Progressive Unlock)

| Tier | Unlock Criteria | Focus |
|------|-----------------|-------|
| **Overview** | Always visible | Flights, countries, distance, airlines |
| **Avia Geek** | 5+ aircraft types | Aircraft types, manufacturers, engine types, widebody vs narrowbody |
| **Country Geek** | 5+ countries | Continents, regions, hemispheres, UN subregions, completion % |
| **Duration Stats** | 10+ flights | Cumulative hours in air, longest flight, average duration trends |

### Fun Facts (Comparative)
- "Distance to the Moon: 42% complete" (384,400 km)
- "You've flown X.X trips around Earth" (40,075 km each)
- "Time in air: X days, Y hours"
- "You've visited X% of all countries" (195 UN members)

---

## Database Schema

### Core Tables

```sql
-- User profiles (extends auth.users)
profiles (
  id UUID PRIMARY KEY,           -- = auth.uid
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT CHECK (char_length(bio) <= 140),
  is_public BOOLEAN DEFAULT FALSE,
  show_on_leaderboards BOOLEAN DEFAULT FALSE,
  gemini_api_key TEXT,           -- encrypted, for post-launch
  locale TEXT DEFAULT 'en',      -- 'en' | 'ru'
  theme TEXT DEFAULT 'system',   -- 'light' | 'dark' | 'system'
  date_format TEXT DEFAULT 'ISO',
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Flights
flights (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  flight_number TEXT,
  date DATE NOT NULL,
  origin TEXT NOT NULL,          -- IATA
  destination TEXT NOT NULL,     -- IATA
  airline_iata TEXT NOT NULL,    -- Required
  aircraft_icao TEXT,            -- Optional
  distance_km NUMERIC,           -- Computed: great circle × 1.10
  duration_minutes INT,          -- Computed or from times
  departure_utc TIMESTAMPTZ,
  arrival_utc TIMESTAMPTZ,
  origin_tz TEXT,                -- e.g., 'America/New_York'
  dest_tz TEXT,
  source TEXT NOT NULL,          -- 'manual' | 'ai_import'
  is_upcoming BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Manual places (not from flights)
manual_places (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  country_code TEXT NOT NULL,
  city TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Badges
badge_definitions (code TEXT PRIMARY KEY, name TEXT, description TEXT, category TEXT, criteria JSONB)
user_badges (user_id UUID, badge_code TEXT, earned_at TIMESTAMPTZ DEFAULT NOW())

-- Beta invites (closed beta only)
beta_invites (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,     -- 'KUUKI-XXXX-adjective-noun'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_by UUID REFERENCES profiles(id),
  used_at TIMESTAMPTZ,
  max_uses INT DEFAULT 1,
  uses INT DEFAULT 0,
  note TEXT
)
```

### Materialized Views (Stats)
```sql
-- Refresh on flight INSERT/UPDATE/DELETE via trigger
user_stats_mv (
  user_id UUID,
  total_flights INT,
  total_distance_km NUMERIC,
  total_duration_minutes INT,
  countries_count INT,
  cities_count INT,
  airlines_count INT,
  aircraft_types_count INT,
  updated_at TIMESTAMPTZ
)
```

### Key Indexes
```sql
CREATE INDEX idx_flights_user_date ON flights(user_id, date DESC);
CREATE INDEX idx_flights_user_upcoming ON flights(user_id, is_upcoming) WHERE is_upcoming = true;
CREATE INDEX idx_profiles_username ON profiles(username);
```

### Row-Level Security
- Flights: Owner-only CRUD
- Profiles: Owner CRUD, public read if `is_public = true`
- Leaderboard: Public read for opted-in users only

---

## Navigation

### Desktop
Left sidebar with grouped sections (collapsible):
- **Personal:** Dashboard, Flights
- **Explore:** Stats, Leaderboard
- **Account:** Profile, Settings

### Mobile
Bottom tab bar with 5 items:
- Dashboard | Flights | **Add** (center, prominent) | Stats | Profile

---

## Current Implementation Status

### Completed Features

**Aircraft Reference Data (`@kuuki/data`)**
- 173 commercial aircraft from OpenFlights
- Classified by type: widebody (41), narrowbody (68), regional (34), turboprop (30)
- Engine types: jet, turboprop, piston
- TypeScript types with full schema

**Authentication System**
- Closed beta with invite codes
- Email/password authentication via Supabase
- Real-time invite code validation
- SignInForm and SignUpForm components
- useAuth hook with Zustand state management
- Auto-profile creation via database trigger

**Internationalization**
- react-i18next with browser detection
- English (en) and Russian (ru) translations
- Language switcher component
- Persistent language preference

**Testing**
- Vitest with jsdom environment
- 26 tests passing:
  - Auth functions: 10 tests
  - SignInForm: 7 tests
  - SignUpForm: 9 tests
- Supabase mock utilities for isolated testing

### Project Structure (Current)
```
kuuki/
├── apps/
│   └── web/                     # React SPA (Vite + TypeScript)
│       └── src/
│           ├── components/
│           │   ├── auth/        # SignInForm, SignUpForm
│           │   └── ProtectedRoute.tsx
│           ├── hooks/           # useAuth, useLanguage
│           ├── lib/             # supabase, auth, i18n, database.types
│           ├── routes/          # AuthPage, DashboardPage
│           ├── stores/          # authStore (Zustand)
│           └── test/            # mocks, setup
├── packages/
│   ├── shared/                  # Shared code
│   │   └── src/i18n/           # en.json, ru.json
│   └── data/                    # Static reference data
│       └── src/
│           └── aircraft.json    # 173 aircraft
├── functions/                   # CF Workers (edge API)
│   └── api/
│       └── import/parse.ts      # Gemini proxy only
├── supabase/
│   └── migrations/              # SQL migrations
└── docs/
    ├── PLAN.md                  # This file
    └── SPEC.md                  # Full product specification
```

---

## Implementation Phases

**Cross-cutting workflow (applies to all phases):**
- `/superpowers:brainstorming` before starting any feature
- `/superpowers:test-driven-development` when writing implementation code
- `/superpowers:systematic-debugging` when encountering failures
- `/superpowers:verification-before-completion` before marking tasks done
- `/code-review:code-review` after completing each phase

### Phase 0.5: Reference Data ✅
- [x] Download OpenFlights planes.dat
- [x] Parse and convert to aircraft.json (173 aircraft)
- [x] Add TypeScript types with aircraft classification
- [x] Create aircraft lookup utilities

### Phase 1: Foundation 🔄
- [x] Create GitHub repo `indi256s/kuuki`
- [x] Initialize monorepo (pnpm + Turborepo)
- [x] Create Supabase project + apply schema
- [ ] Set up Cloudflare Pages
- [x] Implement auth flow (closed beta with invite codes)
- [x] Set up react-i18next with en/ru translations
- [x] Add comprehensive test suite (26 tests passing)

### Phase 1.5: Onboarding & Landing
- [ ] Pre-login modal showcase (3 slides)
  - **Skill**: `/frontend-design` — creative, eye-catching modal sequence
- [ ] Landing page (feature highlights style)
  - **Skill**: `/frontend-design` — distinctive landing with aviation aesthetic
- [ ] Post-login onboarding (username picker only, no home airport)
  - **Skill**: `/interface-design` — username normalization, import CTA
- [ ] Empty states for new users (sample data preview)
  - **Skill**: `/interface-design` — "This could be you" with example data

### Phase 2: Core Flight Management
- [ ] Flight CRUD with updated schema
  - **Workflow**: `/superpowers:test-driven-development` — critical data layer
  - **MCP**: `supabase` — migrations with new fields (is_upcoming, timezones)
  - Required fields: date, origin, destination, airline
  - Optional fields: aircraft, flight number, departure/arrival times
- [ ] Flight entry form (modal with progressive disclosure)
  - **Skill**: `/interface-design` — autocomplete for airports/airlines/aircraft
  - "Add more details" expands optional fields
- [ ] Future flights with countdown timers
  - Exclude from stats until date passes
- [ ] Duplicate detection (warn but allow)
- [ ] Flight deletion with consequences warning
- [ ] Dashboard with stats summary
  - **Skill**: `/interface-design` — big numbers first, then map, then recent flights
- [ ] Route map visualization (private, flat world map)
  - **Skill**: `/frontend-design` — curved arcs, visited countries choropleth
  - **MCP**: `context7` — Mapbox GL JS + react-map-gl documentation

### Phase 3: AI Import
- [ ] Cloudflare Worker for Gemini proxy
  - **MCP**: `context7` — Google Gemini 3.0 Flash SDK
  - Hides your API key during beta
- [ ] Upload UI (PDF, screenshots, plain text)
  - **Skill**: `/interface-design` — drag-drop zone, paste support
  - Loading feedback: "Reading file..." → "Extracting text..." → "Finding flights..."
- [ ] Import review (single list view, edit inline, save all)
  - **Skill**: `/interface-design` — editable table with all extracted data
  - Allow AI inferences (airline from flight number, etc.)

### Phase 4: Social
- [ ] Public profiles (`/u/{username}`)
  - **Workflow**: `/code-review:code-review` — security review before exposing
  - **Skill**: `/frontend-design` — shareable profile (stats + badges, no map)
  - Stats: flights, distance, countries, cities, airlines
  - Compare feature: curated comparison or full side-by-side
- [ ] Leaderboard system (percentile-based, not exact rank)
  - **Skill**: `/interface-design` — simple ranked list, category tabs
  - **MCP**: `supabase` — materialized views with trigger refresh
- [ ] Badge evaluation
  - **MCP**: `supabase` — database triggers on flight insert
  - Display: earned badges only, no progress indicators

### Phase 5: Advanced Stats
- [ ] Overview tier (always visible)
  - **Skill**: `/interface-design` — stat cards with hover details
- [ ] Avia Geek tier (unlocks at 5+ aircraft types)
  - **Skill**: `/interface-design` — aircraft breakdown charts
  - Aircraft types, manufacturers, engine types, widebody vs narrowbody
- [ ] Country Geek tier (unlocks at 5+ countries)
  - **Skill**: `/interface-design` — choropleth maps, completion progress
  - Continents, UN regions, hemispheres, completion %
- [ ] Duration Stats tier (unlocks at 10+ flights)
  - **Skill**: `/interface-design` — time visualizations
  - Total hours/days in air, longest flight, average duration
- [ ] Fun facts (comparative framing)
  - **Skill**: `/frontend-design` — playful visualizations
  - Moon distance progress, Earth circumnavigations, country completion %

### Phase 6: Polish
- [ ] Dark mode toggle (light/dark/system)
- [ ] Mobile responsiveness (distinct layouts)
  - **Skill**: `/interface-design:audit` — responsive breakpoint review
  - **MCP**: `playwright` — mobile viewport testing
- [ ] Error handling (aviation-themed messages)
  - **Skill**: `/interface-design` — error states, toast notifications
  - "Flight log delayed on the tarmac. We're working to clear it for takeoff."
- [ ] CSV export
- [ ] Account deletion (GDPR-style)
- [ ] Design system finalization
  - **Skill**: `/interface-design:init` — establish tokens, patterns
  - **Skill**: `/interface-design:audit` — consistency check across app
- [ ] CI/CD pipeline (GitHub Actions)
  - Lint → Type-check → Test → Deploy preview (PR) / production (main)

---

## Verification Checklist

From SPEC.md:

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

### Automated Tests (26 passing)

```bash
cd apps/web && pnpm test
```

| Test Suite | Tests | Status |
|------------|-------|--------|
| `src/lib/auth.test.ts` | 10 | ✅ |
| `src/components/auth/SignInForm.test.tsx` | 7 | ✅ |
| `src/components/auth/SignUpForm.test.tsx` | 9 | ✅ |
