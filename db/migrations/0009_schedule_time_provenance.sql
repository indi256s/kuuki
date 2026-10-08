ALTER TABLE flights ADD COLUMN times_from_schedule INTEGER NOT NULL DEFAULT 0
  CHECK (times_from_schedule IN (0, 1));

-- Only explicit schedule provenance is recoverable; historical medians/times remain ambiguous.
UPDATE flights SET times_from_schedule = 1 WHERE duration_source = 'schedule';
