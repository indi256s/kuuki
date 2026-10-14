-- Unified Passport (ADR 0007). Additive only.
-- Hidden countries are presentation: nothing derived (evidence, stats, rankings) reads this table.
CREATE TABLE passport_hidden_countries (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL CHECK (length(country_code) = 2),
  hidden_at    TEXT NOT NULL,
  PRIMARY KEY (user_id, country_code)
);

-- Which countries a public profile publishes: flight countries only (the pre-existing behaviour) or all pressed.
ALTER TABLE profiles ADD COLUMN passport_publication TEXT NOT NULL DEFAULT 'flights'
  CHECK (passport_publication IN ('flights', 'all'));
