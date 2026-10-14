-- Ground travel: rail journeys and road trips, their confirmed country evidence, private manual places,
-- operation receipts and the shared GeoNames city catalog (.scratch/ground-travel/storage-contract.md,
-- places-contract.md, ADR 0005). Additive: no flight, claim or manual ground_visits table changes.

-- ---------------------------------------------------------------------------
-- 1. Shared city catalog (GeoNames cities500, loaded by scripts/generate-geonames-places.ts; empty until loaded)
-- ---------------------------------------------------------------------------
CREATE TABLE ground_places (
  geoname_id      INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,                      -- source name
  name_ru         TEXT,
  name_en         TEXT,
  country_code    TEXT NOT NULL CHECK (length(country_code) = 2),
  region          TEXT,                               -- admin1 display name (source/ASCII)
  region_ru       TEXT,
  latitude        REAL CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude       REAL CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  timezone        TEXT,
  population      INTEGER NOT NULL DEFAULT 0 CHECK (population >= 0),
  catalog_version TEXT NOT NULL,
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);

-- Folded names and aliases. `prefix` is the first three folded characters (fewer for shorter keys), so a
-- query reads one bucket in population order instead of scanning the catalog.
CREATE TABLE ground_place_names (
  prefix     TEXT NOT NULL,
  name_key   TEXT NOT NULL,
  geoname_id INTEGER NOT NULL,
  population INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (name_key, geoname_id)
) WITHOUT ROWID;
CREATE INDEX idx_ground_place_names_bucket ON ground_place_names(prefix, population DESC, name_key);

-- ---------------------------------------------------------------------------
-- 2. Private manual places: name + country required, coordinates/timezone optional
-- ---------------------------------------------------------------------------
CREATE TABLE ground_manual_places (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  name_key     TEXT NOT NULL,
  country_code TEXT NOT NULL CHECK (length(country_code) = 2),
  latitude     REAL CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude    REAL CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  timezone     TEXT CHECK (timezone IS NULL OR length(timezone) BETWEEN 1 AND 64),
  created_at   TEXT NOT NULL,
  UNIQUE (id, user_id),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);
CREATE INDEX idx_ground_manual_places_user_key ON ground_manual_places(user_id, name_key);

-- ---------------------------------------------------------------------------
-- 3. Journeys. A deleted journey keeps only id/owner/mode/version/deleted_at (account-lifetime tombstone).
-- ---------------------------------------------------------------------------
CREATE TABLE ground_journeys (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode         TEXT NOT NULL CHECK (mode IN ('rail','road')),
  status       TEXT CHECK (status IS NULL OR status IN ('planned','completed','cancelled')),
  version      INTEGER NOT NULL CHECK (version >= 1),
  start_date   TEXT CHECK (start_date IS NULL OR start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  end_date     TEXT CHECK (end_date IS NULL OR end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  title        TEXT CHECK (title IS NULL OR length(title) <= 200),
  note         TEXT CHECK (note IS NULL OR length(note) <= 10000),
  created_at   TEXT,
  updated_at   TEXT,
  confirmed_at TEXT,
  deleted_at   TEXT,
  UNIQUE (id, user_id),
  CHECK (
    (deleted_at IS NULL AND status IS NOT NULL AND created_at IS NOT NULL AND updated_at IS NOT NULL)
    OR (deleted_at IS NOT NULL AND status IS NULL AND created_at IS NULL AND updated_at IS NULL
        AND confirmed_at IS NULL AND start_date IS NULL AND end_date IS NULL AND title IS NULL AND note IS NULL)
  ),
  CHECK ((status = 'completed') = (confirmed_at IS NOT NULL) OR status IS NULL),
  CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);
CREATE INDEX idx_ground_journeys_list ON ground_journeys(user_id, mode, status, start_date, id);

-- Place snapshots are JSON objects validated by the server (GroundPlaceSnapshot in packages/shared/src/groundTravel.ts);
-- catalog refreshes and manual-place edits never rewrite them.
CREATE TABLE ground_rail_legs (
  id               TEXT PRIMARY KEY,
  journey_id       TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  ordinal          INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 99),
  from_place       TEXT NOT NULL CHECK (json_valid(from_place)),
  to_place         TEXT NOT NULL CHECK (json_valid(to_place)),
  from_station     TEXT CHECK (from_station IS NULL OR length(from_station) <= 200),
  to_station       TEXT CHECK (to_station IS NULL OR length(to_station) <= 200),
  train_number     TEXT CHECK (train_number IS NULL OR length(train_number) <= 40),
  operator         TEXT CHECK (operator IS NULL OR length(operator) <= 200),
  departure_date   TEXT,
  departure_time   TEXT CHECK (departure_time IS NULL OR departure_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  arrival_date     TEXT,
  arrival_time     TEXT CHECK (arrival_time IS NULL OR arrival_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 20160),
  duration_source  TEXT CHECK (duration_source IS NULL OR duration_source IN ('manual','schedule')),
  FOREIGN KEY (journey_id, user_id) REFERENCES ground_journeys(id, user_id) ON DELETE CASCADE,
  UNIQUE (journey_id, ordinal),
  CHECK ((duration_minutes IS NULL) = (duration_source IS NULL))
);
-- Owner-wide child reads and account deletion lead with user_id; UNIQUE (journey_id, ordinal) cannot serve them.
CREATE INDEX idx_ground_rail_legs_user ON ground_rail_legs(user_id, journey_id, ordinal);

CREATE TABLE ground_road_points (
  id             TEXT PRIMARY KEY,
  journey_id     TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  ordinal        INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 99),
  place          TEXT NOT NULL CHECK (json_valid(place)),
  arrival_date   TEXT,
  departure_date TEXT,
  nights         INTEGER CHECK (nights IS NULL OR nights BETWEEN 0 AND 3650),
  note           TEXT CHECK (note IS NULL OR length(note) <= 10000),
  FOREIGN KEY (journey_id, user_id) REFERENCES ground_journeys(id, user_id) ON DELETE CASCADE,
  UNIQUE (journey_id, ordinal)
);
CREATE INDEX idx_ground_road_points_user ON ground_road_points(user_id, journey_id, ordinal);

-- Owner-confirmed crossed countries of a completed journey; never written to ground_visits.
CREATE TABLE ground_journey_countries (
  journey_id   TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  country_code TEXT NOT NULL CHECK (length(country_code) = 2),
  PRIMARY KEY (journey_id, country_code),
  FOREIGN KEY (journey_id, user_id) REFERENCES ground_journeys(id, user_id) ON DELETE CASCADE
);
CREATE INDEX idx_ground_journey_countries_user ON ground_journey_countries(user_id, country_code);
-- Owner-wide reads order by (journey_id, country_code); the primary key leads with journey_id.
CREATE INDEX idx_ground_journey_countries_owner ON ground_journey_countries(user_id, journey_id, country_code);

-- ---------------------------------------------------------------------------
-- 4. Operation receipts (37 days from commit, never extended by replay). No FK to the journey, so a
--    replay survives deletion. A batch reserves the receipt (applied 0), marks it applied only after its
--    own CAS changed the parent, and finalizes complete = 1: the CHECK aborts the whole batch otherwise.
-- ---------------------------------------------------------------------------
CREATE TABLE ground_operation_receipts (
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_key    TEXT NOT NULL CHECK (length(operation_key) BETWEEN 8 AND 128),
  request_digest   TEXT NOT NULL,
  journey_id       TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('create','update','complete','reopen','cancel','restore','delete')),
  expected_version INTEGER,
  result_version   INTEGER,
  outcome          TEXT CHECK (outcome IS NULL OR outcome IN ('saved','deleted')),
  account_revision INTEGER,
  batch_nonce      TEXT NOT NULL,
  applied          INTEGER NOT NULL DEFAULT 0 CHECK (applied IN (0,1)),
  complete         INTEGER NOT NULL DEFAULT 0 CHECK (complete IN (0,1)),
  created_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL,
  PRIMARY KEY (user_id, operation_key),
  CHECK (complete = 0 OR (applied = 1 AND outcome IS NOT NULL AND result_version IS NOT NULL AND account_revision IS NOT NULL))
);
CREATE INDEX idx_ground_operation_receipts_expiry ON ground_operation_receipts(expires_at);

-- ---------------------------------------------------------------------------
-- 5. Passport projection: journey support is counted separately from manual ground visits. Existing rows
--    have no journeys, so 0 equals what the next repair publishes and no account is marked dirty.
-- ---------------------------------------------------------------------------
ALTER TABLE country_visit_evidence
  ADD COLUMN ground_journey_count INTEGER NOT NULL DEFAULT 0 CHECK (ground_journey_count >= 0);
