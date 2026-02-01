-- Phase 4: Social Features Migration
-- Adds support for public profiles, leaderboards, and badges

-- ============================================================================
-- 1. Profile Enhancements
-- ============================================================================

-- Add username uniqueness constraint (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_lower
ON profiles (LOWER(username));

-- Add theme color to profiles (10 preset colors)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT 'teal'
CHECK (theme_color IN ('teal', 'red', 'coral', 'olive', 'yellow', 'orange', 'purple', 'blue', 'gray', 'green'));

-- ============================================================================
-- 2. User Stats Table (Denormalized for Performance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_flights INT DEFAULT 0,
  total_distance_km BIGINT DEFAULT 0,
  countries_count INT DEFAULT 0,
  cities_count INT DEFAULT 0,
  airlines_count INT DEFAULT 0,
  aircraft_count INT DEFAULT 0,
  continents_count INT DEFAULT 0,
  longest_flight_minutes INT DEFAULT 0,
  has_night_departure BOOLEAN DEFAULT FALSE,  -- For Night Owl badge (00:00-05:00)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_stats
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Everyone can view stats (for leaderboards and profiles)
CREATE POLICY "Stats are viewable by everyone" ON user_stats
FOR SELECT USING (true);

-- Only system (triggers) can update stats
CREATE POLICY "Stats updated by system" ON user_stats
FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 3. Leaderboard Rankings Enhancement
-- ============================================================================

-- Add percentile columns to leaderboard_cache
ALTER TABLE leaderboard_cache
ADD COLUMN IF NOT EXISTS percentile DECIMAL(5,2);

-- Add index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_category_rank
ON leaderboard_cache (category, rank);

-- ============================================================================
-- 4. Badge Definitions (Seed Data)
-- ============================================================================

-- Clear existing badge definitions if any
TRUNCATE badge_definitions CASCADE;

-- Insert all badge definitions
INSERT INTO badge_definitions (code, name, description, category, tier, icon, criteria, points) VALUES
-- Flights (Mission Stages) - Tiered
('flights-1', 'Launch Pad', 'Complete your first flight', 'flights', 'bronze', 'rocket', '{"flights": 1}', 10),
('flights-2', 'Low Orbit', 'Complete 25 flights', 'flights', 'silver', 'rocket', '{"flights": 25}', 25),
('flights-3', 'High Orbit', 'Complete 50 flights', 'flights', 'gold', 'rocket', '{"flights": 50}', 50),
('flights-4', 'Moon Mission', 'Complete 100 flights', 'flights', 'platinum', 'moon', '{"flights": 100}', 100),
('flights-5', 'Mars Mission', 'Complete 500 flights', 'flights', 'diamond', 'sparkles', '{"flights": 500}', 500),

-- Distance (Spacecraft) - Tiered
('distance-1', 'Sputnik', 'Fly 10,000 km total', 'distance', 'bronze', 'satellite', '{"distance_km": 10000}', 10),
('distance-2', 'Vostok', 'Fly 50,000 km total', 'distance', 'silver', 'satellite', '{"distance_km": 50000}', 25),
('distance-3', 'Apollo', 'Fly 100,000 km total', 'distance', 'gold', 'orbit', '{"distance_km": 100000}', 50),
('distance-4', 'Voyager', 'Fly 500,000 km total', 'distance', 'platinum', 'orbit', '{"distance_km": 500000}', 100),
('distance-5', 'New Horizons', 'Fly 1,000,000 km total', 'distance', 'diamond', 'star', '{"distance_km": 1000000}', 500),

-- Airlines (Collector) - Tiered
('airlines-1', 'Loyal', 'Fly with 5 different airlines', 'airlines', 'bronze', 'building-2', '{"airlines": 5}', 10),
('airlines-2', 'Diverse', 'Fly with 15 different airlines', 'airlines', 'silver', 'building-2', '{"airlines": 15}', 25),
('airlines-3', 'Collector', 'Fly with 30 different airlines', 'airlines', 'gold', 'building-2', '{"airlines": 30}', 50),

-- Aircraft (Collector) - Tiered
('aircraft-1', 'Spotter', 'Fly on 5 different aircraft types', 'aircraft', 'bronze', 'plane', '{"aircraft": 5}', 10),
('aircraft-2', 'Enthusiast', 'Fly on 20 different aircraft types', 'aircraft', 'silver', 'plane', '{"aircraft": 20}', 25),
('aircraft-3', 'Fleet Master', 'Fly on 50 different aircraft types', 'aircraft', 'gold', 'plane', '{"aircraft": 50}', 50),

-- Achievements (Binary)
('night-owl', 'Night Owl', 'Depart on a flight between midnight and 5 AM', 'achievement', NULL, 'moon', '{"night_departure": true}', 15),
('globe-trotter', 'Globe Trotter', 'Visit airports on 3 or more continents', 'achievement', NULL, 'globe', '{"continents": 3}', 25),
('marathon', 'Marathon', 'Complete a single flight of 12+ hours', 'achievement', NULL, 'timer', '{"flight_minutes": 720}', 30),

-- Secret Badges (GLaDOS-style)
('test-subject', 'Test Subject #{{user_number}}', 'Congratulations. You are among the first 20 test subjects in this facility. The cake is not a lie... for you.', 'secret', NULL, 'flask', '{"early_adopter": 20}', 50);

-- ============================================================================
-- 5. Functions for Stats Calculation
-- ============================================================================

-- Function to recalculate user stats
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

  -- Count countries and cities from visits table
  SELECT
    COUNT(DISTINCT country_code),
    COUNT(DISTINCT city)
  INTO v_countries, v_cities
  FROM visits
  WHERE user_id = p_user_id;

  -- Count continents (approximate from country codes)
  -- This is a simplified version - could be enhanced with a proper mapping
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
  FROM visits
  WHERE user_id = p_user_id AND country_code IS NOT NULL;

  -- Check for night departures (00:00-05:00)
  SELECT EXISTS(
    SELECT 1 FROM flights
    WHERE user_id = p_user_id
      AND departure_time IS NOT NULL
      AND (departure_time::time >= '00:00:00' AND departure_time::time < '05:00:00')
      AND (is_upcoming IS NULL OR is_upcoming = FALSE)
  ) INTO v_has_night_departure;

  -- Upsert stats
  INSERT INTO user_stats (
    user_id, total_flights, total_distance_km, countries_count, cities_count,
    airlines_count, aircraft_count, continents_count, longest_flight_minutes,
    has_night_departure, updated_at
  ) VALUES (
    p_user_id, v_total_flights, v_total_distance, v_countries, v_cities,
    v_airlines, v_aircraft, v_continents, v_longest_flight,
    v_has_night_departure, NOW()
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
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Triggers for Automatic Stats Updates
-- ============================================================================

-- Trigger function for flights changes
CREATE OR REPLACE FUNCTION trigger_update_user_stats()
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

-- Trigger on flights table
DROP TRIGGER IF EXISTS flights_stats_trigger ON flights;
CREATE TRIGGER flights_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON flights
FOR EACH ROW EXECUTE FUNCTION trigger_update_user_stats();

-- Trigger function for visits changes
CREATE OR REPLACE FUNCTION trigger_update_stats_from_visits()
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

-- Trigger on visits table
DROP TRIGGER IF EXISTS visits_stats_trigger ON visits;
CREATE TRIGGER visits_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON visits
FOR EACH ROW EXECUTE FUNCTION trigger_update_stats_from_visits();

-- ============================================================================
-- 7. Badge Evaluation Function
-- ============================================================================

CREATE OR REPLACE FUNCTION evaluate_badges(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_stats RECORD;
  v_badge RECORD;
  v_user_number INT;
  v_criteria JSONB;
  v_earned BOOLEAN;
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
-- 8. Trigger for Badge Evaluation
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_evaluate_badges()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM evaluate_badges(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS stats_badge_trigger ON user_stats;
CREATE TRIGGER stats_badge_trigger
AFTER INSERT OR UPDATE ON user_stats
FOR EACH ROW EXECUTE FUNCTION trigger_evaluate_badges();

-- ============================================================================
-- 9. Leaderboard Refresh Function
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS VOID AS $$
DECLARE
  v_total_users INT;
BEGIN
  -- Get total eligible users (10+ flights and opted in)
  SELECT COUNT(*) INTO v_total_users
  FROM user_stats us
  JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 10 AND p.show_on_leaderboards = TRUE;

  -- Clear existing cache
  DELETE FROM leaderboard_cache;

  -- Flights leaderboard
  INSERT INTO leaderboard_cache (user_id, category, value, rank, percentile, metadata, updated_at)
  SELECT
    us.user_id,
    'flights',
    us.total_flights,
    ROW_NUMBER() OVER (ORDER BY us.total_flights DESC),
    ROUND(100.0 * (v_total_users - ROW_NUMBER() OVER (ORDER BY us.total_flights DESC) + 1) / NULLIF(v_total_users, 0), 2),
    jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url),
    NOW()
  FROM user_stats us
  JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 10 AND p.show_on_leaderboards = TRUE;

  -- Distance leaderboard
  INSERT INTO leaderboard_cache (user_id, category, value, rank, percentile, metadata, updated_at)
  SELECT
    us.user_id,
    'distance',
    us.total_distance_km,
    ROW_NUMBER() OVER (ORDER BY us.total_distance_km DESC),
    ROUND(100.0 * (v_total_users - ROW_NUMBER() OVER (ORDER BY us.total_distance_km DESC) + 1) / NULLIF(v_total_users, 0), 2),
    jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url),
    NOW()
  FROM user_stats us
  JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 10 AND p.show_on_leaderboards = TRUE;

  -- Countries leaderboard
  INSERT INTO leaderboard_cache (user_id, category, value, rank, percentile, metadata, updated_at)
  SELECT
    us.user_id,
    'countries',
    us.countries_count,
    ROW_NUMBER() OVER (ORDER BY us.countries_count DESC),
    ROUND(100.0 * (v_total_users - ROW_NUMBER() OVER (ORDER BY us.countries_count DESC) + 1) / NULLIF(v_total_users, 0), 2),
    jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url),
    NOW()
  FROM user_stats us
  JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 10 AND p.show_on_leaderboards = TRUE;

  -- Cities leaderboard
  INSERT INTO leaderboard_cache (user_id, category, value, rank, percentile, metadata, updated_at)
  SELECT
    us.user_id,
    'cities',
    us.cities_count,
    ROW_NUMBER() OVER (ORDER BY us.cities_count DESC),
    ROUND(100.0 * (v_total_users - ROW_NUMBER() OVER (ORDER BY us.cities_count DESC) + 1) / NULLIF(v_total_users, 0), 2),
    jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url),
    NOW()
  FROM user_stats us
  JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 10 AND p.show_on_leaderboards = TRUE;

  -- Airlines leaderboard
  INSERT INTO leaderboard_cache (user_id, category, value, rank, percentile, metadata, updated_at)
  SELECT
    us.user_id,
    'airlines',
    us.airlines_count,
    ROW_NUMBER() OVER (ORDER BY us.airlines_count DESC),
    ROUND(100.0 * (v_total_users - ROW_NUMBER() OVER (ORDER BY us.airlines_count DESC) + 1) / NULLIF(v_total_users, 0), 2),
    jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url),
    NOW()
  FROM user_stats us
  JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 10 AND p.show_on_leaderboards = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. RLS Policies for Social Features
-- ============================================================================

-- Profiles: Public profiles viewable by all
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
FOR SELECT USING (is_public = TRUE OR auth.uid() = id);

-- User badges: Viewable by all (for public profiles)
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Badges viewable by all" ON user_badges;
CREATE POLICY "Badges viewable by all" ON user_badges
FOR SELECT USING (true);

-- Badge definitions: Viewable by all
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Badge definitions viewable by all" ON badge_definitions;
CREATE POLICY "Badge definitions viewable by all" ON badge_definitions
FOR SELECT USING (true);

-- Leaderboard cache: Viewable by all
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leaderboard viewable by all" ON leaderboard_cache;
CREATE POLICY "Leaderboard viewable by all" ON leaderboard_cache
FOR SELECT USING (true);

-- ============================================================================
-- 11. Add Unique Constraint to user_badges
-- ============================================================================

-- Ensure unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_badges_user_id_badge_id_key'
  ) THEN
    ALTER TABLE user_badges ADD CONSTRAINT user_badges_user_id_badge_id_key UNIQUE (user_id, badge_id);
  END IF;
END
$$;

-- ============================================================================
-- 12. Initialize Stats for Existing Users
-- ============================================================================

-- Recalculate stats for all existing users with flights
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  FOR v_user_id IN SELECT DISTINCT user_id FROM flights LOOP
    PERFORM recalculate_user_stats(v_user_id);
  END LOOP;
END
$$;

-- Refresh leaderboards
SELECT refresh_leaderboards();
