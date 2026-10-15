-- The member's chosen avatar character. NULL keeps the character derived from the member id.
ALTER TABLE profiles ADD COLUMN avatar_face TEXT
  CHECK (avatar_face IS NULL OR avatar_face IN ('curious', 'jetlag', 'sleepy', 'content'));
