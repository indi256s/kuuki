-- Server-owned import drafts: batches, draft rows and conversion receipts (ADR 0001 §6, §7).
-- Additive only and deliberately separate from 0006, so the deploy order stays reviewable:
-- apply 0006, deploy the lifecycle-aware build; apply 0007, deploy the import-draft build.
-- Uploaded bytes, pasted text, provider responses and raw_text are never stored in these tables.

CREATE TABLE import_batches (
  id                       TEXT PRIMARY KEY,
  user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type              TEXT NOT NULL CHECK (source_type IN ('pdf','image','text')),
  source_label             TEXT CHECK (source_label IS NULL OR length(source_label) <= 120),
  status                   TEXT NOT NULL
    CHECK (status IN ('processing','review','partial','failed','cancelled','completed')),
  stage                    TEXT CHECK (stage IS NULL OR stage IN ('accepted','recognizing','validating','review_ready')),
  sequence                 INTEGER NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  generation               INTEGER NOT NULL DEFAULT 1,
  submission_operation_id  TEXT NOT NULL,
  error_code               TEXT,
  retry_after              TEXT,
  processing_deadline      TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  expires_at               TEXT NOT NULL,
  UNIQUE (user_id, submission_operation_id)
);
CREATE INDEX idx_import_batches_user ON import_batches(user_id, status, created_at);
CREATE INDEX idx_import_batches_expiry ON import_batches(expires_at);

CREATE TABLE import_drafts (
  id                      TEXT PRIMARY KEY,
  user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_id                TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  ordinal                 INTEGER NOT NULL CHECK (ordinal >= 0),
  fields_json             TEXT NOT NULL CHECK (length(fields_json) <= 2048),
  confidence              REAL CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  field_confidence_json   TEXT CHECK (field_confidence_json IS NULL OR length(field_confidence_json) <= 1024),
  year_explicit           INTEGER NOT NULL DEFAULT 0 CHECK (year_explicit IN (0,1)),
  year_confirmed          INTEGER NOT NULL DEFAULT 0 CHECK (year_confirmed IN (0,1)),
  selected                INTEGER NOT NULL DEFAULT 0 CHECK (selected IN (0,1)),
  edited                  INTEGER NOT NULL DEFAULT 0 CHECK (edited IN (0,1)),
  duplicate_acknowledged  INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_acknowledged IN (0,1)),
  status                  TEXT NOT NULL DEFAULT 'review' CHECK (status IN ('review','dismissed','converted')),
  version                 INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  converted_flight_id     INTEGER,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  UNIQUE (batch_id, ordinal)
);
CREATE INDEX idx_import_drafts_user_status ON import_drafts(user_id, status);

-- Tombstones: no foreign keys to drafts, batches or flights, so a replay survives their deletion.
CREATE TABLE import_conversion_receipts (
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_key   TEXT NOT NULL,
  draft_id        TEXT NOT NULL,
  batch_id        TEXT NOT NULL,
  request_digest  TEXT NOT NULL,
  flight_id       INTEGER NOT NULL,
  created_at      TEXT NOT NULL,
  PRIMARY KEY (user_id, operation_key),
  UNIQUE (user_id, draft_id)
);
CREATE INDEX idx_import_conversion_receipts_created ON import_conversion_receipts(created_at);
