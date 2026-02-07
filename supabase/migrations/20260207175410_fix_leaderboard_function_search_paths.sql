-- Fix mutable search_path on trigger function
CREATE OR REPLACE FUNCTION trigger_refresh_leaderboards_on_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.show_on_leaderboards IS DISTINCT FROM NEW.show_on_leaderboards THEN
    PERFORM public.refresh_leaderboards();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
