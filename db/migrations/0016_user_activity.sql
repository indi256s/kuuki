-- Minimal first-party presence: one retained account per UTC day, no page/session/device history.
CREATE TABLE user_activity_days (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX idx_user_activity_day ON user_activity_days(day, user_id);

-- Starts at the first recorded visit, not migration time or the oldest imported account.
CREATE TABLE user_activity_collection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  started_at TEXT NOT NULL
);
