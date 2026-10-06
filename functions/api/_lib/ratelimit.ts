// Atomic D1 fixed-window counters for auth and paid import/enrichment routes.
// All callers share the auth_rate_limits table, so each key starts with its route's prefix
// (signin:, signup:, import-parse:, import-enrich:, ...).

import { HttpError } from './http'

/**
 * Increment a counter for `key` within a fixed window. The UPSERT is one SQLite
 * statement, so parallel requests cannot lose increments.
 */
export async function rateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const row = await db.prepare(
    `INSERT INTO auth_rate_limits (key, count, expires_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN auth_rate_limits.expires_at <= ? THEN 1 ELSE auth_rate_limits.count + 1 END,
       expires_at = CASE WHEN auth_rate_limits.expires_at <= ? THEN excluded.expires_at ELSE auth_rate_limits.expires_at END
     RETURNING count`,
  ).bind(key, now + windowSeconds, now, now).first<{ count: number }>()
  if (!row || row.count > limit) {
    throw new HttpError(429, 'Too many requests — please try again later', 'RATE_LIMITED')
  }
}

/**
 * Read-only check: true when the window for `key` is live and already holds `limit` hits, so the
 * next `rateLimit` call would be refused. Consumes nothing.
 */
export async function rateLimitExhausted(db: D1Database, key: string, limit: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000)
  const row = await db.prepare('SELECT count FROM auth_rate_limits WHERE key = ? AND expires_at > ?')
    .bind(key, now).first<{ count: number }>()
  return (row?.count ?? 0) >= limit
}

/** Derive a client key from the request (Cloudflare-provided client IP). */
export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown'
}
