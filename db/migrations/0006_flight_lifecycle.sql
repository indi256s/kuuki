-- Flight lifecycle, country evidence projection and lifecycle receipts (ADR 0001 §1, §3, §4, §5, §10).
-- Additive only: ADD COLUMN and new tables, no rebuild, so ids and sqlite_sequence survive.
-- Deploy order: apply this migration, then deploy the lifecycle-aware build. Pre-lifecycle builds
-- keep working through the adapter triggers below (controller ruling R2). Read-only pre-check:
-- db/prechecks/0006_flight_lifecycle.sql.

-- ---------------------------------------------------------------------------
-- 1. Lifecycle columns
-- ---------------------------------------------------------------------------
ALTER TABLE flights ADD COLUMN lifecycle_state TEXT
  CHECK (lifecycle_state IS NULL OR lifecycle_state IN ('upcoming','awaiting','logged'));
ALTER TABLE flights ADD COLUMN confirmation_source TEXT
  CHECK (confirmation_source IS NULL OR confirmation_source IN ('save','user','automatic','legacy'));
ALTER TABLE flights ADD COLUMN confirmed_at TEXT;
ALTER TABLE flights ADD COLUMN lifecycle_timezone TEXT
  CHECK (lifecycle_timezone IS NULL OR length(lifecycle_timezone) BETWEEN 1 AND 64);
ALTER TABLE flights ADD COLUMN awaiting_after TEXT;
ALTER TABLE flights ADD COLUMN auto_confirm_after TEXT;
ALTER TABLE flights ADD COLUMN arrival_transit INTEGER
  CHECK (arrival_transit IS NULL OR arrival_transit IN (0,1));
ALTER TABLE flights ADD COLUMN arrival_transit_leg_id INTEGER;

-- ---------------------------------------------------------------------------
-- 2. Historical backfill (before any trigger exists)
-- ---------------------------------------------------------------------------
UPDATE flights SET lifecycle_state = 'logged', confirmation_source = 'legacy' WHERE is_upcoming <> 1;
UPDATE flights SET lifecycle_state = 'upcoming', lifecycle_timezone = 'UTC',
  awaiting_after     = strftime('%Y-%m-%dT%H:%M:%fZ', date, '+1 day'),
  auto_confirm_after = strftime('%Y-%m-%dT%H:%M:%fZ', date, '+8 days')
WHERE is_upcoming = 1;

-- Fail the migration loudly if any guard is violated.
CREATE TABLE _m0006_assert (ok INTEGER NOT NULL CHECK (ok = 1));
INSERT INTO _m0006_assert SELECT NOT EXISTS (SELECT 1 FROM flights WHERE is_upcoming NOT IN (0,1)
  OR lifecycle_state IS NULL OR (lifecycle_state = 'logged' AND confirmation_source IS NULL)
  OR (lifecycle_state = 'upcoming' AND (awaiting_after IS NULL OR auto_confirm_after IS NULL)));
INSERT INTO _m0006_assert SELECT NOT EXISTS (SELECT 1 FROM visits WHERE country_code = '');
DROP TABLE _m0006_assert;

-- ---------------------------------------------------------------------------
-- 3. Country evidence projection (C3), seeded from published data
-- ---------------------------------------------------------------------------
CREATE TABLE country_visit_evidence (
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_code         TEXT NOT NULL CHECK (length(country_code) = 2),
  status               TEXT NOT NULL CHECK (status IN ('pressed','pending')),
  logged_visit_count   INTEGER NOT NULL DEFAULT 0 CHECK (logged_visit_count >= 0),
  awaiting_visit_count INTEGER NOT NULL DEFAULT 0 CHECK (awaiting_visit_count >= 0),
  claimed              INTEGER NOT NULL DEFAULT 0 CHECK (claimed IN (0,1)),
  ground_visit_count   INTEGER NOT NULL DEFAULT 0 CHECK (ground_visit_count >= 0),
  first_visit          TEXT,
  last_visit           TEXT,
  policy_version       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, country_code)
);
CREATE INDEX idx_country_evidence_user_status ON country_visit_evidence(user_id, status);

-- With no awaiting flights and no transit decisions yet, this equals what the first repair
-- publishes (functions/api/_services/countryEvidence.ts), so no account is marked dirty.
INSERT INTO country_visit_evidence
  (user_id, country_code, status, logged_visit_count, awaiting_visit_count, claimed, ground_visit_count,
   first_visit, last_visit, policy_version)
SELECT user_id, country_code,
       CASE WHEN SUM(logged) > 0 OR MAX(claimed) = 1 OR SUM(ground) > 0 THEN 'pressed' ELSE 'pending' END,
       SUM(logged), 0, MAX(claimed), SUM(ground), MIN(first_visit), MAX(last_visit), 1
FROM (
  SELECT user_id, country_code, visit_count AS logged, 0 AS claimed, 0 AS ground, first_visit, last_visit
  FROM visits WHERE length(country_code) = 2
  UNION ALL
  SELECT user_id, country_code, 0, 1, 0, NULL, NULL FROM country_claims WHERE length(country_code) = 2
  UNION ALL
  SELECT user_id, country_code, 0, 0, 1, NULL, NULL FROM ground_visits WHERE length(country_code) = 2
)
GROUP BY user_id, country_code
HAVING SUM(logged) > 0 OR MAX(claimed) = 1 OR SUM(ground) > 0;

-- Suppressed flight endpoints under the effective arrival policy; empty until a transit decision.
CREATE TABLE country_evidence_suppressions (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flight_id    INTEGER NOT NULL,
  endpoint     TEXT NOT NULL CHECK (endpoint IN ('origin','destination')),
  country_code TEXT NOT NULL,
  PRIMARY KEY (user_id, flight_id, endpoint)
);

-- Evidence stamp (§10 F2): only the lifecycle-aware repair advances it. Readiness everywhere is
-- revision = published_revision AND evidence_revision = published_revision.
ALTER TABLE user_derived_state ADD COLUMN evidence_revision INTEGER NOT NULL DEFAULT 0;
UPDATE user_derived_state SET evidence_revision = published_revision;
CREATE INDEX idx_user_derived_stale ON user_derived_state(updated_at)
  WHERE revision != published_revision OR evidence_revision != published_revision;

-- ---------------------------------------------------------------------------
-- 4. Confirmation / transit-review receipts and the cleanup marker (C4, used from T09)
-- ---------------------------------------------------------------------------
CREATE TABLE lifecycle_operation_receipts (
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_id        TEXT NOT NULL CHECK (length(operation_id) BETWEEN 8 AND 128),
  kind                TEXT NOT NULL CHECK (kind IN ('confirm','transit_review')),
  request_digest      TEXT NOT NULL,
  batch_nonce         TEXT NOT NULL,
  expected_count      INTEGER NOT NULL CHECK (expected_count >= 0),
  applied_count       INTEGER NOT NULL DEFAULT 0,
  complete            INTEGER NOT NULL DEFAULT 0 CHECK (complete IN (0,1)),
  pressed_before_json TEXT,
  result_json         TEXT,
  created_at          TEXT NOT NULL,
  PRIMARY KEY (user_id, operation_id),
  CHECK (applied_count <= expected_count AND (complete = 0 OR applied_count = expected_count))
);
CREATE INDEX idx_lifecycle_receipts_created ON lifecycle_operation_receipts(created_at);

CREATE TABLE transit_cleanup_markers (
  user_id              TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status               TEXT NOT NULL CHECK (status IN ('dismissed','completed')),
  candidate_set_digest TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- 5. Adapter and invariant triggers (§1). Created in this order: 1–4 adapters, 5–6 checks.
--    SQLite cannot assign NEW.*, so each adapter is AFTER + a nested UPDATE. The design holds in
--    any firing order (A2 tests both). INV(row) is spelled out in triggers 5 and 6.
-- ---------------------------------------------------------------------------

-- 1. A pre-lifecycle INSERT omits lifecycle_state: derive it from its own is_upcoming/UTC rule.
CREATE TRIGGER flights_lifecycle_adapt_insert AFTER INSERT ON flights
WHEN NEW.lifecycle_state IS NULL
BEGIN
  UPDATE flights SET
    lifecycle_state     = CASE WHEN NEW.is_upcoming = 1 THEN 'upcoming' ELSE 'logged' END,
    confirmation_source = CASE WHEN NEW.is_upcoming = 1 THEN NULL ELSE 'save' END,
    confirmed_at        = CASE WHEN NEW.is_upcoming = 1 THEN NULL ELSE NEW.created_at END,
    lifecycle_timezone  = CASE WHEN NEW.is_upcoming = 1 THEN 'UTC' ELSE NULL END,
    awaiting_after      = CASE WHEN NEW.is_upcoming = 1 THEN strftime('%Y-%m-%dT%H:%M:%fZ', NEW.date, '+1 day') END,
    auto_confirm_after  = CASE WHEN NEW.is_upcoming = 1 THEN strftime('%Y-%m-%dT%H:%M:%fZ', NEW.date, '+8 days') END
  WHERE id = NEW.id;
END;

-- 2. A pre-lifecycle flag flip (old sync, old cron, old date edit across today). 1 -> 0 becomes
--    awaiting (never silently logged); 0 -> 1 becomes upcoming. Deadlines follow the date by whole
--    days (SHIFT) from upcoming/awaiting rows; logged rows restart from UTC deadlines (F1).
CREATE TRIGGER flights_lifecycle_adapt_flag AFTER UPDATE OF is_upcoming ON flights
WHEN NEW.lifecycle_state IS OLD.lifecycle_state AND NEW.is_upcoming <> (NEW.lifecycle_state = 'upcoming')
BEGIN
  UPDATE flights SET
    lifecycle_state        = CASE WHEN NEW.is_upcoming = 1 THEN 'upcoming' ELSE 'awaiting' END,
    confirmation_source    = NULL,
    confirmed_at           = NULL,
    arrival_transit        = NULL,
    arrival_transit_leg_id = NULL,
    lifecycle_timezone     = CASE WHEN OLD.lifecycle_state = 'logged' THEN 'UTC' ELSE OLD.lifecycle_timezone END,
    awaiting_after         = CASE WHEN OLD.lifecycle_state = 'logged'
      THEN strftime('%Y-%m-%dT%H:%M:%fZ', NEW.date, '+1 day')
      ELSE strftime('%Y-%m-%dT%H:%M:%fZ', OLD.awaiting_after,
        printf('%+d days', CAST(julianday(NEW.date) - julianday(OLD.date) AS INTEGER))) END,
    auto_confirm_after     = CASE WHEN OLD.lifecycle_state = 'logged'
      THEN strftime('%Y-%m-%dT%H:%M:%fZ', NEW.date, '+8 days')
      ELSE strftime('%Y-%m-%dT%H:%M:%fZ', OLD.auto_confirm_after,
        printf('%+d days', CAST(julianday(NEW.date) - julianday(OLD.date) AS INTEGER))) END
  WHERE id = NEW.id;
END;

-- 3. A pre-lifecycle re-date that does not cross today (upcoming future->future, awaiting
--    past->past): state follows the old flag, deadlines follow the date (SHIFT). A lifecycle-aware
--    re-date always writes new deadlines, so it never matches.
CREATE TRIGGER flights_lifecycle_adapt_redate AFTER UPDATE OF date ON flights
WHEN NEW.date IS NOT OLD.date AND NEW.is_upcoming = OLD.is_upcoming
  AND NEW.lifecycle_state IS OLD.lifecycle_state AND NEW.lifecycle_state IN ('upcoming','awaiting')
  AND NEW.awaiting_after IS OLD.awaiting_after AND NEW.lifecycle_timezone IS OLD.lifecycle_timezone
BEGIN
  UPDATE flights SET
    awaiting_after     = strftime('%Y-%m-%dT%H:%M:%fZ', OLD.awaiting_after,
      printf('%+d days', CAST(julianday(NEW.date) - julianday(OLD.date) AS INTEGER))),
    auto_confirm_after = strftime('%Y-%m-%dT%H:%M:%fZ', OLD.auto_confirm_after,
      printf('%+d days', CAST(julianday(NEW.date) - julianday(OLD.date) AS INTEGER)))
  WHERE id = NEW.id;
END;

-- 4. Any route change drops a transit decision about the old hub, for every writer.
CREATE TRIGGER flights_lifecycle_adapt_route AFTER UPDATE OF origin, destination ON flights
WHEN (NEW.origin IS NOT OLD.origin OR NEW.destination IS NOT OLD.destination)
  AND (NEW.arrival_transit IS NOT NULL OR NEW.arrival_transit_leg_id IS NOT NULL)
BEGIN
  UPDATE flights SET arrival_transit = NULL, arrival_transit_leg_id = NULL WHERE id = NEW.id;
END;

-- 5. A lifecycle-aware INSERT must satisfy INV.
CREATE TRIGGER flights_lifecycle_check_insert AFTER INSERT ON flights
WHEN NEW.lifecycle_state IS NOT NULL AND NOT COALESCE(
  NEW.is_upcoming = (NEW.lifecycle_state = 'upcoming')
  AND (NEW.confirmation_source IS NOT NULL) = (NEW.lifecycle_state = 'logged')
  AND (NEW.lifecycle_state <> 'logged' OR (NEW.confirmation_source = 'legacy') = (NEW.confirmed_at IS NULL))
  AND (NEW.lifecycle_state = 'logged' OR NEW.confirmed_at IS NULL)
  AND (NEW.lifecycle_state = 'logged' OR (NEW.lifecycle_timezone IS NOT NULL
    AND NEW.awaiting_after IS NOT NULL AND NEW.auto_confirm_after IS NOT NULL))
  AND (NEW.arrival_transit_leg_id IS NULL OR NEW.arrival_transit = 1), 0)
BEGIN
  SELECT RAISE(ABORT, 'LIFECYCLE_INVARIANT');
END;

-- 6. Every UPDATE must leave INV, except a row still pending adapter 2 for the same outer event
--    (its exact WHEN condition); adapter 2's own nested UPDATE is then validated in full.
CREATE TRIGGER flights_lifecycle_check_update AFTER UPDATE ON flights
WHEN NOT COALESCE(
  NEW.lifecycle_state IS NOT NULL
  AND NEW.is_upcoming = (NEW.lifecycle_state = 'upcoming')
  AND (NEW.confirmation_source IS NOT NULL) = (NEW.lifecycle_state = 'logged')
  AND (NEW.lifecycle_state <> 'logged' OR (NEW.confirmation_source = 'legacy') = (NEW.confirmed_at IS NULL))
  AND (NEW.lifecycle_state = 'logged' OR NEW.confirmed_at IS NULL)
  AND (NEW.lifecycle_state = 'logged' OR (NEW.lifecycle_timezone IS NOT NULL
    AND NEW.awaiting_after IS NOT NULL AND NEW.auto_confirm_after IS NOT NULL))
  AND (NEW.arrival_transit_leg_id IS NULL OR NEW.arrival_transit = 1), 0)
  AND NOT COALESCE(NEW.lifecycle_state IS OLD.lifecycle_state
    AND NEW.is_upcoming <> (NEW.lifecycle_state = 'upcoming'), 0)
BEGIN
  SELECT RAISE(ABORT, 'LIFECYCLE_INVARIANT');
END;

-- ---------------------------------------------------------------------------
-- 6. Lifecycle indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_flights_user_lifecycle ON flights(user_id, lifecycle_state, date);
CREATE INDEX idx_flights_due_upcoming ON flights(awaiting_after, id) WHERE lifecycle_state = 'upcoming';
CREATE INDEX idx_flights_due_awaiting ON flights(auto_confirm_after, id) WHERE lifecycle_state = 'awaiting';
