-- Add a trigger that refreshes leaderboard cache when show_on_leaderboards changes
CREATE OR REPLACE FUNCTION trigger_refresh_leaderboards_on_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.show_on_leaderboards IS DISTINCT FROM NEW.show_on_leaderboards THEN
    PERFORM refresh_leaderboards();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profiles_leaderboard_refresh_trigger ON profiles;
CREATE TRIGGER profiles_leaderboard_refresh_trigger
AFTER UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION trigger_refresh_leaderboards_on_profile();
