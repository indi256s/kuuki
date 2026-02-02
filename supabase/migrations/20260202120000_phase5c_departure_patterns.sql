-- Phase 5c: Time Geek Tier - Departure Patterns & Duration Coverage
-- Adds departure pattern analysis and duration data coverage tracking
-- for the Time Geek tier in Advanced Stats

-- ============================================================================
-- 1. Add New Columns to user_advanced_stats
-- ============================================================================

ALTER TABLE user_advanced_stats ADD COLUMN IF NOT EXISTS departure_patterns JSONB;
ALTER TABLE user_advanced_stats ADD COLUMN IF NOT EXISTS duration_coverage REAL DEFAULT 0;

-- ============================================================================
-- 2. Function to Compute Departure Patterns
-- ============================================================================
-- Aviation time buckets:
-- - Red-eye: 22:00-05:00 (overnight flights)
-- - Early: 05:00-09:00 (early morning departures)
-- - Business: 09:00-17:00 (standard business hours)
-- - Evening: 17:00-22:00 (after-work departures)

CREATE OR REPLACE FUNCTION compute_departure_patterns(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'red_eye', COUNT(*) FILTER (
      WHERE EXTRACT(HOUR FROM departure_time::time) >= 22
         OR EXTRACT(HOUR FROM departure_time::time) < 5
    ),
    'early', COUNT(*) FILTER (
      WHERE EXTRACT(HOUR FROM departure_time::time) >= 5
        AND EXTRACT(HOUR FROM departure_time::time) < 9
    ),
    'business', COUNT(*) FILTER (
      WHERE EXTRACT(HOUR FROM departure_time::time) >= 9
        AND EXTRACT(HOUR FROM departure_time::time) < 17
    ),
    'evening', COUNT(*) FILTER (
      WHERE EXTRACT(HOUR FROM departure_time::time) >= 17
        AND EXTRACT(HOUR FROM departure_time::time) < 22
    ),
    'total_with_time', COUNT(*) FILTER (WHERE departure_time IS NOT NULL)
  )
  INTO v_result
  FROM flights
  WHERE user_id = p_user_id
    AND (is_upcoming IS NULL OR is_upcoming = FALSE);

  RETURN COALESCE(v_result, jsonb_build_object(
    'red_eye', 0,
    'early', 0,
    'business', 0,
    'evening', 0,
    'total_with_time', 0
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. Function to Compute Duration Coverage
-- ============================================================================
-- Returns the percentage of flights that have duration data (0-100)

CREATE OR REPLACE FUNCTION compute_duration_coverage(p_user_id UUID)
RETURNS REAL AS $$
DECLARE
  v_total INT;
  v_with_duration INT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE duration_minutes IS NOT NULL AND duration_minutes > 0)
  INTO v_total, v_with_duration
  FROM flights
  WHERE user_id = p_user_id
    AND (is_upcoming IS NULL OR is_upcoming = FALSE);

  IF v_total = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND((v_with_duration::REAL / v_total::REAL) * 100, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Update refresh_advanced_stats Function
-- ============================================================================
-- Adds departure_patterns and duration_coverage to the refresh routine

CREATE OR REPLACE FUNCTION refresh_advanced_stats(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_stats RECORD;
  v_aircraft_breakdown JSONB;
  v_aircraft_type_breakdown JSONB;
  v_departure_patterns JSONB;
  v_duration_coverage REAL;
BEGIN
  -- Get current user_stats
  SELECT * INTO v_stats FROM user_stats WHERE user_id = p_user_id;

  IF v_stats IS NULL THEN
    RETURN;
  END IF;

  -- Compute breakdowns
  v_aircraft_breakdown := compute_aircraft_breakdown(p_user_id);
  v_aircraft_type_breakdown := compute_aircraft_type_breakdown(p_user_id);
  v_departure_patterns := compute_departure_patterns(p_user_id);
  v_duration_coverage := compute_duration_coverage(p_user_id);

  -- Upsert advanced stats with all computed values
  INSERT INTO user_advanced_stats (
    user_id,
    avia_geek_unlocked,
    country_geek_unlocked,
    duration_unlocked,
    manufacturer_breakdown,
    aircraft_breakdown,
    aircraft_type_breakdown,
    continent_breakdown,
    region_breakdown,
    duration_stats,
    departure_patterns,
    duration_coverage,
    updated_at
  )
  VALUES (
    p_user_id,
    v_stats.aircraft_count >= 5,
    v_stats.countries_count >= 5,
    v_stats.total_flights >= 10,
    v_aircraft_breakdown->'manufacturers',
    v_aircraft_breakdown->'aircraft',
    v_aircraft_type_breakdown,
    (SELECT compute_continent_breakdown(p_user_id)),
    (SELECT compute_region_breakdown(p_user_id)),
    (SELECT compute_duration_stats(p_user_id)),
    v_departure_patterns,
    v_duration_coverage,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    avia_geek_unlocked = v_stats.aircraft_count >= 5,
    country_geek_unlocked = v_stats.countries_count >= 5,
    duration_unlocked = v_stats.total_flights >= 10,
    manufacturer_breakdown = v_aircraft_breakdown->'manufacturers',
    aircraft_breakdown = v_aircraft_breakdown->'aircraft',
    aircraft_type_breakdown = v_aircraft_type_breakdown,
    continent_breakdown = (SELECT compute_continent_breakdown(p_user_id)),
    region_breakdown = (SELECT compute_region_breakdown(p_user_id)),
    duration_stats = (SELECT compute_duration_stats(p_user_id)),
    departure_patterns = v_departure_patterns,
    duration_coverage = v_duration_coverage,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Re-compute stats for all existing users
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  FOR v_user_id IN SELECT DISTINCT user_id FROM user_stats LOOP
    PERFORM refresh_advanced_stats(v_user_id);
  END LOOP;
END
$$;

-- ============================================================================
-- 6. Add Index for departure time queries (optional optimization)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_flights_departure_time
ON flights (user_id, departure_time)
WHERE departure_time IS NOT NULL;
