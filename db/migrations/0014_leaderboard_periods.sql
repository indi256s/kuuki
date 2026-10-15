-- Leaderboard periods and ground categories. SQLite cannot alter a CHECK, so the cache table is rebuilt.
-- Existing rows are all-time rows and carry over unchanged as `period = 'all'`: production runs no maintenance pass
-- yet, so nothing would refill an emptied cache. Readers that predate periods filter `period = 'all'`.
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
INSERT INTO leaderboard_cache_next (id, user_id, category, period, value, rank, percentile, metadata, updated_at)
  SELECT id, user_id, category, 'all', value, rank, percentile, metadata, updated_at FROM leaderboard_cache;
DROP TABLE leaderboard_cache;
ALTER TABLE leaderboard_cache_next RENAME TO leaderboard_cache;
CREATE INDEX idx_leaderboard_category_period_rank ON leaderboard_cache(category, period, rank);
