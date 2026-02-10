-- Enrich Fleet & Manufacturer Dashboard Widgets
-- Adds fleet_insights and manufacturer_insights JSONB columns
-- Creates compute functions for hero aircraft, fun comparisons, and loyalty narratives

-- ============================================================================
-- 1. Add New Columns to user_advanced_stats
-- ============================================================================

ALTER TABLE user_advanced_stats ADD COLUMN IF NOT EXISTS fleet_insights JSONB;
ALTER TABLE user_advanced_stats ADD COLUMN IF NOT EXISTS manufacturer_insights JSONB;

-- ============================================================================
-- 2. Function: compute_fleet_insights
-- ============================================================================
-- Returns hero aircraft with distance/duration aggregates and a fun comparison

CREATE OR REPLACE FUNCTION compute_fleet_insights(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_hero RECORD;
  v_total_flights INT;
  v_fun_fact TEXT;
  v_distance_km NUMERIC;
  v_duration_min NUMERIC;
  v_templates TEXT[];
BEGIN
  -- Count total flights
  SELECT COUNT(*) INTO v_total_flights
  FROM flights
  WHERE user_id = p_user_id
    AND aircraft_icao IS NOT NULL
    AND (is_upcoming IS NULL OR is_upcoming = FALSE);

  IF v_total_flights = 0 THEN
    RETURN NULL;
  END IF;

  -- Find #1 most flown aircraft with aggregates
  SELECT
    f.aircraft_icao,
    COALESCE(ar.model, f.aircraft_icao) as model,
    COALESCE(ar.manufacturer, 'Unknown') as manufacturer,
    COALESCE(ar.name, f.aircraft_icao) as name,
    COALESCE(ar.type, 'unknown') as type,
    COUNT(*) as flight_count,
    ROUND((COUNT(*)::NUMERIC / v_total_flights) * 100, 1) as pct,
    COALESCE(SUM(f.distance_km), 0) as total_distance_km,
    COALESCE(SUM(f.duration_minutes), 0) as total_duration_minutes
  INTO v_hero
  FROM flights f
  LEFT JOIN aircraft_reference ar ON f.aircraft_icao = ar.icao
  WHERE f.user_id = p_user_id
    AND f.aircraft_icao IS NOT NULL
    AND (f.is_upcoming IS NULL OR f.is_upcoming = FALSE)
  GROUP BY f.aircraft_icao, ar.model, ar.manufacturer, ar.name, ar.type
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  IF v_hero IS NULL THEN
    RETURN NULL;
  END IF;

  v_distance_km := v_hero.total_distance_km;
  v_duration_min := v_hero.total_duration_minutes;

  -- Generate fun fact based on distance magnitude
  IF v_distance_km >= 384400 THEN
    -- Moon distance
    v_fun_fact := format('Enough to reach the Moon. The irony of going nowhere in particular is not lost on us.', '');
  ELSIF v_distance_km >= 40075 THEN
    -- Earth circumference multiples
    v_fun_fact := format('That''s %s laps around Earth on this aircraft alone. For science.',
      ROUND(v_distance_km / 40075, 1));
  ELSIF v_distance_km >= 10000 THEN
    -- Transatlantic equivalents (NYC-London ~ 5,570 km)
    v_fun_fact := format('Enough to cross the Atlantic %s times. The cabin air was complimentary.',
      ROUND(v_distance_km / 5570));
  ELSIF v_distance_km >= 3000 THEN
    -- Transcontinental (NYC-LAX ~ 3,944 km)
    v_fun_fact := format('%s km on this type alone. The seat cushion remembers you.',
      ROUND(v_distance_km));
  ELSIF v_duration_min >= 1440 THEN
    -- More than a day
    v_fun_fact := format('%s hours of recycled cabin air on this aircraft. Your lungs have been noted.',
      ROUND(v_duration_min / 60));
  ELSIF v_duration_min >= 120 THEN
    v_fun_fact := format('%s hours logged. The tray table has become a familiar workspace.',
      ROUND(v_duration_min / 60));
  ELSE
    v_fun_fact := format('%s flights. Developing a preference, are we?', v_hero.flight_count);
  END IF;

  RETURN jsonb_build_object(
    'hero', jsonb_build_object(
      'icao', v_hero.aircraft_icao,
      'model', v_hero.model,
      'manufacturer', v_hero.manufacturer,
      'name', v_hero.name,
      'type', v_hero.type,
      'count', v_hero.flight_count,
      'pct', v_hero.pct,
      'total_distance_km', ROUND(v_distance_km),
      'total_duration_minutes', ROUND(v_duration_min),
      'fun_fact', v_fun_fact
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. Function: compute_manufacturer_insights
-- ============================================================================
-- Returns dominant manufacturer loyalty narrative with GLaDOS personality

CREATE OR REPLACE FUNCTION compute_manufacturer_insights(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_dominant RECORD;
  v_total_flights INT;
  v_types_count INT;
  v_loyalty_label TEXT;
  v_loyalty_quip TEXT;
  v_pct NUMERIC;
BEGIN
  -- Count total flights with aircraft
  SELECT COUNT(*) INTO v_total_flights
  FROM flights
  WHERE user_id = p_user_id
    AND aircraft_icao IS NOT NULL
    AND (is_upcoming IS NULL OR is_upcoming = FALSE);

  IF v_total_flights = 0 THEN
    RETURN NULL;
  END IF;

  -- Find dominant manufacturer
  SELECT
    COALESCE(ar.manufacturer, 'Unknown') as name,
    COUNT(*) as flight_count
  INTO v_dominant
  FROM flights f
  LEFT JOIN aircraft_reference ar ON f.aircraft_icao = ar.icao
  WHERE f.user_id = p_user_id
    AND f.aircraft_icao IS NOT NULL
    AND (f.is_upcoming IS NULL OR f.is_upcoming = FALSE)
  GROUP BY COALESCE(ar.manufacturer, 'Unknown')
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  IF v_dominant IS NULL THEN
    RETURN NULL;
  END IF;

  v_pct := ROUND((v_dominant.flight_count::NUMERIC / v_total_flights) * 100, 1);

  -- Count distinct aircraft types for this manufacturer
  SELECT COUNT(DISTINCT f.aircraft_icao) INTO v_types_count
  FROM flights f
  LEFT JOIN aircraft_reference ar ON f.aircraft_icao = ar.icao
  WHERE f.user_id = p_user_id
    AND f.aircraft_icao IS NOT NULL
    AND (f.is_upcoming IS NULL OR f.is_upcoming = FALSE)
    AND COALESCE(ar.manufacturer, 'Unknown') = v_dominant.name;

  -- Assign loyalty tier and quip based on percentage
  IF v_pct >= 80 THEN
    v_loyalty_label := 'Devoted test subject';
    v_loyalty_quip := format('Your %s loyalty has been recorded. They should name a seat after you. Row 17B, perhaps.', v_dominant.name);
  ELSIF v_pct >= 60 THEN
    v_loyalty_label := 'Reliably predictable';
    v_loyalty_quip := format('You favor %s %s%% of the time. The predictability is... comforting. For them.', v_dominant.name, ROUND(v_pct));
  ELSIF v_pct >= 40 THEN
    v_loyalty_label := 'Mildly committed';
    v_loyalty_quip := format('%s leads your fleet at %s%%. A plurality, not a mandate. How democratic.', v_dominant.name, ROUND(v_pct));
  ELSE
    v_loyalty_label := 'Manufacturer-agnostic';
    v_loyalty_quip := format('No clear manufacturer preference. You fly whatever gets you there. A pragmatist. How refreshing.');
  END IF;

  RETURN jsonb_build_object(
    'dominant', jsonb_build_object(
      'name', v_dominant.name,
      'pct', v_pct,
      'count', v_dominant.flight_count,
      'types_count', v_types_count,
      'loyalty_label', v_loyalty_label,
      'loyalty_quip', v_loyalty_quip
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Update refresh_advanced_stats Function
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_advanced_stats(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_stats RECORD;
  v_aircraft_breakdown JSONB;
  v_aircraft_type_breakdown JSONB;
  v_departure_patterns JSONB;
  v_duration_coverage REAL;
  v_fleet_insights JSONB;
  v_manufacturer_insights JSONB;
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
  v_fleet_insights := compute_fleet_insights(p_user_id);
  v_manufacturer_insights := compute_manufacturer_insights(p_user_id);

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
    fleet_insights,
    manufacturer_insights,
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
    v_fleet_insights,
    v_manufacturer_insights,
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
    fleet_insights = v_fleet_insights,
    manufacturer_insights = v_manufacturer_insights,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Re-compute for existing users
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
