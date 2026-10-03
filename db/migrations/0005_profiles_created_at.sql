-- Early-adopter badge order counts earlier signups without scanning profiles.
CREATE INDEX idx_profiles_created_at ON profiles(created_at);
