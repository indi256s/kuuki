-- Migration: Recalculate flight durations using timezone-aware logic
--
-- Problem: departure_time and arrival_time are stored as local times (HH:MM)
-- but duration_minutes was previously calculated by naive subtraction,
-- ignoring that origin and destination may be in different timezones.
--
-- Example: Depart 14:00 from JFK (UTC-5), arrive 03:00 at LHR (UTC+0)
-- Old calc: 03:00 - 14:00 = -11:00 → +13:00 (wrong, overnight assumption)
-- Correct:  14:00 EST = 19:00 UTC, 03:00 GMT = 03:00 UTC next day = 8 hours
--
-- This migration uses origin_tz / dest_tz (IANA timezone names) to convert
-- local times to UTC via AT TIME ZONE, then subtracts to get true duration.

-- Add UTC timestamp columns if they don't exist yet
ALTER TABLE flights ADD COLUMN IF NOT EXISTS departure_utc TIMESTAMPTZ;
ALTER TABLE flights ADD COLUMN IF NOT EXISTS arrival_utc TIMESTAMPTZ;

-- Recalculate duration_minutes for all flights that have:
-- 1) Both departure_time and arrival_time
-- 2) Both origin_tz and dest_tz (IANA timezone strings)
UPDATE flights
SET
  duration_minutes = (
    CASE
      WHEN (
        -- arrival in UTC minus departure in UTC
        EXTRACT(EPOCH FROM (
          (date + arrival_time) AT TIME ZONE dest_tz
          -
          (date + departure_time) AT TIME ZONE origin_tz
        )) / 60
      ) > 0
      AND (
        EXTRACT(EPOCH FROM (
          (date + arrival_time) AT TIME ZONE dest_tz
          -
          (date + departure_time) AT TIME ZONE origin_tz
        )) / 60
      ) <= 1440  -- max 24 hours
      THEN ROUND(
        EXTRACT(EPOCH FROM (
          (date + arrival_time) AT TIME ZONE dest_tz
          -
          (date + departure_time) AT TIME ZONE origin_tz
        )) / 60
      )

      -- Cross-day flight: arrival next day (add 24 hours to arrival)
      WHEN (
        EXTRACT(EPOCH FROM (
          ((date + INTERVAL '1 day') + arrival_time) AT TIME ZONE dest_tz
          -
          (date + departure_time) AT TIME ZONE origin_tz
        )) / 60
      ) > 0
      AND (
        EXTRACT(EPOCH FROM (
          ((date + INTERVAL '1 day') + arrival_time) AT TIME ZONE dest_tz
          -
          (date + departure_time) AT TIME ZONE origin_tz
        )) / 60
      ) <= 1440
      THEN ROUND(
        EXTRACT(EPOCH FROM (
          ((date + INTERVAL '1 day') + arrival_time) AT TIME ZONE dest_tz
          -
          (date + departure_time) AT TIME ZONE origin_tz
        )) / 60
      )

      -- Fallback: keep existing value
      ELSE duration_minutes
    END
  ),
  -- Also populate departure_utc and arrival_utc for future use
  departure_utc = (date + departure_time) AT TIME ZONE origin_tz,
  arrival_utc = CASE
    WHEN (
      EXTRACT(EPOCH FROM (
        (date + arrival_time) AT TIME ZONE dest_tz
        -
        (date + departure_time) AT TIME ZONE origin_tz
      )) / 60
    ) > 0
    THEN (date + arrival_time) AT TIME ZONE dest_tz
    ELSE ((date + INTERVAL '1 day') + arrival_time) AT TIME ZONE dest_tz
  END
WHERE
  departure_time IS NOT NULL
  AND arrival_time IS NOT NULL
  AND origin_tz IS NOT NULL
  AND dest_tz IS NOT NULL;

-- Refresh user stats to reflect corrected durations
-- (The existing trigger will handle new inserts/updates, but we need to
-- recompute stats for the backfilled data)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id
    FROM flights
    WHERE departure_time IS NOT NULL
      AND arrival_time IS NOT NULL
      AND origin_tz IS NOT NULL
      AND dest_tz IS NOT NULL
  LOOP
    -- Refresh user_stats for each affected user
    UPDATE user_stats
    SET
      total_duration_minutes = (
        SELECT COALESCE(SUM(duration_minutes), 0)
        FROM flights
        WHERE user_id = r.user_id
          AND (is_upcoming IS NULL OR is_upcoming = FALSE)
      ),
      longest_flight_minutes = (
        SELECT COALESCE(MAX(duration_minutes), 0)
        FROM flights
        WHERE user_id = r.user_id
          AND (is_upcoming IS NULL OR is_upcoming = FALSE)
      ),
      updated_at = NOW()
    WHERE user_id = r.user_id;
  END LOOP;
END $$;
