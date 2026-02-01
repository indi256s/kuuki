-- Phase 5: Advanced Stats Migration
-- Adds support for tiered stats with unlock system and pre-computed analytics

-- ============================================================================
-- 1. User Advanced Stats Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_advanced_stats (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Unlock flags (computed from user_stats thresholds)
  avia_geek_unlocked BOOLEAN DEFAULT FALSE,      -- 5+ aircraft types
  country_geek_unlocked BOOLEAN DEFAULT FALSE,   -- 5+ countries
  duration_unlocked BOOLEAN DEFAULT FALSE,       -- 10+ flights

  -- Pre-computed analytics (populated in Phase 5b/5c)
  manufacturer_breakdown JSONB,                   -- {"Airbus": 12, "Boeing": 8, ...}
  aircraft_breakdown JSONB,                       -- {"A320": 5, "737": 3, ...}
  continent_breakdown JSONB,                      -- {"EU": 12, "AS": 5, ...}
  duration_stats JSONB,                           -- {total_minutes, avg, longest, shortest}
  patterns JSONB,                                 -- Quirky observations

  -- Fun fact rotation
  featured_fact TEXT,
  featured_fact_index INT DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_advanced_stats ENABLE ROW LEVEL SECURITY;

-- Everyone can view their own stats
CREATE POLICY "Users can view own advanced stats" ON user_advanced_stats
FOR SELECT USING (auth.uid() = user_id);

-- Public profiles can have stats viewed
CREATE POLICY "Public profiles advanced stats viewable" ON user_advanced_stats
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = user_advanced_stats.user_id
    AND profiles.is_public = TRUE
  )
);

-- System updates stats (via service role or triggers)
CREATE POLICY "System can update advanced stats" ON user_advanced_stats
FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 2. Function to Update Unlock Flags
-- ============================================================================

CREATE OR REPLACE FUNCTION update_advanced_stats_unlocks()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_advanced_stats (
    user_id,
    avia_geek_unlocked,
    country_geek_unlocked,
    duration_unlocked,
    updated_at
  )
  VALUES (
    NEW.user_id,
    NEW.aircraft_count >= 5,
    NEW.countries_count >= 5,
    NEW.total_flights >= 10,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    avia_geek_unlocked = NEW.aircraft_count >= 5,
    country_geek_unlocked = NEW.countries_count >= 5,
    duration_unlocked = NEW.total_flights >= 10,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. Trigger on user_stats Changes
-- ============================================================================

DROP TRIGGER IF EXISTS user_stats_unlock_trigger ON user_stats;
CREATE TRIGGER user_stats_unlock_trigger
AFTER INSERT OR UPDATE ON user_stats
FOR EACH ROW EXECUTE FUNCTION update_advanced_stats_unlocks();

-- ============================================================================
-- 4. Function to Compute Duration Stats (Phase 5c prep)
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_duration_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_minutes', COALESCE(SUM(duration_minutes), 0),
    'avg_minutes', COALESCE(ROUND(AVG(duration_minutes)), 0),
    'longest_minutes', COALESCE(MAX(duration_minutes), 0),
    'longest_flight_id', (
      SELECT id FROM flights
      WHERE user_id = p_user_id
        AND duration_minutes = (SELECT MAX(duration_minutes) FROM flights WHERE user_id = p_user_id)
        AND (is_upcoming IS NULL OR is_upcoming = FALSE)
      LIMIT 1
    ),
    'shortest_minutes', COALESCE(MIN(NULLIF(duration_minutes, 0)), 0),
    'shortest_flight_id', (
      SELECT id FROM flights
      WHERE user_id = p_user_id
        AND duration_minutes > 0
        AND duration_minutes = (SELECT MIN(NULLIF(duration_minutes, 0)) FROM flights WHERE user_id = p_user_id)
        AND (is_upcoming IS NULL OR is_upcoming = FALSE)
      LIMIT 1
    ),
    'flight_count', COUNT(*)
  )
  INTO v_result
  FROM flights
  WHERE user_id = p_user_id
    AND (is_upcoming IS NULL OR is_upcoming = FALSE)
    AND duration_minutes IS NOT NULL;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Function to Compute Aircraft Breakdown (Phase 5b prep)
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_aircraft_breakdown(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_aircraft JSONB;
  v_manufacturer JSONB;
BEGIN
  -- Aircraft type counts
  SELECT jsonb_object_agg(aircraft_icao, count)
  INTO v_aircraft
  FROM (
    SELECT aircraft_icao, COUNT(*) as count
    FROM flights
    WHERE user_id = p_user_id
      AND aircraft_icao IS NOT NULL
      AND (is_upcoming IS NULL OR is_upcoming = FALSE)
    GROUP BY aircraft_icao
    ORDER BY count DESC
    LIMIT 10
  ) t;

  -- Manufacturer breakdown (simplified - will be enhanced with aircraft data join)
  SELECT jsonb_object_agg(manufacturer, count)
  INTO v_manufacturer
  FROM (
    SELECT
      CASE
        WHEN aircraft_icao LIKE 'A3%' OR aircraft_icao LIKE 'A2%' THEN 'Airbus'
        WHEN aircraft_icao LIKE 'B7%' OR aircraft_icao LIKE 'B73%' OR aircraft_icao LIKE 'B77%' OR aircraft_icao LIKE 'B78%' THEN 'Boeing'
        WHEN aircraft_icao LIKE 'E%' THEN 'Embraer'
        WHEN aircraft_icao LIKE 'CRJ%' OR aircraft_icao LIKE 'DH%' THEN 'Bombardier'
        WHEN aircraft_icao LIKE 'AT%' THEN 'ATR'
        ELSE 'Other'
      END as manufacturer,
      COUNT(*) as count
    FROM flights
    WHERE user_id = p_user_id
      AND aircraft_icao IS NOT NULL
      AND (is_upcoming IS NULL OR is_upcoming = FALSE)
    GROUP BY manufacturer
    ORDER BY count DESC
  ) t;

  RETURN jsonb_build_object(
    'aircraft', COALESCE(v_aircraft, '{}'::jsonb),
    'manufacturers', COALESCE(v_manufacturer, '{}'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Function to Compute Continent Breakdown (Phase 5b prep)
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_continent_breakdown(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_object_agg(continent, count)
  INTO v_result
  FROM (
    SELECT
      CASE
        WHEN country_code IN ('US', 'CA', 'MX', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA', 'CU', 'JM', 'HT', 'DO', 'PR', 'BS', 'TT', 'BB') THEN 'NA'
        WHEN country_code IN ('BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'GY', 'SR') THEN 'SA'
        WHEN country_code IN ('GB', 'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'PL', 'CZ', 'HU', 'RO', 'BG', 'GR', 'SE', 'NO', 'DK', 'FI', 'IE', 'LU', 'SK', 'SI', 'HR', 'RS', 'UA', 'BY', 'LT', 'LV', 'EE', 'MD', 'AL', 'MK', 'ME', 'BA', 'XK', 'IS', 'MT', 'CY', 'MC', 'SM', 'AD', 'LI', 'VA') THEN 'EU'
        WHEN country_code IN ('RU', 'CN', 'JP', 'KR', 'IN', 'TH', 'VN', 'MY', 'SG', 'ID', 'PH', 'TW', 'HK', 'MO', 'KZ', 'UZ', 'TM', 'KG', 'TJ', 'MN', 'NP', 'BD', 'LK', 'PK', 'AF', 'IR', 'IQ', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'YE', 'JO', 'LB', 'SY', 'IL', 'PS', 'TR', 'GE', 'AM', 'AZ', 'MM', 'LA', 'KH', 'BN', 'TL') THEN 'AS'
        WHEN country_code IN ('AU', 'NZ', 'FJ', 'PG', 'NC', 'PF', 'WS', 'TO', 'VU', 'SB', 'GU', 'FM', 'MH', 'PW', 'KI', 'NR', 'TV', 'CK', 'NU', 'TK', 'WF', 'AS') THEN 'OC'
        WHEN country_code IN ('ZA', 'EG', 'MA', 'DZ', 'TN', 'LY', 'NG', 'KE', 'ET', 'GH', 'TZ', 'UG', 'SD', 'SS', 'SN', 'CI', 'CM', 'ZW', 'AO', 'MZ', 'MG', 'ZM', 'BW', 'NA', 'MU', 'RE', 'RW', 'BJ', 'TG', 'ML', 'BF', 'NE', 'TD', 'SO', 'DJ', 'ER', 'MW', 'LS', 'SZ', 'GM', 'GN', 'GW', 'SL', 'LR', 'GA', 'CG', 'CD', 'CF', 'GQ', 'ST', 'CV', 'KM', 'SC', 'YT') THEN 'AF'
        ELSE 'OTHER'
      END as continent,
      COUNT(DISTINCT country_code) as count
    FROM visits
    WHERE user_id = p_user_id AND country_code IS NOT NULL
    GROUP BY continent
  ) t;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Master Function to Refresh All Advanced Stats
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_advanced_stats(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_stats RECORD;
BEGIN
  -- Get current user_stats
  SELECT * INTO v_stats FROM user_stats WHERE user_id = p_user_id;

  IF v_stats IS NULL THEN
    RETURN;
  END IF;

  -- Upsert advanced stats with all computed values
  INSERT INTO user_advanced_stats (
    user_id,
    avia_geek_unlocked,
    country_geek_unlocked,
    duration_unlocked,
    manufacturer_breakdown,
    aircraft_breakdown,
    continent_breakdown,
    duration_stats,
    updated_at
  )
  VALUES (
    p_user_id,
    v_stats.aircraft_count >= 5,
    v_stats.countries_count >= 5,
    v_stats.total_flights >= 10,
    (SELECT compute_aircraft_breakdown(p_user_id))->'manufacturers',
    (SELECT compute_aircraft_breakdown(p_user_id))->'aircraft',
    (SELECT compute_continent_breakdown(p_user_id)),
    (SELECT compute_duration_stats(p_user_id)),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    avia_geek_unlocked = v_stats.aircraft_count >= 5,
    country_geek_unlocked = v_stats.countries_count >= 5,
    duration_unlocked = v_stats.total_flights >= 10,
    manufacturer_breakdown = (SELECT compute_aircraft_breakdown(p_user_id))->'manufacturers',
    aircraft_breakdown = (SELECT compute_aircraft_breakdown(p_user_id))->'aircraft',
    continent_breakdown = (SELECT compute_continent_breakdown(p_user_id)),
    duration_stats = (SELECT compute_duration_stats(p_user_id)),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. Initialize Advanced Stats for Existing Users
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
-- 9. Index for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_advanced_stats_unlocks
ON user_advanced_stats (avia_geek_unlocked, country_geek_unlocked, duration_unlocked);
