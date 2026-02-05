-- Update leaderboard minimum flight requirement from 10 to 5
-- This allows users with 5+ flights to appear on leaderboards

CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS void AS $$
DECLARE
  v_total_users INT;
BEGIN
  -- Get total eligible users (5+ flights and opted in)
  SELECT COUNT(*) INTO v_total_users
  FROM user_stats us
  JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 5 AND p.show_on_leaderboards = TRUE;

  -- Clear existing cache
  DELETE FROM leaderboard_cache;

  -- Flights leaderboard
  INSERT INTO leaderboard_cache (category, user_id, rank, value, percentile, metadata)
  SELECT
    'flights' AS category,
    us.user_id,
    ROW_NUMBER() OVER (ORDER BY us.total_flights DESC, us.created_at ASC) AS rank,
    us.total_flights AS value,
    ROUND((1 - (ROW_NUMBER() OVER (ORDER BY us.total_flights DESC, us.created_at ASC)::FLOAT / v_total_users)) * 100, 1) AS percentile,
    jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url) AS metadata
  FROM user_stats us
  JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 5 AND p.show_on_leaderboards = TRUE;

  -- Distance leaderboard
  INSERT INTO leaderboard_cache (category, user_id, rank, value, percentile, metadata)
  SELECT
    'distance' AS category,
    us.user_id,
    ROW_NUMBER() OVER (ORDER BY us.total_distance_km DESC, us.created_at ASC) AS rank,
    us.total_distance_km AS value,
    ROUND((1 - (ROW_NUMBER() OVER (ORDER BY us.total_distance_km DESC, us.created_at ASC)::FLOAT / v_total_users)) * 100, 1) AS percentile,
    jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url) AS metadata
  FROM user_stats us
  JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 5 AND p.show_on_leaderboards = TRUE;

  -- Countries leaderboard
  INSERT INTO leaderboard_cache (category, user_id, rank, value, percentile, metadata)
  SELECT
    'countries' AS category,
    us.user_id,
    ROW_NUMBER() OVER (ORDER BY us.countries_count DESC, us.created_at ASC) AS rank,
    us.countries_count AS value,
    ROUND((1 - (ROW_NUMBER() OVER (ORDER BY us.countries_count DESC, us.created_at ASC)::FLOAT / v_total_users)) * 100, 1) AS percentile,
    jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url) AS metadata
  FROM user_stats us
  JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 5 AND p.show_on_leaderboards = TRUE;

  -- Cities leaderboard
  INSERT INTO leaderboard_cache (category, user_id, rank, value, percentile, metadata)
  SELECT
    'cities' AS category,
    us.user_id,
    ROW_NUMBER() OVER (ORDER BY us.airports_count DESC, us.created_at ASC) AS rank,
    us.airports_count AS value,
    ROUND((1 - (ROW_NUMBER() OVER (ORDER BY us.airports_count DESC, us.created_at ASC)::FLOAT / v_total_users)) * 100, 1) AS percentile,
    jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url) AS metadata
  FROM user_stats us
  JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 5 AND p.show_on_leaderboards = TRUE;

  -- Airlines leaderboard
  INSERT INTO leaderboard_cache (category, user_id, rank, value, percentile, metadata)
  SELECT
    'airlines' AS category,
    us.user_id,
    ROW_NUMBER() OVER (ORDER BY us.airlines_count DESC, us.created_at ASC) AS rank,
    us.airlines_count AS value,
    ROUND((1 - (ROW_NUMBER() OVER (ORDER BY us.airlines_count DESC, us.created_at ASC)::FLOAT / v_total_users)) * 100, 1) AS percentile,
    jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url) AS metadata
  FROM user_stats us
  JOIN profiles p ON us.user_id = p.id
  WHERE us.total_flights >= 5 AND p.show_on_leaderboards = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh the cache with new threshold
SELECT refresh_leaderboards();
