-- One-time activation for imported users and atomic auth request counters.
CREATE TABLE account_activation_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  claim_id TEXT UNIQUE
);
CREATE INDEX idx_account_activation_tokens_user ON account_activation_tokens(user_id);
CREATE INDEX idx_account_activation_tokens_expiry ON account_activation_tokens(expires_at);

CREATE TABLE auth_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL CHECK (count >= 1),
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_auth_rate_limits_expiry ON auth_rate_limits(expires_at);
