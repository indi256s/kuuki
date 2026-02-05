-- Opt-in all existing users to public profiles and leaderboards
-- This migration enables leaderboard visibility for all current users

BEGIN;

-- Enable public profiles for all users
UPDATE profiles
SET is_public = TRUE
WHERE is_public = FALSE OR is_public IS NULL;

-- Enable leaderboards for users with 5+ flights
UPDATE profiles
SET show_on_leaderboards = TRUE
WHERE (show_on_leaderboards = FALSE OR show_on_leaderboards IS NULL)
  AND id IN (
    SELECT user_id
    FROM user_stats
    WHERE total_flights >= 5
  );

COMMIT;

-- Refresh the leaderboard cache to include newly opted-in users
SELECT refresh_leaderboards();
