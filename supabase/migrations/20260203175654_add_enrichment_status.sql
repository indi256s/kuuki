-- Add enrichment_status column to track aircraft data enrichment state
-- Statuses: 'pending' (needs enrichment), 'enriched' (completed), 'failed' (error), 'skipped' (not needed)

-- Add the column with default value
ALTER TABLE flights
ADD COLUMN enrichment_status VARCHAR(10) DEFAULT 'pending'
CHECK (enrichment_status IN ('pending', 'enriched', 'failed', 'skipped'));

-- Backfill existing rows based on whether they already have aircraft data
-- If aircraft_icao is set, mark as 'enriched' (already has data)
-- If aircraft_icao is null but aircraft_lookup_attempts >= 3, mark as 'failed'
-- Otherwise leave as 'pending'
UPDATE flights SET enrichment_status =
  CASE
    WHEN aircraft_icao IS NOT NULL THEN 'enriched'
    WHEN aircraft_lookup_attempts >= 3 THEN 'failed'
    ELSE 'pending'
  END;

-- Create index for efficient queries on enrichment status
-- Useful for finding flights that need enrichment or showing shimmer states
CREATE INDEX idx_flights_enrichment_status ON flights(enrichment_status)
WHERE enrichment_status = 'pending';

-- Add comment for documentation
COMMENT ON COLUMN flights.enrichment_status IS 'Aircraft enrichment state: pending (needs enrichment), enriched (completed), failed (error after retries), skipped (not needed)';
