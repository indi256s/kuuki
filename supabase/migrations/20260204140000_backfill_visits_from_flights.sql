-- Backfill Visits from Existing Flights
-- This migration populates the visits table from existing flights using airports_reference
-- The flights_visits_trigger handles new flights automatically, but existing flights need backfilling

-- ============================================================================
-- 1. Backfill visits from origin airports (completed flights only)
-- ============================================================================

INSERT INTO visits (user_id, country_code, city, airport_iata, first_visit, last_visit, visit_count)
SELECT
  f.user_id,
  a.country_code,
  a.city,
  f.origin as airport_iata,
  MIN(f.date) as first_visit,
  MAX(f.date) as last_visit,
  COUNT(*) as visit_count
FROM flights f
JOIN airports_reference a ON a.iata = f.origin
WHERE f.is_upcoming = FALSE OR f.is_upcoming IS NULL
GROUP BY f.user_id, a.country_code, a.city, f.origin
ON CONFLICT (user_id, airport_iata)
DO UPDATE SET
  visit_count = visits.visit_count + EXCLUDED.visit_count,
  first_visit = LEAST(visits.first_visit, EXCLUDED.first_visit),
  last_visit = GREATEST(visits.last_visit, EXCLUDED.last_visit);

-- ============================================================================
-- 2. Backfill visits from destination airports (completed flights only)
-- ============================================================================

INSERT INTO visits (user_id, country_code, city, airport_iata, first_visit, last_visit, visit_count)
SELECT
  f.user_id,
  a.country_code,
  a.city,
  f.destination as airport_iata,
  MIN(f.date) as first_visit,
  MAX(f.date) as last_visit,
  COUNT(*) as visit_count
FROM flights f
JOIN airports_reference a ON a.iata = f.destination
WHERE f.is_upcoming = FALSE OR f.is_upcoming IS NULL
GROUP BY f.user_id, a.country_code, a.city, f.destination
ON CONFLICT (user_id, airport_iata)
DO UPDATE SET
  visit_count = visits.visit_count + EXCLUDED.visit_count,
  first_visit = LEAST(visits.first_visit, EXCLUDED.first_visit),
  last_visit = GREATEST(visits.last_visit, EXCLUDED.last_visit);

-- ============================================================================
-- 3. Recalculate user_stats for all users to update countries_count
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

-- ============================================================================
-- 4. Refresh leaderboards to reflect updated country counts
-- ============================================================================

SELECT refresh_leaderboards();
