-- ============================================================================
-- Founding User Badge — Awarded to beta testers
-- ============================================================================

-- 1. Insert badge definition
INSERT INTO badge_definitions (code, name, description, category, icon, tier, points, criteria)
VALUES (
  'founding-user',
  'Founding User',
  'You were here before the black box was even installed. That''s either loyalty or poor judgment. Either way, noted.',
  'special',
  'sparkles',
  NULL,
  75,
  '{"beta_invite": true}'::jsonb
)
ON CONFLICT DO NOTHING;

-- 2. Award badge to all existing users (all are beta users)
INSERT INTO user_badges (user_id, badge_id, earned_at)
SELECT p.id, bd.id, NOW()
FROM profiles p
CROSS JOIN badge_definitions bd
WHERE bd.code = 'founding-user'
ON CONFLICT DO NOTHING;

-- 3. Update evaluate_badges() to handle beta_invite criteria
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
    ELSIF v_criteria ? 'beta_invite' THEN
      -- All users who signed up during beta used invite codes
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
