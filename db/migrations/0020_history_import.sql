-- Flighty CSV history import (ADR 0008). Additive: two new tables and one server-owned flights column.
-- The uploaded file is never stored. Each logical CSV record becomes one row whose verbatim cells stay private to the
-- owner; a committed row is the durable source identity, and after its flight is deleted, the tombstone.

CREATE TABLE history_import_runs (
  id                       TEXT PRIMARY KEY,
  user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_operation_id  TEXT NOT NULL CHECK (length(submission_operation_id) BETWEEN 8 AND 128),
  provider                 TEXT NOT NULL CHECK (provider = 'flighty'),
  profile                  TEXT NOT NULL CHECK (length(profile) <= 64),
  mapper_version           INTEGER NOT NULL CHECK (mapper_version >= 1),
  headers_json             TEXT NOT NULL CHECK (json_valid(headers_json) AND length(headers_json) <= 8192),
  -- Declared before any chunk: [{count, digest}] in chunk order. A chunk is admitted only if it matches its entry.
  manifest_json            TEXT NOT NULL CHECK (json_valid(manifest_json) AND length(manifest_json) <= 32768),
  manifest_digest          TEXT NOT NULL CHECK (length(manifest_digest) = 64),
  total_records            INTEGER NOT NULL CHECK (total_records BETWEEN 0 AND 10000),
  total_chunks             INTEGER NOT NULL CHECK (total_chunks BETWEEN 0 AND 200),
  blank_lines              INTEGER NOT NULL DEFAULT 0 CHECK (blank_lines >= 0),
  -- Serialized row payload admitted so far; capped at 200 chunks of 256 KiB (FLIGHTY_MAX_CHUNKS * HISTORY_CHUNK_MAX_BYTES).
  stored_bytes             INTEGER NOT NULL DEFAULT 0 CHECK (stored_bytes BETWEEN 0 AND 52428800),
  status                   TEXT NOT NULL CHECK (status IN ('receiving','review','completed','closed')),
  generation               INTEGER NOT NULL DEFAULT 1 CHECK (generation >= 1),
  revision                 INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  source_erased_at         TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  expires_at               TEXT NOT NULL,
  UNIQUE (user_id, submission_operation_id)
);
CREATE INDEX idx_history_import_runs_user ON history_import_runs(user_id, status, created_at);
CREATE INDEX idx_history_import_runs_expiry ON history_import_runs(expires_at);

CREATE TABLE history_import_rows (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_id             TEXT NOT NULL REFERENCES history_import_runs(id) ON DELETE CASCADE,
  ordinal            INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 9999),
  line               INTEGER NOT NULL CHECK (line >= 1),
  chunk_index        INTEGER NOT NULL CHECK (chunk_index >= 0),
  -- Verbatim cells aligned to the run's headers; NULL once erased, discarded, expired or tombstoned.
  cells_json         TEXT CHECK (cells_json IS NULL OR (json_valid(cells_json) AND length(cells_json) <= 70000)),
  record_digest      TEXT NOT NULL CHECK (length(record_digest) = 64),
  -- Minimal identity kept in tombstones: opaque Flighty ID and date|from|to|airline|number tokens. No PNR or notes.
  flighty_flight_id  TEXT CHECK (flighty_flight_id IS NULL OR length(flighty_flight_id) <= 128),
  match_key          TEXT CHECK (match_key IS NULL OR length(match_key) <= 256),
  match_date         TEXT,
  match_origin       TEXT,
  match_destination  TEXT,
  answers_json       TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(answers_json) AND length(answers_json) <= 4096),
  issues_json        TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(issues_json) AND length(issues_json) <= 8192),
  -- The server's match finding (ADR 0008 "Matching"), or NULL.
  finding_json       TEXT CHECK (finding_json IS NULL OR (json_valid(finding_json) AND length(finding_json) <= 512)),
  action             TEXT CHECK (action IS NULL OR action IN ('create','preserve_only','link')),
  state              TEXT NOT NULL CHECK (state IN
    ('ready','needs_review','error','created','duplicate','preserved_only','ignored','removed')),
  ignore_reason      TEXT CHECK (ignore_reason IS NULL OR ignore_reason IN ('owner','discarded','expired')),
  version            INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  -- No foreign key: deletion paths clear the link explicitly and keep the tombstone.
  flight_id          INTEGER,
  operation_key      TEXT CHECK (operation_key IS NULL OR length(operation_key) <= 128),
  request_digest     TEXT,
  committed_at       TEXT,
  flight_deleted_at  TEXT,
  source_erased_at   TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (run_id, ordinal)
);
CREATE INDEX idx_history_import_rows_page ON history_import_rows(user_id, run_id, state, ordinal);
CREATE INDEX idx_history_import_rows_flight ON history_import_rows(user_id, flight_id) WHERE flight_id IS NOT NULL;
CREATE INDEX idx_history_import_rows_digest ON history_import_rows(user_id, record_digest);
CREATE INDEX idx_history_import_rows_flighty ON history_import_rows(user_id, flighty_flight_id)
  WHERE flighty_flight_id IS NOT NULL;
CREATE INDEX idx_history_import_rows_match ON history_import_rows(user_id, match_key) WHERE match_key IS NOT NULL;
CREATE UNIQUE INDEX idx_history_import_rows_receipt ON history_import_rows(user_id, operation_key)
  WHERE operation_key IS NOT NULL;

-- 1 when departure_utc/arrival_utc came from explicit source instants rather than wall-clock inference (ADR 0008).
-- Server-owned and private; existing flights keep 0 and are not recalculated.
ALTER TABLE flights ADD COLUMN utc_explicit INTEGER NOT NULL DEFAULT 0 CHECK (utc_explicit IN (0,1));
