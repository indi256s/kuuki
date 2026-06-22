-- Kuuki D1 (SQLite) schema — end-state, collapsed from the 23 Supabase Postgres
-- migrations + the authoritative generated types (apps/web/src/lib/database.types.ts).
--
-- Conventions (see docs/plans/SUPABASE_TO_CLOUDFLARE.md §3):
--   * UUIDs           → TEXT (36-char), generated in TS via crypto.randomUUID()
--   * SERIAL PKs      → INTEGER PRIMARY KEY AUTOINCREMENT (explicit ids on import)
--   * TIMESTAMPTZ     → TEXT, canonical ISO-8601 UTC  YYYY-MM-DDTHH:MM:SS.sssZ
--   * NUMERIC/DECIMAL → REAL ;  BIGINT/INT → INTEGER
--   * JSONB           → TEXT (JSON.stringify / JSON.parse in TS)
--   * BOOLEAN         → INTEGER 0/1
--   * auth.users      → local `users` table; every user_id FK → users(id)
--
-- FK enforcement in D1 is not guaranteed on every path, so ON DELETE CASCADE is
-- declared as defence-in-depth but account deletion ALSO deletes children explicitly.

-- ===========================================================================
-- Auth (replaces Supabase GoTrue)
-- ===========================================================================

CREATE TABLE users (
  id            TEXT PRIMARY KEY,                 -- crypto.randomUUID()
  email         TEXT NOT NULL,                    -- lowercased, trimmed
  password_hash TEXT NOT NULL,                    -- pbkdf2$v1$sha256$<iter>$<salt>$<hash>
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX idx_users_email ON users(lower(email));

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,                  -- crypto.randomUUID()
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,              -- SHA-256 hex of the opaque cookie token
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,                     -- canonical ISO; sliding
  last_seen_at TEXT,
  user_agent   TEXT,
  ip           TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ===========================================================================
-- Profiles (1:1 with users; profiles.id == users.id)
-- ===========================================================================

CREATE TABLE profiles (
  id                   TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username             TEXT,
  display_name         TEXT,
  bio                  TEXT CHECK (bio IS NULL OR length(bio) <= 140),
  avatar_url           TEXT,
  gemini_api_key       TEXT,                       -- PRIVATE: never expose via public endpoints
  home_airport         TEXT,
  is_public            INTEGER NOT NULL DEFAULT 0,
  locale               TEXT NOT NULL DEFAULT 'en',
  show_on_leaderboards INTEGER NOT NULL DEFAULT 0,
  theme_color          TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX idx_profiles_username_lower ON profiles(lower(username));
CREATE INDEX idx_profiles_public ON profiles(is_public) WHERE is_public = 1;

-- ===========================================================================
-- Reference data (seeded from packages/data)
-- ===========================================================================

CREATE TABLE aircraft_reference (
  icao         TEXT PRIMARY KEY,
  iata         TEXT,
  name         TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  model        TEXT NOT NULL,
  type         TEXT NOT NULL,
  engine_type  TEXT NOT NULL,
  engine_count INTEGER NOT NULL
);

CREATE TABLE airports_reference (
  iata         TEXT PRIMARY KEY,
  icao         TEXT,
  name         TEXT NOT NULL,
  city         TEXT NOT NULL,
  country      TEXT NOT NULL,
  country_code TEXT NOT NULL,
  latitude     REAL,                                 -- used by haversine distance calc
  longitude    REAL
);
CREATE INDEX idx_airports_country ON airports_reference(country_code);

CREATE TABLE badge_definitions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  tier        TEXT,
  icon        TEXT,
  points      INTEGER,
  criteria    TEXT                                  -- JSON
);

-- Word lists for readable username generation (was used by Postgres code gen).
CREATE TABLE _code_adjectives (word TEXT PRIMARY KEY);
CREATE TABLE _code_nouns      (word TEXT PRIMARY KEY);

-- ===========================================================================
-- Flights (core log)
-- ===========================================================================

CREATE TABLE flights (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date                     TEXT NOT NULL,           -- YYYY-MM-DD
  origin                   TEXT NOT NULL,           -- IATA (3)
  destination              TEXT NOT NULL,           -- IATA (3)
  airline_iata             TEXT,
  aircraft_icao            TEXT,
  flight_number            TEXT,
  departure_time           TEXT,                    -- HH:MM local
  arrival_time             TEXT,                    -- HH:MM local
  departure_utc            TEXT,                    -- canonical ISO
  arrival_utc              TEXT,                    -- canonical ISO
  origin_tz                TEXT,                    -- IANA tz id
  dest_tz                  TEXT,                    -- IANA tz id
  distance_km              REAL,
  duration_minutes         INTEGER,
  source                   TEXT NOT NULL DEFAULT 'manual'
                             CHECK (source IN ('manual','ai_import')),
  is_upcoming              INTEGER NOT NULL DEFAULT 0,
  enrichment_status        TEXT NOT NULL DEFAULT 'pending'
                             CHECK (enrichment_status IN ('pending','enriched','failed','skipped')),
  aircraft_lookup_attempts INTEGER NOT NULL DEFAULT 0,
  created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_flights_user ON flights(user_id);
CREATE INDEX idx_flights_user_date ON flights(user_id, date DESC);
CREATE INDEX idx_flights_airline ON flights(airline_iata);
CREATE INDEX idx_flights_enrichment_pending ON flights(enrichment_status)
  WHERE enrichment_status = 'pending';
CREATE INDEX idx_flights_pending_aircraft ON flights(user_id, aircraft_icao, aircraft_lookup_attempts)
  WHERE aircraft_icao IS NULL AND aircraft_lookup_attempts < 3;
CREATE INDEX idx_flights_departure_time ON flights(departure_time)
  WHERE departure_time IS NOT NULL;

-- ===========================================================================
-- Visits (per-airport, DERIVED from flights by syncVisitsFromFlight in TS)
-- ===========================================================================

CREATE TABLE visits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  airport_iata TEXT,
  city         TEXT,
  first_visit  TEXT NOT NULL,                       -- YYYY-MM-DD (earliest)
  last_visit   TEXT NOT NULL,                       -- YYYY-MM-DD (latest)
  visit_count  INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, airport_iata)                    -- derivation upsert key (confirm vs prod)
);
CREATE INDEX idx_visits_user_country ON visits(user_id, country_code);

-- ===========================================================================
-- Passport: manual country claims + ground visits
-- ===========================================================================

CREATE TABLE country_claims (
  id           TEXT PRIMARY KEY,                    -- crypto.randomUUID()
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,                        -- ISO-2
  claimed_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, country_code)
);

CREATE TABLE ground_visits (
  id           TEXT PRIMARY KEY,                    -- crypto.randomUUID()
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  visit_year   INTEGER,
  note         TEXT CHECK (note IS NULL OR length(note) <= 200),
  entry_method TEXT CHECK (entry_method IS NULL OR entry_method IN ('land','sea')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_ground_visits_user_country ON ground_visits(user_id, country_code);

-- ===========================================================================
-- Denormalized stats (recomputed by recomputeUserStats in TS)
-- ===========================================================================

CREATE TABLE user_stats (
  user_id                TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_flights          INTEGER NOT NULL DEFAULT 0,
  total_distance_km      INTEGER NOT NULL DEFAULT 0,
  total_duration_minutes INTEGER NOT NULL DEFAULT 0,
  longest_flight_minutes INTEGER NOT NULL DEFAULT 0,
  airports_count         INTEGER NOT NULL DEFAULT 0,
  cities_count           INTEGER NOT NULL DEFAULT 0,
  countries_count        INTEGER NOT NULL DEFAULT 0,
  continents_count       INTEGER NOT NULL DEFAULT 0,
  airlines_count         INTEGER NOT NULL DEFAULT 0,
  aircraft_count         INTEGER NOT NULL DEFAULT 0,
  time_zones_count       INTEGER NOT NULL DEFAULT 0,
  most_visited_country   TEXT,
  most_visited_count     INTEGER NOT NULL DEFAULT 0,
  world_completion_pct   REAL NOT NULL DEFAULT 0,
  has_night_departure    INTEGER NOT NULL DEFAULT 0,
  updated_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE user_advanced_stats (
  user_id                 TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  aircraft_breakdown      TEXT,   -- JSON
  aircraft_type_breakdown TEXT,   -- JSON
  manufacturer_breakdown  TEXT,   -- JSON
  manufacturer_insights   TEXT,   -- JSON (GLaDOS prose; was missing from generated types)
  fleet_insights          TEXT,   -- JSON (was missing from generated types)
  continent_breakdown     TEXT,   -- JSON
  region_breakdown        TEXT,   -- JSON
  departure_patterns      TEXT,   -- JSON
  duration_stats          TEXT,   -- JSON
  duration_year_comparison TEXT,  -- JSON
  patterns                TEXT,   -- JSON
  card_insights           TEXT,   -- JSON (GLaDOS card prose)
  duration_coverage       REAL,
  duration_unlocked       INTEGER NOT NULL DEFAULT 0,
  avia_geek_unlocked      INTEGER NOT NULL DEFAULT 0,
  country_geek_unlocked   INTEGER NOT NULL DEFAULT 0,
  featured_fact           TEXT,
  featured_fact_index     INTEGER,
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE user_badges (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id  INTEGER NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  earned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, badge_id)
);
CREATE INDEX idx_user_badges_user ON user_badges(user_id);

CREATE TABLE user_aircraft (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  icao         TEXT NOT NULL,
  iata         TEXT,
  name         TEXT NOT NULL,
  manufacturer TEXT,
  model        TEXT,
  type         TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, icao)
);
CREATE INDEX idx_user_aircraft_user ON user_aircraft(user_id);
CREATE INDEX idx_user_aircraft_icao ON user_aircraft(icao);

-- ===========================================================================
-- Leaderboard cache (refreshed by refreshLeaderboards in TS, via Cron)
-- 5 categories: flights | distance | countries | cities | airlines
-- ===========================================================================

CREATE TABLE leaderboard_cache (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category   TEXT NOT NULL CHECK (category IN ('flights','distance','countries','cities','airlines')),
  value      REAL NOT NULL,
  rank       INTEGER NOT NULL,
  percentile REAL,
  metadata   TEXT,   -- JSON: { username, display_name, avatar_url }
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, category)
);
CREATE INDEX idx_leaderboard_category_rank ON leaderboard_cache(category, rank);
