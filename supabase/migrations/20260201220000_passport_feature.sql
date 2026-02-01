-- Passport Feature Migration
-- Adds support for country claims and enhanced passport stats

-- ============================================================================
-- 1. Country Claims Table (for ground travel)
-- ============================================================================

CREATE TABLE IF NOT EXISTS country_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL, -- ISO 3166-1 alpha-2
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  visit_year INT, -- optional approximate year
  note TEXT CHECK (char_length(note) <= 200), -- optional user note
  entry_method TEXT CHECK (entry_method IN ('land', 'sea')), -- NULL for unspecified
  UNIQUE(user_id, country_code)
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_country_claims_user_id ON country_claims(user_id);

-- Enable RLS
ALTER TABLE country_claims ENABLE ROW LEVEL SECURITY;

-- Users can only see their own claims
CREATE POLICY "Users can view own claims" ON country_claims
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own claims" ON country_claims
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own claims" ON country_claims
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own claims" ON country_claims
FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 2. Extend user_stats with new passport fields
-- ============================================================================

ALTER TABLE user_stats
ADD COLUMN IF NOT EXISTS time_zones_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS most_visited_country TEXT,
ADD COLUMN IF NOT EXISTS most_visited_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS world_completion_pct DECIMAL(5,2) DEFAULT 0;

-- ============================================================================
-- 3. Update recalculate_user_stats to include country_claims
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_user_stats(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_flights INT;
  v_total_distance BIGINT;
  v_countries INT;
  v_cities INT;
  v_airlines INT;
  v_aircraft INT;
  v_continents INT;
  v_longest_flight INT;
  v_has_night_departure BOOLEAN;
  v_time_zones INT;
  v_most_visited_country TEXT;
  v_most_visited_count INT;
  v_world_pct DECIMAL(5,2);
BEGIN
  -- Count completed flights
  SELECT
    COUNT(*),
    COALESCE(SUM(distance_km), 0),
    COALESCE(MAX(duration_minutes), 0)
  INTO v_total_flights, v_total_distance, v_longest_flight
  FROM flights
  WHERE user_id = p_user_id AND (is_upcoming IS NULL OR is_upcoming = FALSE);

  -- Count unique airlines
  SELECT COUNT(DISTINCT airline_iata) INTO v_airlines
  FROM flights
  WHERE user_id = p_user_id
    AND airline_iata IS NOT NULL
    AND (is_upcoming IS NULL OR is_upcoming = FALSE);

  -- Count unique aircraft
  SELECT COUNT(DISTINCT aircraft_icao) INTO v_aircraft
  FROM flights
  WHERE user_id = p_user_id
    AND aircraft_icao IS NOT NULL
    AND (is_upcoming IS NULL OR is_upcoming = FALSE);

  -- Count countries from BOTH visits AND country_claims (union of both sources)
  SELECT COUNT(DISTINCT country_code) INTO v_countries
  FROM (
    SELECT country_code FROM visits WHERE user_id = p_user_id
    UNION
    SELECT country_code FROM country_claims WHERE user_id = p_user_id
  ) combined_countries;

  -- Count cities from visits only (claims don't have city data)
  SELECT COUNT(DISTINCT city) INTO v_cities
  FROM visits
  WHERE user_id = p_user_id AND city IS NOT NULL;

  -- Count continents (from combined country sources)
  SELECT COUNT(DISTINCT
    CASE
      WHEN country_code IN ('US', 'CA', 'MX', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA', 'CU', 'JM', 'HT', 'DO', 'PR', 'BS', 'TT', 'BB') THEN 'NA'
      WHEN country_code IN ('BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'GY', 'SR') THEN 'SA'
      WHEN country_code IN ('GB', 'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'PL', 'CZ', 'HU', 'RO', 'BG', 'GR', 'SE', 'NO', 'DK', 'FI', 'IE', 'LU', 'SK', 'SI', 'HR', 'RS', 'UA', 'BY', 'LT', 'LV', 'EE', 'MD', 'AL', 'MK', 'ME', 'BA', 'XK', 'IS', 'MT', 'CY', 'MC', 'SM', 'AD', 'LI', 'VA') THEN 'EU'
      WHEN country_code IN ('RU', 'CN', 'JP', 'KR', 'IN', 'TH', 'VN', 'MY', 'SG', 'ID', 'PH', 'TW', 'HK', 'MO', 'KZ', 'UZ', 'TM', 'KG', 'TJ', 'MN', 'NP', 'BD', 'LK', 'PK', 'AF', 'IR', 'IQ', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'YE', 'JO', 'LB', 'SY', 'IL', 'PS', 'TR', 'GE', 'AM', 'AZ', 'MM', 'LA', 'KH', 'BN', 'TL') THEN 'AS'
      WHEN country_code IN ('AU', 'NZ', 'FJ', 'PG', 'NC', 'PF', 'WS', 'TO', 'VU', 'SB', 'GU', 'FM', 'MH', 'PW', 'KI', 'NR', 'TV', 'CK', 'NU', 'TK', 'WF', 'AS') THEN 'OC'
      WHEN country_code IN ('ZA', 'EG', 'MA', 'DZ', 'TN', 'LY', 'NG', 'KE', 'ET', 'GH', 'TZ', 'UG', 'SD', 'SS', 'SN', 'CI', 'CM', 'ZW', 'AO', 'MZ', 'MG', 'ZM', 'BW', 'NA', 'MU', 'RE', 'RW', 'BJ', 'TG', 'ML', 'BF', 'NE', 'TD', 'SO', 'DJ', 'ER', 'MW', 'LS', 'SZ', 'GM', 'GN', 'GW', 'SL', 'LR', 'GA', 'CG', 'CD', 'CF', 'GQ', 'ST', 'CV', 'KM', 'SC', 'YT') THEN 'AF'
      ELSE 'OTHER'
    END
  ) INTO v_continents
  FROM (
    SELECT country_code FROM visits WHERE user_id = p_user_id
    UNION
    SELECT country_code FROM country_claims WHERE user_id = p_user_id
  ) combined_countries
  WHERE country_code IS NOT NULL;

  -- Check for night departures (00:00-05:00)
  SELECT EXISTS(
    SELECT 1 FROM flights
    WHERE user_id = p_user_id
      AND departure_time IS NOT NULL
      AND (departure_time::time >= '00:00:00' AND departure_time::time < '05:00:00')
      AND (is_upcoming IS NULL OR is_upcoming = FALSE)
  ) INTO v_has_night_departure;

  -- Count unique time zones from visited airports
  SELECT COUNT(DISTINCT origin_tz) INTO v_time_zones
  FROM flights
  WHERE user_id = p_user_id
    AND origin_tz IS NOT NULL
    AND (is_upcoming IS NULL OR is_upcoming = FALSE);

  -- Find most visited country (from visits only, since that has visit_count)
  SELECT country_code, SUM(visit_count)::INT
  INTO v_most_visited_country, v_most_visited_count
  FROM visits
  WHERE user_id = p_user_id
  GROUP BY country_code
  ORDER BY SUM(visit_count) DESC
  LIMIT 1;

  -- Calculate world completion percentage (249 ISO countries/territories)
  v_world_pct := ROUND((v_countries::DECIMAL / 249) * 100, 2);

  -- Upsert stats
  INSERT INTO user_stats (
    user_id, total_flights, total_distance_km, countries_count, cities_count,
    airlines_count, aircraft_count, continents_count, longest_flight_minutes,
    has_night_departure, time_zones_count, most_visited_country, most_visited_count,
    world_completion_pct, updated_at
  ) VALUES (
    p_user_id, v_total_flights, v_total_distance, v_countries, v_cities,
    v_airlines, v_aircraft, v_continents, v_longest_flight,
    v_has_night_departure, v_time_zones, v_most_visited_country, v_most_visited_count,
    v_world_pct, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_flights = EXCLUDED.total_flights,
    total_distance_km = EXCLUDED.total_distance_km,
    countries_count = EXCLUDED.countries_count,
    cities_count = EXCLUDED.cities_count,
    airlines_count = EXCLUDED.airlines_count,
    aircraft_count = EXCLUDED.aircraft_count,
    continents_count = EXCLUDED.continents_count,
    longest_flight_minutes = EXCLUDED.longest_flight_minutes,
    has_night_departure = EXCLUDED.has_night_departure,
    time_zones_count = EXCLUDED.time_zones_count,
    most_visited_country = EXCLUDED.most_visited_country,
    most_visited_count = EXCLUDED.most_visited_count,
    world_completion_pct = EXCLUDED.world_completion_pct,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Trigger for country_claims changes
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_update_stats_from_claims()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_user_stats(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_user_stats(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS country_claims_stats_trigger ON country_claims;
CREATE TRIGGER country_claims_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON country_claims
FOR EACH ROW EXECUTE FUNCTION trigger_update_stats_from_claims();

-- ============================================================================
-- 5. Continent Achievement Badges
-- ============================================================================

INSERT INTO badge_definitions (code, name, description, category, tier, icon, criteria, points) VALUES
-- Continent Achievements (3+ countries per continent)
('continent-europe', 'Europhile', 'Visit 3+ European countries', 'achievement', NULL, 'map', '{"continent": "europe", "min_countries": 3}', 25),
('continent-asia', 'Asianaut', 'Visit 3+ Asian countries', 'achievement', NULL, 'map', '{"continent": "asia", "min_countries": 3}', 25),
('continent-americas', 'Americas Wanderer', 'Visit 3+ American countries', 'achievement', NULL, 'map', '{"continent": "americas", "min_countries": 3}', 25),
('continent-africa', 'Africa Explorer', 'Visit 3+ African countries', 'achievement', NULL, 'map', '{"continent": "africa", "min_countries": 3}', 25),
('continent-oceania', 'Pacific Voyager', 'Visit 3+ Oceanian countries', 'achievement', NULL, 'map', '{"continent": "oceania", "min_countries": 3}', 25)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  criteria = EXCLUDED.criteria;

-- ============================================================================
-- 6. Update evaluate_badges to include continent badges
-- ============================================================================

CREATE OR REPLACE FUNCTION evaluate_badges(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_stats RECORD;
  v_badge RECORD;
  v_user_number INT;
  v_criteria JSONB;
  v_earned BOOLEAN;
  v_continent_counts RECORD;
BEGIN
  -- Get user stats
  SELECT * INTO v_stats FROM user_stats WHERE user_id = p_user_id;

  IF v_stats IS NULL THEN
    RETURN;
  END IF;

  -- Get user number for early adopter badge
  SELECT COUNT(*) + 1 INTO v_user_number
  FROM profiles
  WHERE created_at < (SELECT created_at FROM profiles WHERE id = p_user_id);

  -- Calculate continent-specific country counts (from visits + claims)
  SELECT
    COUNT(DISTINCT CASE WHEN country_code IN ('GB', 'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'PL', 'CZ', 'HU', 'RO', 'BG', 'GR', 'SE', 'NO', 'DK', 'FI', 'IE', 'LU', 'SK', 'SI', 'HR', 'RS', 'UA', 'BY', 'LT', 'LV', 'EE', 'MD', 'AL', 'MK', 'ME', 'BA', 'XK', 'IS', 'MT', 'CY', 'MC', 'SM', 'AD', 'LI', 'VA') THEN country_code END) as europe_count,
    COUNT(DISTINCT CASE WHEN country_code IN ('RU', 'CN', 'JP', 'KR', 'IN', 'TH', 'VN', 'MY', 'SG', 'ID', 'PH', 'TW', 'HK', 'MO', 'KZ', 'UZ', 'TM', 'KG', 'TJ', 'MN', 'NP', 'BD', 'LK', 'PK', 'AF', 'IR', 'IQ', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'YE', 'JO', 'LB', 'SY', 'IL', 'PS', 'TR', 'GE', 'AM', 'AZ', 'MM', 'LA', 'KH', 'BN', 'TL') THEN country_code END) as asia_count,
    COUNT(DISTINCT CASE WHEN country_code IN ('US', 'CA', 'MX', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA', 'CU', 'JM', 'HT', 'DO', 'PR', 'BS', 'TT', 'BB', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'GY', 'SR') THEN country_code END) as americas_count,
    COUNT(DISTINCT CASE WHEN country_code IN ('ZA', 'EG', 'MA', 'DZ', 'TN', 'LY', 'NG', 'KE', 'ET', 'GH', 'TZ', 'UG', 'SD', 'SS', 'SN', 'CI', 'CM', 'ZW', 'AO', 'MZ', 'MG', 'ZM', 'BW', 'NA', 'MU', 'RE', 'RW', 'BJ', 'TG', 'ML', 'BF', 'NE', 'TD', 'SO', 'DJ', 'ER', 'MW', 'LS', 'SZ', 'GM', 'GN', 'GW', 'SL', 'LR', 'GA', 'CG', 'CD', 'CF', 'GQ', 'ST', 'CV', 'KM', 'SC', 'YT') THEN country_code END) as africa_count,
    COUNT(DISTINCT CASE WHEN country_code IN ('AU', 'NZ', 'FJ', 'PG', 'NC', 'PF', 'WS', 'TO', 'VU', 'SB', 'GU', 'FM', 'MH', 'PW', 'KI', 'NR', 'TV', 'CK', 'NU', 'TK', 'WF', 'AS') THEN country_code END) as oceania_count
  INTO v_continent_counts
  FROM (
    SELECT country_code FROM visits WHERE user_id = p_user_id
    UNION
    SELECT country_code FROM country_claims WHERE user_id = p_user_id
  ) combined_countries;

  -- Loop through all badges
  FOR v_badge IN SELECT * FROM badge_definitions LOOP
    v_earned := FALSE;
    v_criteria := v_badge.criteria;

    -- Check each badge type
    IF v_criteria ? 'flights' AND v_stats.total_flights >= (v_criteria->>'flights')::INT THEN
      v_earned := TRUE;
    ELSIF v_criteria ? 'distance_km' AND v_stats.total_distance_km >= (v_criteria->>'distance_km')::BIGINT THEN
      v_earned := TRUE;
    ELSIF v_criteria ? 'airlines' AND v_stats.airlines_count >= (v_criteria->>'airlines')::INT THEN
      v_earned := TRUE;
    ELSIF v_criteria ? 'aircraft' AND v_stats.aircraft_count >= (v_criteria->>'aircraft')::INT THEN
      v_earned := TRUE;
    ELSIF v_criteria ? 'continents' AND v_stats.continents_count >= (v_criteria->>'continents')::INT THEN
      v_earned := TRUE;
    ELSIF v_criteria ? 'flight_minutes' AND v_stats.longest_flight_minutes >= (v_criteria->>'flight_minutes')::INT THEN
      v_earned := TRUE;
    ELSIF v_criteria ? 'night_departure' AND v_stats.has_night_departure = TRUE THEN
      v_earned := TRUE;
    ELSIF v_criteria ? 'early_adopter' AND v_user_number <= (v_criteria->>'early_adopter')::INT THEN
      v_earned := TRUE;
    -- Continent-specific badges
    ELSIF v_criteria ? 'continent' THEN
      CASE v_criteria->>'continent'
        WHEN 'europe' THEN
          IF v_continent_counts.europe_count >= (v_criteria->>'min_countries')::INT THEN v_earned := TRUE; END IF;
        WHEN 'asia' THEN
          IF v_continent_counts.asia_count >= (v_criteria->>'min_countries')::INT THEN v_earned := TRUE; END IF;
        WHEN 'americas' THEN
          IF v_continent_counts.americas_count >= (v_criteria->>'min_countries')::INT THEN v_earned := TRUE; END IF;
        WHEN 'africa' THEN
          IF v_continent_counts.africa_count >= (v_criteria->>'min_countries')::INT THEN v_earned := TRUE; END IF;
        WHEN 'oceania' THEN
          IF v_continent_counts.oceania_count >= (v_criteria->>'min_countries')::INT THEN v_earned := TRUE; END IF;
        ELSE NULL;
      END CASE;
    END IF;

    -- Award badge if earned and not already owned
    IF v_earned THEN
      INSERT INTO user_badges (user_id, badge_id, earned_at)
      VALUES (p_user_id, v_badge.id, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Recalculate stats for all existing users
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  FOR v_user_id IN SELECT DISTINCT user_id FROM flights LOOP
    PERFORM recalculate_user_stats(v_user_id);
  END LOOP;
END
$$;
