# Kuuki - Backend Structure

> **Historical Supabase/Vite context.** Retained for source migration research. Current schema and handlers live in [D1 migrations](../db/migrations/) and [functions/api](../functions/api/); current runtime and release gates are in the [Next runbook](runbooks/2026-10-04-next-release-candidate.md).

---

## Architecture Overview

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

### Key Decisions

| Decision               | Rationale                            |
| ---------------------- | ------------------------------------ |
| Direct Supabase access | No backend server to maintain        |
| RLS for security       | Database-level authorization         |
| Worker for AI only     | Single responsibility, hides API key |
| Trigger-based stats    | Pre-computed for fast reads          |

---

## Database Schema

### Core Tables

#### `profiles`

User profiles (public-facing data).

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT CHECK (char_length(bio) <= 140),
  avatar_url TEXT,
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'ru')),
  is_public BOOLEAN DEFAULT false,
  show_on_leaderboards BOOLEAN DEFAULT false,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_public ON profiles(is_public) WHERE is_public = true;
```

#### `flights`

Core flight log.

```sql
CREATE TABLE flights (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  date DATE NOT NULL,
  origin TEXT NOT NULL CHECK (char_length(origin) = 3),
  destination TEXT NOT NULL CHECK (char_length(destination) = 3),
  airline_iata TEXT NOT NULL CHECK (char_length(airline_iata) >= 2),
  aircraft_icao TEXT,
  flight_number TEXT,
  departure_utc TIMESTAMPTZ,
  arrival_utc TIMESTAMPTZ,
  distance_km NUMERIC,
  duration_minutes INT,
  source TEXT NOT NULL CHECK (source IN ('manual', 'ai_import')),
  is_upcoming BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_flights_user_id ON flights(user_id);
CREATE INDEX idx_flights_date ON flights(date DESC);
CREATE INDEX idx_flights_user_date ON flights(user_id, date DESC);
CREATE INDEX idx_flights_airline ON flights(airline_iata);
```

#### `user_stats`

Denormalized stats (updated by triggers).

```sql
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  total_flights INT DEFAULT 0,
  total_distance_km NUMERIC DEFAULT 0,
  total_duration_minutes INT DEFAULT 0,
  unique_countries INT DEFAULT 0,
  unique_cities INT DEFAULT 0,
  unique_airlines INT DEFAULT 0,
  unique_aircraft INT DEFAULT 0,
  world_completion_pct NUMERIC DEFAULT 0,
  longest_flight_km NUMERIC DEFAULT 0,
  most_visited_country TEXT,
  time_zones_crossed INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `user_badges`

Earned badges.

```sql
CREATE TABLE user_badges (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Index
CREATE INDEX idx_user_badges_user ON user_badges(user_id);
```

#### `country_claims`

Manual country claims (for ground travel).

```sql
CREATE TABLE country_claims (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  country_code TEXT NOT NULL CHECK (char_length(country_code) = 2),
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  visit_year INT,
  note TEXT,
  entry_method TEXT CHECK (entry_method IN ('land', 'sea') OR entry_method IS NULL),
  UNIQUE(user_id, country_code)
);

-- Index
CREATE INDEX idx_country_claims_user ON country_claims(user_id);
```

---

## Row Level Security (RLS)

### Profiles

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can update own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- Users can view own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Anyone can view public profiles
CREATE POLICY "Public profiles are viewable"
ON profiles FOR SELECT
USING (is_public = true);
```

### Flights

```sql
-- Enable RLS
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;

-- Users can CRUD own flights
CREATE POLICY "Users can CRUD own flights"
ON flights FOR ALL
USING (auth.uid() = user_id);
```

### User Stats

```sql
-- Enable RLS
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Users can view own stats
CREATE POLICY "Users can view own stats"
ON user_stats FOR SELECT
USING (auth.uid() = user_id);

-- Public stats are viewable (via profile)
CREATE POLICY "Public stats are viewable"
ON user_stats FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = user_stats.user_id
    AND profiles.is_public = true
  )
);
```

### User Badges

```sql
-- Enable RLS
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Users can view own badges
CREATE POLICY "Users can view own badges"
ON user_badges FOR SELECT
USING (auth.uid() = user_id);

-- Public badges are viewable
CREATE POLICY "Public badges are viewable"
ON user_badges FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = user_badges.user_id
    AND profiles.is_public = true
  )
);
```

### Country Claims

```sql
-- Enable RLS
ALTER TABLE country_claims ENABLE ROW LEVEL SECURITY;

-- Users can CRUD own claims
CREATE POLICY "Users can CRUD own claims"
ON country_claims FOR ALL
USING (auth.uid() = user_id);
```

## Triggers

### Stats Update Trigger

Recalculate user stats on flight changes.

```sql
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT, UPDATE, or DELETE
  DECLARE
    target_user_id UUID;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      target_user_id := OLD.user_id;
    ELSE
      target_user_id := NEW.user_id;
    END IF;

    -- Recalculate all stats
    INSERT INTO user_stats (user_id, total_flights, total_distance_km, unique_countries, unique_airlines, unique_aircraft, updated_at)
    SELECT
      target_user_id,
      COUNT(*) FILTER (WHERE NOT is_upcoming),
      COALESCE(SUM(distance_km) FILTER (WHERE NOT is_upcoming), 0),
      COUNT(DISTINCT country_code) -- from airport lookup
      COUNT(DISTINCT airline_iata) FILTER (WHERE NOT is_upcoming),
      COUNT(DISTINCT aircraft_icao) FILTER (WHERE NOT is_upcoming AND aircraft_icao IS NOT NULL),
      NOW()
    FROM flights
    WHERE user_id = target_user_id
    ON CONFLICT (user_id) DO UPDATE SET
      total_flights = EXCLUDED.total_flights,
      total_distance_km = EXCLUDED.total_distance_km,
      unique_airlines = EXCLUDED.unique_airlines,
      unique_aircraft = EXCLUDED.unique_aircraft,
      updated_at = EXCLUDED.updated_at;

    RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER flight_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON flights
FOR EACH ROW
EXECUTE FUNCTION update_user_stats();
```

### Badge Evaluation Trigger

Check for badge eligibility after stats update.

```sql
CREATE OR REPLACE FUNCTION evaluate_badges()
RETURNS TRIGGER AS $$
DECLARE
  badge_record RECORD;
BEGIN
  -- First Flight badge
  IF NEW.total_flights >= 1 THEN
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (NEW.user_id, 'first_flight')
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  -- Frequent Flyer (50 flights)
  IF NEW.total_flights >= 50 THEN
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (NEW.user_id, 'frequent_flyer')
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  -- Centurion (100 flights)
  IF NEW.total_flights >= 100 THEN
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (NEW.user_id, 'centurion')
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  -- Circumnavigator (40,075 km)
  IF NEW.total_distance_km >= 40075 THEN
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (NEW.user_id, 'circumnavigator')
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  -- Fleet Master (20 aircraft types)
  IF NEW.unique_aircraft >= 20 THEN
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (NEW.user_id, 'fleet_master')
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER badge_evaluation_trigger
AFTER INSERT OR UPDATE ON user_stats
FOR EACH ROW
EXECUTE FUNCTION evaluate_badges();
```

### Profile Creation Trigger

Auto-create profile on user signup.

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (NEW.id, 'user_' || substr(NEW.id::text, 1, 8));

  INSERT INTO user_stats (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();
```

---

## API Endpoints

### Cloudflare Worker: Gemini Proxy

**Location:** `functions/api/parse.ts`

**Endpoint:** `POST /api/parse`

**Purpose:** Proxy Gemini API calls to hide API key from client.

#### Request

```typescript
interface ParseRequest {
  type: 'pdf' | 'image' | 'text'
  content: string // base64 for files, plain text for text
}
```

#### Response

```typescript
interface ParseResponse {
  flights: ParsedFlight[]
  raw_text?: string // For debugging
}

interface ParsedFlight {
  date: string // ISO date
  origin: string // IATA code
  destination: string // IATA code
  airline_iata?: string
  aircraft_icao?: string
  flight_number?: string
  departure_utc?: string // ISO timestamp
  arrival_utc?: string // ISO timestamp
  confidence: number // 0-1
}
```

#### Error Response

```typescript
interface ErrorResponse {
  error: string
  code: 'PARSE_FAILED' | 'NO_FLIGHTS_FOUND' | 'RATE_LIMITED' | 'API_ERROR'
}
```

#### Implementation

```typescript
export async function onRequest(context: EventContext) {
  const { request, env } = context

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = (await request.json()) as ParseRequest

    // Call Gemini API
    const gemini = new GoogleGenerativeAI(env.GEMINI_API_KEY)
    const model = gemini.getGenerativeModel({ model: 'gemini-3.0-flash' })

    const prompt = buildPrompt(body.type, body.content)
    const result = await model.generateContent(prompt)

    const flights = parseGeminiResponse(result.response.text())

    return Response.json({ flights })
  } catch (error) {
    return Response.json({ error: 'Parse failed', code: 'PARSE_FAILED' }, { status: 500 })
  }
}
```

---

## Authentication

### Supabase Auth Configuration

| Setting            | Value                   |
| ------------------ | ----------------------- |
| Provider           | Email/Password          |
| Session duration   | 30 days                 |
| Email verification | Optional                |
| Password reset     | Requires verified email |

### Auth Flow

1. **Sign Up:**
   - Validate email and password
   - Create user entry
   - Create profile + stats

2. **Sign In:**
   - Standard email/password
   - 30-day session token

3. **Sign Out:**
   - Clear session
   - Redirect to `/`

## Data Flow Patterns

### Flight Creation (Manual)

```
User fills form
    ↓
Zod validates input
    ↓
TanStack mutation calls supabase.from('flights').insert()
    ↓
RLS validates user_id
    ↓
Trigger: update_user_stats()
    ↓
Trigger: evaluate_badges()
    ↓
Query cache invalidated
    ↓
UI updates
```

### Flight Import (AI)

```
User uploads file
    ↓
POST /api/parse (Cloudflare Worker)
    ↓
Worker calls Gemini API
    ↓
Gemini extracts flight data
    ↓
Worker returns parsed flights
    ↓
User reviews in ImportReview
    ↓
Batch insert to Supabase
    ↓
Triggers fire for each flight
```

---

## Error Handling

### Supabase Errors

| Error Code    | Meaning           | Action                |
| ------------- | ----------------- | --------------------- |
| `PGRST301`    | RLS violation     | Redirect to login     |
| `23505`       | Unique constraint | Show "already exists" |
| `23503`       | Foreign key       | Invalid reference     |
| Network error | Connection failed | Retry with backoff    |

### Worker Errors

| Code               | HTTP Status | Meaning                   |
| ------------------ | ----------- | ------------------------- |
| `PARSE_FAILED`     | 500         | Gemini couldn't parse     |
| `NO_FLIGHTS_FOUND` | 400         | No valid flights in input |
| `RATE_LIMITED`     | 429         | Too many requests         |
| `API_ERROR`        | 502         | Gemini API down           |

---

## Performance Considerations

### Indexes

| Table    | Index                | Purpose             |
| -------- | -------------------- | ------------------- |
| flights  | (user_id, date DESC) | User's flight list  |
| flights  | (airline_iata)       | Filter by airline   |
| profiles | (username)           | Profile lookup      |
| profiles | (is_public)          | Leaderboard queries |

### Denormalization

- `user_stats` table: Pre-computed aggregates
- Updated by triggers on flight changes
- Acceptable write overhead at 50-500 user scale

### Caching

- TanStack Query handles client-side caching
- Stale time: 30 seconds for user data
- Static data (airports, airlines): Cached indefinitely

---

## Migrations

**Location:** `supabase/migrations/`

**Creating:**

```bash
supabase migration new <name>
```

**Applying:**

```bash
supabase db push
```

**Best Practices:**

- One migration per feature
- Always include rollback
- Test locally first

---

## Related Documentation

| Document                         | Purpose               |
| -------------------------------- | --------------------- |
| [PRD.md](./PRD.md)               | Product requirements  |
| [TECH_STACK.md](./TECH_STACK.md) | Dependencies          |
| [PLAN.md](./PLAN.md)             | Implementation status |
