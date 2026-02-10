-- Add trigger to refresh leaderboard cache when user_stats change
-- This was the missing link: flights → user_stats → (nothing) → leaderboard_cache
-- Includes 30-second debounce to prevent excessive refreshes during bulk imports
CREATE OR REPLACE FUNCTION trigger_refresh_leaderboards_on_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_last_refresh TIMESTAMPTZ;
BEGIN
  -- Check when leaderboard was last refreshed
  SELECT MAX(updated_at) INTO v_last_refresh FROM leaderboard_cache;

  -- Skip if refreshed within last 30 seconds (debounce for bulk ops)
  IF v_last_refresh IS NOT NULL AND v_last_refresh > NOW() - INTERVAL '30 seconds' THEN
    RETURN NEW;
  END IF;

  PERFORM public.refresh_leaderboards();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS stats_leaderboard_refresh_trigger ON user_stats;
CREATE TRIGGER stats_leaderboard_refresh_trigger
AFTER INSERT OR UPDATE ON user_stats
FOR EACH ROW EXECUTE FUNCTION trigger_refresh_leaderboards_on_stats();
