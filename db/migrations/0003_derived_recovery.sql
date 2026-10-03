-- Durable recovery for derived user data and retried flight creates.
CREATE TABLE user_derived_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  published_revision INTEGER NOT NULL DEFAULT 0
    CHECK (published_revision >= 0 AND published_revision <= revision),
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  published_at TEXT
);
CREATE INDEX idx_user_derived_dirty ON user_derived_state(updated_at)
  WHERE revision != published_revision;

-- Existing derived rows are a snapshot; mark each user for evidence-aware repair.
INSERT INTO user_derived_state (user_id, revision, published_revision)
SELECT id, 1, 0 FROM users;

CREATE TABLE flight_idempotency (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  flight_id INTEGER,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);
CREATE INDEX idx_flight_idempotency_created ON flight_idempotency(created_at);

-- Keep every source visit, including rows already explained by flights. source_json
-- retains fields absent from this projection; only contributes=1 affects visits.
CREATE TABLE legacy_visit_evidence (
  source_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  airport_iata TEXT,
  country_code TEXT,
  city TEXT,
  first_visit TEXT NOT NULL,
  last_visit TEXT NOT NULL,
  visit_count INTEGER NOT NULL CHECK (visit_count >= 0),
  source_digest TEXT NOT NULL,
  provenance TEXT NOT NULL,
  contributes INTEGER NOT NULL DEFAULT 0 CHECK (contributes IN (0, 1)),
  source_json TEXT NOT NULL
);
CREATE INDEX idx_legacy_visit_evidence_user_airport
  ON legacy_visit_evidence(user_id, airport_iata);

CREATE TABLE maintenance_status (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_success_at TEXT,
  last_failure_at TEXT,
  last_error TEXT
);
INSERT INTO maintenance_status (id) VALUES (1);
