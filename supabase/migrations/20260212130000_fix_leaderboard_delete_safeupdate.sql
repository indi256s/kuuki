-- Fix: pg_safeupdate blocks DELETE without WHERE clause in refresh_leaderboards()
-- The authenticator role loads safeupdate via session_preload_libraries, which
-- persists into SECURITY DEFINER trigger functions called during flight INSERT.
-- Adding WHERE true satisfies the safeupdate check.
--
-- Trigger chain: INSERT flight → recalculate_user_stats() → UPSERT user_stats
--   → trigger_refresh_leaderboards_on_stats() → refresh_leaderboards()
--   → DELETE FROM leaderboard_cache (blocked by safeupdate)

CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS void AS $$
DECLARE
  v_total_users INT;
BEGIN
  SELECT COUNT(*) INTO v_total_users
  FROM user_stats us
  JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 5 AND p.show_on_leaderboards = TRUE;

  DELETE FROM leaderboard_cache WHERE true;

  INSERT INTO leaderboard_cache (category, user_id, rank, value, percentile, metadata)
  SELECT 'flights', us.user_id,
    ROW_NUMBER() OVER (ORDER BY us.total_flights DESC, p.created_at ASC),
    us.total_flights,
    ROUND((1 - (ROW_NUMBER() OVER (ORDER BY us.total_flights DESC, p.created_at ASC)::NUMERIC / v_total_users)) * 100, 1),
    jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url)
  FROM user_stats us JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 5 AND p.show_on_leaderboards = TRUE;

  INSERT INTO leaderboard_cache (category, user_id, rank, value, percentile, metadata)
  SELECT 'distance', us.user_id,
    ROW_NUMBER() OVER (ORDER BY us.total_distance_km DESC, p.created_at ASC),
    us.total_distance_km,
    ROUND((1 - (ROW_NUMBER() OVER (ORDER BY us.total_distance_km DESC, p.created_at ASC)::NUMERIC / v_total_users)) * 100, 1),
    jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url)
  FROM user_stats us JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 5 AND p.show_on_leaderboards = TRUE;

  INSERT INTO leaderboard_cache (category, user_id, rank, value, percentile, metadata)
  SELECT 'countries', us.user_id,
    ROW_NUMBER() OVER (ORDER BY us.countries_count DESC, p.created_at ASC),
    us.countries_count,
    ROUND((1 - (ROW_NUMBER() OVER (ORDER BY us.countries_count DESC, p.created_at ASC)::NUMERIC / v_total_users)) * 100, 1),
    jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url)
  FROM user_stats us JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 5 AND p.show_on_leaderboards = TRUE;

  INSERT INTO leaderboard_cache (category, user_id, rank, value, percentile, metadata)
  SELECT 'cities', us.user_id,
    ROW_NUMBER() OVER (ORDER BY us.airports_count DESC, p.created_at ASC),
    us.airports_count,
    ROUND((1 - (ROW_NUMBER() OVER (ORDER BY us.airports_count DESC, p.created_at ASC)::NUMERIC / v_total_users)) * 100, 1),
    jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url)
  FROM user_stats us JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 5 AND p.show_on_leaderboards = TRUE;

  INSERT INTO leaderboard_cache (category, user_id, rank, value, percentile, metadata)
  SELECT 'airlines', us.user_id,
    ROW_NUMBER() OVER (ORDER BY us.airlines_count DESC, p.created_at ASC),
    us.airlines_count,
    ROUND((1 - (ROW_NUMBER() OVER (ORDER BY us.airlines_count DESC, p.created_at ASC)::NUMERIC / v_total_users)) * 100, 1),
    jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url)
  FROM user_stats us JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 5 AND p.show_on_leaderboards = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
