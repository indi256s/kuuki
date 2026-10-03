-- Preserve application IDs and legacy passwords while Better Auth owns new sessions.
ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN image TEXT;
ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
UPDATE users SET name = COALESCE((SELECT display_name FROM profiles WHERE profiles.id = users.id), ''),
  image = (SELECT avatar_url FROM profiles WHERE profiles.id = users.id), updated_at = created_at;

CREATE TABLE auth_accounts (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt TEXT,
  refreshTokenExpiresAt TEXT,
  scope TEXT,
  password TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_auth_accounts_provider ON auth_accounts(providerId, accountId);
CREATE INDEX idx_auth_accounts_user ON auth_accounts(userId);
INSERT INTO auth_accounts(id, accountId, providerId, userId, password, createdAt, updatedAt)
  SELECT 'credential:' || id, id, 'credential', id, password_hash, created_at, created_at
  FROM users WHERE password_hash <> 'RESET_REQUIRED';

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  expiresAt TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(userId);
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions(expiresAt);

CREATE TABLE auth_verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX idx_auth_verifications_identifier ON auth_verifications(identifier);
