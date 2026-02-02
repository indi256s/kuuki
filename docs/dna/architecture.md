# Kuuki DNA: Architecture

> Technical stack and architectural decisions.
> References PRINCIPLES.md → Technical Philosophy.

---

## Stack Overview

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React 19 + Vite + TypeScript | SPA, client-side routing |
| Styling | Tailwind CSS v4 + shadcn/ui | OKLCH colors, New York style |
| State | Zustand + TanStack Query | Local state + server state separation |
| Maps | Mapbox GL JS + react-map-gl | WebGL, great-circle arcs |
| i18n | react-i18next | EN primary, RU secondary |
| Forms | React Hook Form + Zod | Validation with TypeScript inference |
| Dates | Luxon | Best timezone support |
| Charts | Recharts | React-native charting |
| Icons | Lucide React | shadcn default |
| Hosting | Cloudflare Pages | Edge-deployed SPA |
| Edge API | Cloudflare Workers | Gemini proxy only |
| Database | Supabase PostgreSQL | Direct client access |
| Auth | Supabase Auth | Email/password, 30-day sessions |
| AI | Google Gemini 3.0 Flash | OCR + semantic parsing |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Pages                         │
│                    (React SPA + Assets)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      User's Browser                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Zustand   │  │  TanStack   │  │   React Components  │  │
│  │   (local)   │  │   Query     │  │                     │  │
│  └─────────────┘  └──────┬──────┘  └─────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          ▼                                 ▼
┌──────────────────┐              ┌──────────────────┐
│     Supabase     │              │ Cloudflare Worker│
│   (PostgreSQL)   │              │  (Gemini Proxy)  │
│                  │              │                  │
│  • Auth          │              │  • Hides API key │
│  • Flight CRUD   │              │  • OCR + parsing │
│  • RLS security  │              │                  │
│  • Triggers      │              └────────┬─────────┘
└──────────────────┘                       │
                                           ▼
                                 ┌──────────────────┐
                                 │   Google Gemini  │
                                 │   3.0 Flash API  │
                                 └──────────────────┘
```

---

## Why This Architecture

### Direct Supabase Access

**Decision:** Client talks directly to Supabase for all CRUD operations.

**Why:**
- No backend server to maintain
- Supabase RLS handles security at the database level
- Real-time subscriptions available if needed
- Reduces latency (no proxy hop)

**Trade-off:** Can't add server-side business logic easily. Acceptable for our scale.

### Cloudflare Worker for AI Only

**Decision:** Worker exists solely to proxy Gemini API calls.

**Why:**
- Hides API key from client
- Allows rate limiting if needed
- Single responsibility

**NOT used for:**
- Flight CRUD (goes direct to Supabase)
- Auth (handled by Supabase)
- Stats computation (done in Supabase triggers)

### Static Data Bundles

**Decision:** Aircraft, airports, airlines shipped as static JSON.

| Data | Source | Count |
|------|--------|-------|
| Aircraft | OpenFlights planes.dat | 726 types |
| Airports | Custom airports.json | 512 airports |
| Airlines | Custom airlines.json | 162 airlines |
| Countries | Custom countries.json | 246 territories |

**Why:**
- No API calls for reference data
- Fast autocomplete
- Works offline (data cached)
- Strong Russia/CIS/Asia coverage (personal preference)

**Trade-off:** Data can become stale. Manual updates needed. Acceptable for hobby project.

---

## Database Design

### Core Tables

```sql
-- Users (managed by Supabase Auth)
auth.users

-- User profiles (public-facing data)
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT CHECK (char_length(bio) <= 140),
  theme TEXT DEFAULT 'system',
  language TEXT DEFAULT 'en',
  is_public BOOLEAN DEFAULT false,
  show_on_leaderboards BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Flight log
flights (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  date DATE NOT NULL,
  origin TEXT NOT NULL,        -- IATA code
  destination TEXT NOT NULL,   -- IATA code
  airline_iata TEXT NOT NULL,
  aircraft_icao TEXT,
  flight_number TEXT,
  departure_utc TIMESTAMPTZ,
  arrival_utc TIMESTAMPTZ,
  distance_km NUMERIC,
  duration_minutes INT,
  source TEXT NOT NULL,        -- 'manual' | 'ai_import'
  is_upcoming BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Denormalized stats (updated by triggers)
user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users,
  total_flights INT DEFAULT 0,
  total_distance_km NUMERIC DEFAULT 0,
  total_duration_minutes INT DEFAULT 0,
  unique_countries INT DEFAULT 0,
  unique_cities INT DEFAULT 0,
  unique_airlines INT DEFAULT 0,
  unique_aircraft INT DEFAULT 0,
  world_completion_pct NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Earned badges
user_badges (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  badge_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
)

-- Manual country claims (for ground travel)
country_claims (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  country_code TEXT NOT NULL,  -- ISO 3166-1 alpha-2
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  visit_year INT,
  note TEXT,
  entry_method TEXT,           -- 'land' | 'sea' | null
  UNIQUE(user_id, country_code)
)

-- Invite codes (admin-managed)
invite_codes (
  code TEXT PRIMARY KEY,
  max_uses INT DEFAULT 1,
  times_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### Row Level Security (RLS)

**Philosophy:** Strict owner-only access with public read for profiles.

```sql
-- Flights: owner only
CREATE POLICY "Users can CRUD own flights"
ON flights FOR ALL
USING (auth.uid() = user_id);

-- Profiles: owner can edit, public can read if is_public
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Public profiles are readable"
ON profiles FOR SELECT
USING (is_public = true OR auth.uid() = id);

-- Stats: same pattern as profiles
CREATE POLICY "Public stats are readable"
ON user_stats FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = user_stats.user_id
    AND (profiles.is_public = true OR profiles.id = auth.uid())
  )
);
```

### Triggers

**Stats computation:** Materialized in `user_stats` table, updated by trigger on flight INSERT/UPDATE/DELETE.

**Badge evaluation:** Trigger chain: flight change → stats update → badge evaluation.

**Why triggers over computed views:**
- Faster reads (pre-computed)
- Acceptable write overhead at 50-500 user scale
- Simpler queries in frontend

---

## Data Flow

### Flight Creation (Manual)

```
User fills form
    ↓
React Hook Form validates with Zod
    ↓
TanStack Query mutation
    ↓
Supabase client.from('flights').insert()
    ↓
RLS validates user_id
    ↓
Trigger updates user_stats
    ↓
Trigger evaluates badges
    ↓
Query cache invalidated
    ↓
UI updates
```

### Flight Import (AI)

```
User uploads file/pastes text
    ↓
File sent to Cloudflare Worker
    ↓
Worker calls Gemini API
    ↓
Gemini extracts flight data
    ↓
Worker returns parsed flights
    ↓
User reviews in ImportReview component
    ↓
User edits if needed, clicks Save
    ↓
Batch insert to Supabase
    ↓
Triggers fire for each flight
```

---

## Error Handling

### Frontend

- Per-route error boundaries
- Global fallback for unexpected errors
- Toast notifications for user feedback
- Auto-retry with exponential backoff

### Supabase

- RLS denials return 403 (handled gracefully)
- Network errors trigger retry
- Auth errors redirect to login

### Cloudflare Worker

- Gemini API errors return friendly message
- Rate limiting returns 429 with retry-after
- Invalid input returns 400 with details

---

## Performance Considerations

### Bundle Optimization

- Route-based code splitting
- Lazy load: Dashboard, Flights, Settings, Profile, Map
- Map component lazy-loaded within routes

### Database

- Indexes on user_id, date, airline_iata
- Denormalized stats for fast dashboard loads
- Pre-computed percentiles for leaderboards

### Caching

- TanStack Query handles client-side caching
- Static data (airports, airlines) cached indefinitely
- User data has short stale time (30s)

---

## Security Model

| Concern | Mitigation |
|---------|------------|
| API key exposure | Gemini key in Worker, never in client |
| Data access | Supabase RLS enforces owner-only |
| Auth | Supabase handles, 30-day sessions |
| XSS | React auto-escapes by default, avoid raw HTML injection |
| CSRF | Supabase uses JWT, not cookies |
| Invite abuse | Single-use codes, admin-generated |

---

## Monitoring

| What | How |
|------|-----|
| Errors | Sentry (future) |
| Logs | Console in dev, Cloudflare logs in prod |
| Uptime | Cloudflare analytics |
| Database | Supabase dashboard |
