-- Fix ROUND(float) -> ROUND(numeric) and us.created_at -> p.created_at
CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS void AS $$
DECLARE
  v_total_users INT;
BEGIN
  SELECT COUNT(*) INTO v_total_users
  FROM user_stats us
  JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 5 AND p.show_on_leaderboards = TRUE;

  DELETE FROM leaderboard_cache;

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

-- Refresh now to pick up all eligible users
SELECT refresh_leaderboards();
