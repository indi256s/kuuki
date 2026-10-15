-- Leaderboard periods and ground categories. SQLite cannot alter a CHECK, so the cache table is rebuilt.
-- The cache is fully rewritten by every maintenance pass (refreshLeaderboards), so no rows are copied: the
-- first pass after this migration repopulates it. Readers that predate periods filter `period = 'all'`.
-- `period` defaults to 'all' so a pre-period rebuild still writes valid all-time rows until the new code deploys.
CREATE TABLE leaderboard_cache_next (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category   TEXT NOT NULL CHECK (category IN (
               'flights','distance','countries','cities','airlines','rail','road','ground_countries')),
  period     TEXT NOT NULL DEFAULT 'all' CHECK (period = 'all' OR period GLOB '[0-9][0-9][0-9][0-9]'),
  value      REAL NOT NULL,
  rank       INTEGER NOT NULL,
  percentile REAL,
  metadata   TEXT,   -- JSON: { username, display_name, avatar_url }
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, category, period)
);
DROP TABLE leaderboard_cache;
ALTER TABLE leaderboard_cache_next RENAME TO leaderboard_cache;
CREATE INDEX idx_leaderboard_category_period_rank ON leaderboard_cache(category, period, rank);
