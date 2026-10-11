-- Onboarding is finished when this is set: by "I'll do this later" or by opening the journal after the reveal.
ALTER TABLE profiles ADD COLUMN onboarded_at TEXT;

-- Every profile that exists before this migration is onboarded, with or without a username.
UPDATE profiles SET onboarded_at = COALESCE(updated_at, created_at) WHERE onboarded_at IS NULL;
